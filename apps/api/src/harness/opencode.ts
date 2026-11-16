import type { AgentEvent } from "@agent-map/shared/events";
import { z } from "zod";
import type { Adapter } from "./adapter";
import { clip, handlerFor, isoOf, parseOrThrow, summarize } from "./pairing";

const id = z.string().min(1).max(200);
const ms = z.number().optional();
const envelope = z.looseObject({ type: z.string().min(1).max(100), properties: z.unknown().optional() });
const sessionProps = z.object({
  info: z.looseObject({
    id,
    parentID: id.optional(),
    title: z.string().optional(),
    directory: z.string().optional(),
    time: z.looseObject({ created: ms }).optional(),
  }),
});
const messageProps = z.object({
  info: z.looseObject({
    id,
    sessionID: id,
    role: z.enum(["user", "assistant"]),
    modelID: z.string().max(120).optional(),
    time: z.looseObject({ created: ms, completed: ms }).optional(),
  }),
});
const partProps = z.object({
  part: z.looseObject({
    id,
    sessionID: id,
    messageID: id,
    type: z.string(),
    text: z.string().optional(),
    synthetic: z.boolean().optional(),
    callID: id.optional(),
    tool: z.string().min(1).max(120).optional(),
    state: z
      .looseObject({
        status: z.string(),
        input: z.record(z.string(), z.unknown()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        time: z.looseObject({ start: ms, end: ms }).optional(),
      })
      .optional(),
  }),
});

type Part = z.infer<typeof partProps>["part"];
type ToolPart = Part & { callID: string; tool: string; state: NonNullable<Part["state"]> };

type Message = {
  role: "user" | "assistant";
  sessionID: string;
  model?: string;
  at: string;
  completed: boolean;
  emitted: boolean;
};

const DEFAULT_TITLE = /^(New session|Child session) - /;
const SUBAGENT = /\(@(\S+) subagent\)/;
const MAX_DEPTH = 32;

const parse = <T extends z.ZodType>(schema: T, value: unknown) => parseOrThrow(schema, value, "Invalid OpenCode event");

const opencodeParser = () => {
  const parents = new Map<string, string>();
  const titles = new Map<string, string | undefined>();
  const children = new Map<string, { name: string; at: string }>();
  const links = new Map<string, string>();
  // shortcut: messages, parts and tool states are kept until restart, add pruning on session.deleted if memory shows
  const messages = new Map<string, Message>();
  const parts = new Map<string, Map<string, string>>();
  const tools = new Map<string, "started" | "finished">();

  const rootOf = (sessionId: string) => {
    let current = sessionId;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const parent = parents.get(current);
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  const agentStarted = (childId: string): AgentEvent[] => {
    const child = children.get(childId);
    const parentAgentId = parents.get(childId);
    if (!child || !parentAgentId) return [];
    return [
      {
        type: "agent.started",
        sessionId: rootOf(childId),
        at: child.at,
        agentId: childId,
        name: child.name,
        parentAgentId,
        parentToolId: links.get(childId),
      },
    ];
  };

  const onSession = (properties: unknown): AgentEvent[] => {
    const { info } = parse(sessionProps, properties);
    const at = isoOf(info.time?.created);
    const title = info.title && !DEFAULT_TITLE.test(info.title) ? info.title.slice(0, 200) : undefined;
    if (info.parentID) {
      parents.set(info.id, info.parentID);
      if (children.has(info.id)) return [];
      children.set(info.id, { name: SUBAGENT.exec(info.title ?? "")?.[1] ?? "agent", at });
      return agentStarted(info.id);
    }
    if (titles.has(info.id) && (!title || titles.get(info.id) === title)) return [];
    titles.set(info.id, title ?? titles.get(info.id));
    return [{ type: "session.started", sessionId: info.id, at, harness: "opencode", cwd: info.directory, title }];
  };

  const flush = (messageId: string): AgentEvent[] => {
    const message = messages.get(messageId);
    const texts = parts.get(messageId);
    if (!message || !texts || message.emitted || (message.role === "assistant" && !message.completed)) return [];
    message.emitted = true;
    parts.delete(messageId);
    const text = clip([...texts.values()].join("\n"), 1000);
    if (!text) return [];
    const model = message.role === "assistant" ? message.model : undefined;
    return [
      {
        type: "message",
        sessionId: rootOf(message.sessionID),
        at: message.at,
        agentId: message.sessionID,
        role: message.role,
        text,
        model,
      },
    ];
  };

  const onMessage = (properties: unknown): AgentEvent[] => {
    const { info } = parse(messageProps, properties);
    const completed = info.time?.completed;
    messages.set(info.id, {
      role: info.role,
      sessionID: info.sessionID,
      model: info.modelID,
      at: isoOf(info.role === "assistant" ? (completed ?? info.time?.created) : info.time?.created),
      completed: completed !== undefined,
      emitted: messages.get(info.id)?.emitted ?? false,
    });
    return flush(info.id);
  };

  const onText = (part: Part): AgentEvent[] => {
    if (part.synthetic || !part.text) return [];
    const texts = parts.get(part.messageID) ?? new Map<string, string>();
    texts.set(part.id, part.text);
    parts.set(part.messageID, texts);
    return flush(part.messageID);
  };

  const toolStarted = (part: ToolPart): AgentEvent => ({
    type: "tool.started",
    sessionId: rootOf(part.sessionID),
    at: isoOf(part.state.time?.start),
    agentId: part.sessionID,
    toolId: part.callID,
    name: part.tool,
    summary: summarize({ file_path: part.state.input?.filePath, ...part.state.input }),
  });

  const toolFinished = (part: ToolPart, seen: boolean, child: string | undefined): AgentEvent[] => {
    const sessionId = rootOf(part.sessionID);
    const at = isoOf(part.state.time?.end);
    const stopped: AgentEvent[] = child ? [{ type: "agent.stopped", sessionId, at, agentId: child }] : [];
    const finished: AgentEvent = {
      type: "tool.finished",
      sessionId,
      at,
      toolId: part.callID,
      ok: part.state.status === "completed",
    };
    return [...(seen ? [] : [toolStarted(part)]), finished, ...stopped];
  };

  const linkChild = (part: ToolPart) => {
    const child = part.state.metadata?.sessionId;
    if (typeof child !== "string") return { child: undefined, events: [] as AgentEvent[] };
    links.set(child, part.callID);
    return { child, events: agentStarted(child) };
  };

  const onTool = (part: ToolPart): AgentEvent[] => {
    const { status } = part.state;
    const { child, events } = linkChild(part);
    const seen = tools.get(part.callID);
    if (status === "pending" || status === "running") {
      if (seen) return events;
      tools.set(part.callID, "started");
      return [...events, toolStarted(part)];
    }
    if ((status !== "completed" && status !== "error") || seen === "finished") return events;
    tools.set(part.callID, "finished");
    return [...events, ...toolFinished(part, seen === "started", child)];
  };

  const onPart = (properties: unknown): AgentEvent[] => {
    const { part } = parse(partProps, properties);
    if (part.type === "text") return onText(part);
    if (part.type !== "tool" || !part.callID || !part.tool || !part.state) return [];
    return onTool({ ...part, callID: part.callID, tool: part.tool, state: part.state });
  };

  const handlers: Record<string, (properties: unknown) => AgentEvent[]> = {
    "session.created": onSession,
    "session.updated": onSession,
    "message.updated": onMessage,
    "message.part.updated": onPart,
  };

  return (raw: unknown): AgentEvent[] => {
    const { type, properties } = parse(envelope, raw);
    return handlerFor(handlers, type)?.(properties) ?? [];
  };
};

export const opencode: Adapter = { id: "opencode", name: "OpenCode", harness: "opencode", hook: opencodeParser() };
