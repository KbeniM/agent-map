import type { AgentEvent } from "@agent-map/shared/events";
import { z } from "zod";
import type { Adapter } from "./adapter";
import { clip, fifoPairing, handlerFor, isoOf, parseOrThrow, summarize, text } from "./pairing";

const payloadSchema = z.looseObject({
  task_id: z.string().min(1).max(200),
  hook_name: z.string().min(1).max(60),
  timestamp: z.union([z.string(), z.number()]).optional(),
  workspace_roots: z.array(text).optional(),
  pre_tool_use: z
    .looseObject({ tool_name: text.optional(), parameters: z.record(z.string(), z.unknown()).optional() })
    .optional(),
  post_tool_use: z
    .looseObject({
      tool_name: text.optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
      success: z.boolean().optional(),
    })
    .optional(),
  user_prompt_submit: z.looseObject({ prompt: text.optional() }).optional(),
});

// why: Cline may deliver camelCase keys, so every key is folded to snake_case, one level into each data object
const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const fold = (value: unknown, depth: number): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      snake(key),
      depth > 0 && key !== "parameters" ? fold(inner, depth - 1) : inner,
    ]),
  );
};

type Payload = z.infer<typeof payloadSchema>;

// shortcut: the titled set grows with every task until restart, evict when memory matters
const titled = new Set<string>();
const pairing = fifoPairing();

const stopped = (sessionId: string, at: string): AgentEvent[] => [
  { type: "agent.stopped", sessionId, at, agentId: sessionId },
];

const handlers: Record<string, (p: Payload, sessionId: string, at: string) => AgentEvent[]> = {
  task_start: (p, sessionId, at) => {
    titled.add(sessionId);
    return [{ type: "session.started", sessionId, at, harness: "cline", cwd: p.workspace_roots?.[0] }];
  },
  user_prompt_submit: (p, sessionId, at) => {
    const body = clip(p.user_prompt_submit?.prompt, 1000);
    if (!body) return [];
    const first: AgentEvent[] = titled.has(sessionId)
      ? []
      : [
          {
            type: "session.started",
            sessionId,
            at,
            harness: "cline",
            title: body.slice(0, 80),
            cwd: p.workspace_roots?.[0],
          },
        ];
    titled.add(sessionId);
    return [...first, { type: "message", sessionId, at, agentId: sessionId, role: "user", text: body }];
  },
  pre_tool_use: (p, sessionId, at) => {
    const name = p.pre_tool_use?.tool_name;
    if (!name) return [];
    const toolId = pairing.start(sessionId, name);
    return [
      {
        type: "tool.started",
        sessionId,
        at,
        agentId: sessionId,
        toolId,
        name,
        summary: summarize(p.pre_tool_use?.parameters),
      },
    ];
  },
  post_tool_use: (p, sessionId, at) => {
    const name = p.post_tool_use?.tool_name;
    const toolId = name ? pairing.finish(sessionId, name) : undefined;
    return toolId ? [{ type: "tool.finished", sessionId, at, toolId, ok: p.post_tool_use?.success !== false }] : [];
  },
  task_complete: (_p, sessionId, at) => stopped(sessionId, at),
  task_cancel: (_p, sessionId, at) => stopped(sessionId, at),
};

export const cline: Adapter = {
  id: "cline",
  name: "Cline",
  harness: "cline",
  hook(raw) {
    const p = parseOrThrow(payloadSchema, fold(raw, 1), "Invalid Cline hook payload");
    return handlerFor(handlers, snake(p.hook_name))?.(p, p.task_id, isoOf(Number(p.timestamp))) ?? [];
  },
};
