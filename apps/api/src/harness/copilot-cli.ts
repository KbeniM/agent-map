import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@rancher/shared/events";
import { z } from "zod";
import { type Adapter, type FileSource, InvalidPayload } from "./adapter";
import { clip, fifoPairing, isoOf, now, summarize } from "./pairing";

const text = z.string().max(100_000);
const id = z.string().min(1).max(200);
const payloadSchema = z.looseObject({
  sessionId: id,
  hookEvent: z.string().min(1).max(60),
  timestamp: z.number().optional(),
  cwd: text.optional(),
  initialPrompt: text.optional(),
  prompt: text.optional(),
  toolName: text.optional(),
  toolArgs: z.unknown().optional(),
  toolResult: z.looseObject({ resultType: z.string().optional() }).optional(),
  agentId: id.optional(),
  parentAgentId: id.optional(),
  agentName: text.optional(),
  response: text.optional(),
});

type Payload = z.infer<typeof payloadSchema>;
type Scope = { sessionId: string; agentId: string; at: string };

// shortcut: the titled set grows with every session until restart, evict when memory matters
const titled = new Set<string>();
const pairing = fifoPairing();

const argsSummary = (args: unknown) => {
  const value = typeof args === "string" ? (parseObject(args) ?? args) : args;
  if (typeof value === "string") return value.split("\n")[0].slice(0, 120) || undefined;
  return value && typeof value === "object" && !Array.isArray(value)
    ? summarize(value as Record<string, unknown>)
    : undefined;
};

function parseObject(raw: string) {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? value : undefined;
  } catch {
    return undefined;
  }
}

const sessionStarted = (p: Payload, { sessionId, at }: Scope, title: string | undefined): AgentEvent[] => {
  if (titled.has(sessionId) && !title) return [];
  titled.add(sessionId);
  return [{ type: "session.started", sessionId, at, harness: "copilot-cli", cwd: p.cwd, title: title?.slice(0, 80) }];
};

const finish = (p: Payload, { sessionId, at }: Scope, ok: boolean): AgentEvent[] => {
  const toolId = p.toolName ? pairing.finish(sessionId, p.toolName) : undefined;
  return toolId ? [{ type: "tool.finished", sessionId, at, toolId, ok }] : [];
};

const handlers: Record<string, (p: Payload, scope: Scope) => AgentEvent[]> = {
  sessionStart: (p, scope) => sessionStarted(p, scope, clip(p.initialPrompt, 80)),
  sessionEnd: (_p, { sessionId, at }) => [{ type: "agent.stopped", sessionId, at, agentId: sessionId }],
  userPromptSubmitted: (p, scope) => {
    const body = clip(p.prompt, 1000);
    if (!body) return [];
    const { sessionId, agentId, at } = scope;
    const title = titled.has(sessionId) ? undefined : body;
    return [...sessionStarted(p, scope, title), { type: "message", sessionId, at, agentId, role: "user", text: body }];
  },
  preToolUse: (p, { sessionId, agentId, at }) => {
    if (!p.toolName) return [];
    const toolId = pairing.start(sessionId, p.toolName);
    return [
      { type: "tool.started", sessionId, at, agentId, toolId, name: p.toolName, summary: argsSummary(p.toolArgs) },
    ];
  },
  postToolUse: (p, scope) => finish(p, scope, !p.toolResult?.resultType || p.toolResult.resultType === "success"),
  postToolUseFailure: (p, scope) => finish(p, scope, false),
  subagentStart: (p, { sessionId, at }) => {
    const agentId = p.agentId ?? p.agentName;
    if (!agentId) return [];
    return [
      {
        type: "agent.started",
        sessionId,
        at,
        agentId,
        name: clip(p.agentName, 120) ?? "agent",
        parentAgentId: p.parentAgentId,
      },
    ];
  },
  subagentStop: (p, { sessionId, at }) => {
    const agentId = p.agentId ?? p.agentName;
    if (!agentId) return [];
    const answer = clip(p.response, 1000);
    return [
      ...(answer
        ? [{ type: "message" as const, sessionId, at, agentId, role: "assistant" as const, text: answer }]
        : []),
      { type: "agent.stopped", sessionId, at, agentId },
    ];
  },
};

const stamp = (timestamp: number | undefined) => {
  const date = timestamp === undefined ? undefined : new Date(timestamp);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : now();
};

