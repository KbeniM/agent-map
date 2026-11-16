import type { AgentEvent } from "@agent-map/shared/events";
import { z } from "zod";
import { type Adapter, InvalidPayload } from "./adapter";
import { clip, now, summarize } from "./pairing";

const text = z.string().max(100_000);
const id = z.string().min(1).max(200);
const payloadSchema = z.looseObject({
  conversation_id: id,
  hook_event_name: z.string().min(1).max(60),
  model: text.optional(),
  workspace_roots: z.array(text).optional(),
  cwd: text.optional(),
  tool_name: text.optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
  tool_use_id: id.optional(),
  prompt: text.optional(),
  text: text.optional(),
  task: text.optional(),
  summary: text.optional(),
  subagent_id: id.optional(),
  subagent_type: text.optional(),
  subagent_model: text.optional(),
  parent_conversation_id: id.optional(),
  tool_call_id: id.optional(),
});

type Payload = z.infer<typeof payloadSchema>;
type Scope = { sessionId: string; agentId: string; at: string };

// shortcut: both maps grow with every conversation until restart, evict when memory matters
const children = new Map<string, string>();
const titled = new Set<string>();
const open = new Set<string>();

const toolEvents = (p: Payload, { sessionId, agentId, at }: Scope, finish?: boolean): AgentEvent[] => {
  const toolId = p.tool_use_id;
  if (!toolId || !p.tool_name) return [];
  const started: AgentEvent = {
    type: "tool.started",
    sessionId,
    at,
    agentId,
    toolId,
    name: p.tool_name,
    summary: summarize(p.tool_input),
  };
  if (finish === undefined) {
    open.add(toolId);
    return [started];
  }
  const late = open.delete(toolId) ? [] : [started];
  return [...late, { type: "tool.finished", sessionId, at, toolId, ok: finish }];
};

const prompt = (p: Payload, scope: Scope): AgentEvent[] => {
  const body = clip(p.prompt, 1000);
  if (!body) return [];
  const { sessionId, agentId, at } = scope;
  const first = titled.has(sessionId)
    ? []
    : [
        {
          type: "session.started" as const,
          sessionId,
          at,
          harness: "cursor",
          title: clip(p.prompt, 80),
          cwd: p.workspace_roots?.[0],
        },
      ];
  titled.add(sessionId);
  return [...first, { type: "message", sessionId, at, agentId, role: "user", text: body }];
};

const handlers: Record<string, (p: Payload, scope: Scope) => AgentEvent[]> = {
  sessionStart: (p, { sessionId, at }) => {
    titled.add(sessionId);
    return [
      { type: "session.started", sessionId, at, harness: "cursor", cwd: p.workspace_roots?.[0] },
      ...(p.model
        ? [{ type: "agent.started" as const, sessionId, at, agentId: sessionId, name: "main", model: p.model }]
        : []),
    ];
  },
  sessionEnd: (_p, { sessionId, at }) => [{ type: "agent.stopped", sessionId, at, agentId: sessionId }],
  beforeSubmitPrompt: prompt,
  afterAgentResponse: (p, { sessionId, agentId, at }) => {
    const body = clip(p.text, 1000);
    return body ? [{ type: "message", sessionId, at, agentId, role: "assistant", text: body, model: p.model }] : [];
  },
  preToolUse: (p, scope) => toolEvents(p, scope),
  postToolUse: (p, scope) => toolEvents(p, scope, true),
  postToolUseFailure: (p, scope) => toolEvents(p, scope, false),
  subagentStart: (p, { sessionId, at }) => {
    if (!p.subagent_id) return [];
    const agentId = p.subagent_id;
    const task = clip(p.task, 1000);
    return [
      {
        type: "agent.started",
        sessionId,
        at,
        agentId,
        name: clip(p.subagent_type, 120) ?? "agent",
        parentToolId: p.tool_call_id,
        model: p.subagent_model,
      },
      ...(task ? [{ type: "message" as const, sessionId, at, agentId, role: "user" as const, text: task }] : []),
    ];
  },
  subagentStop: (p, { sessionId, agentId, at }) => {
    // why: the payload names no subagent, so it only counts when its conversation is a known child
    if (agentId === sessionId) return [];
    const answer = clip(p.summary, 1000);
    return [
      ...(answer
        ? [{ type: "message" as const, sessionId, at, agentId, role: "assistant" as const, text: answer }]
        : []),
      { type: "agent.stopped", sessionId, at, agentId },
    ];
  },
};

const scopeOf = (p: Payload): Scope => {
  const root = children.get(p.conversation_id);
  return { sessionId: root ?? p.conversation_id, agentId: p.conversation_id, at: now() };
};

export const cursor: Adapter = {
  id: "cursor",
  name: "Cursor",
  harness: "cursor",
  hook(raw) {
    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success) throw new InvalidPayload(parsed.error.issues[0]?.message ?? "Invalid Cursor hook payload");
    const p = parsed.data;
    if (p.hook_event_name === "subagentStart" && p.subagent_id) {
      const parent = p.parent_conversation_id ?? p.conversation_id;
      children.set(p.subagent_id, children.get(parent) ?? parent);
      return handlers.subagentStart(p, {
        sessionId: children.get(p.subagent_id) as string,
        agentId: p.subagent_id,
        at: now(),
      });
    }
    return handlers[p.hook_event_name]?.(p, scopeOf(p)) ?? [];
  },
};