type FileState = { sessionId: string; titled: boolean; model?: string; cwd?: string };

const lineSchema = z.object({
  type: z.string(),
  timestamp: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export function parseCopilotTranscript(raw: string, state: FileState): AgentEvent[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  const parsed = lineSchema.safeParse(value);
  if (!parsed.success) return [];
  const { type, timestamp, data = {} } = parsed.data;
  const at = isoOf(timestamp);

  if (type === "session.start") {
    if (typeof data.sessionId === "string" && data.sessionId) state.sessionId = data.sessionId.slice(0, 200);
    const ctx = data.context as { cwd?: unknown } | undefined;
    state.cwd = clip(ctx?.cwd, 500) ?? state.cwd;
    return [
      {
        type: "session.started",
        sessionId: state.sessionId,
        at: isoOf(typeof data.startTime === "string" ? data.startTime : timestamp),
        harness: "copilot-cli",
        cwd: state.cwd,
      },
    ];
  }

  if (type === "user.message") {
    const body = clip(data.content, 1000);
    if (!body) return [];
    const title = state.titled ? undefined : body.split("\n")[0].slice(0, 80);
    state.titled = true;
    return [
      ...(title
        ? [
            {
              type: "session.started" as const,
              sessionId: state.sessionId,
              at,
              harness: "copilot-cli",
              cwd: state.cwd,
              title,
            },
          ]
        : []),
      { type: "message", sessionId: state.sessionId, at, agentId: state.sessionId, role: "user", text: body },
    ];
  }

  if (type === "assistant.message") {
    const body = clip(data.content, 1000);
    return body
      ? [
          {
            type: "message",
            sessionId: state.sessionId,
            at,
            agentId: state.sessionId,
            role: "assistant",
            text: body,
            model: state.model,
          },
        ]
      : [];
  }

  if (type === "tool.execution_start") {
    const toolId = typeof data.toolCallId === "string" ? data.toolCallId.slice(0, 200) : undefined;
    const name = clip(data.toolName, 120);
    if (!toolId || !name) return [];
    return [
      {
        type: "tool.started",
        sessionId: state.sessionId,
        at,
        agentId: state.sessionId,
        toolId,
        name,
        summary: argsSummary(data.arguments),
      },
    ];
  }

  if (type === "tool.execution_complete") {
    state.model = clip(data.model, 120) ?? state.model;
    const toolId = typeof data.toolCallId === "string" ? data.toolCallId.slice(0, 200) : undefined;
    return toolId
      ? [{ type: "tool.finished", sessionId: state.sessionId, at, toolId, ok: data.success !== false }]
      : [];
  }

  if (type === "subagent.started") {
    const toolId = typeof data.toolCallId === "string" ? data.toolCallId.slice(0, 200) : undefined;
    const name = clip(data.agentDisplayName ?? data.agentName, 120);
    if (!toolId || !name) return [];
    return [
      {
        type: "agent.started",
        sessionId: state.sessionId,
        at,
        agentId: toolId,
        name,
        parentToolId: toolId,
      },
    ];
  }

  if (type === "subagent.completed") {
    state.model = clip(data.model, 120) ?? state.model;
    const toolId = typeof data.toolCallId === "string" ? data.toolCallId.slice(0, 200) : undefined;
    return toolId ? [{ type: "agent.stopped", sessionId: state.sessionId, at, agentId: toolId }] : [];
  }

  return [];
}

const transcripts: FileSource<FileState> = {
  defaultPath: join(homedir(), ".copilot", "session-state"),
  globs: ["*/events.jsonl"],
  mode: "append",
  open(relative) {
    const sessionId = relative.split("/")[0] || relative;
    return { state: { sessionId, titled: false } };
  },
  parse: (chunk, state) => chunk.split("\n").flatMap((line) => (line ? parseCopilotTranscript(line, state) : [])),
};

export const copilotCli: Adapter = {
  id: "copilot-cli",
  name: "GitHub Copilot CLI",
  harness: "copilot-cli",
  files: transcripts,
  hook(raw) {
    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success)
      throw new InvalidPayload(parsed.error.issues[0]?.message ?? "Invalid Copilot CLI hook payload");
    const p = parsed.data;
    const scope = { sessionId: p.sessionId, agentId: p.agentId ?? p.sessionId, at: stamp(p.timestamp) };
    return handlers[p.hookEvent]?.(p, scope) ?? [];
  },
};
