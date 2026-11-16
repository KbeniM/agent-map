import type { AgentEvent } from "@agent-map/shared/events";
import { z } from "zod";
import { type Adapter, InvalidPayload } from "./adapter";
import { clip, handlerFor, now, parseOrThrow, summarize, text } from "./pairing";

const name = z.string().min(1).max(60).optional();
const payloadSchema = z.looseObject({
  conversationId: z.string().min(1).max(200),
  hookEvent: name,
  hookEventName: name,
  hook_event_name: name,
  event: name,
  workspacePaths: z.array(text).optional(),
  modelName: z.string().max(120).optional(),
  lastUserInput: text.optional(),
  stepIdx: z.number().optional(),
  error: z.unknown().optional(),
  toolCall: z.looseObject({ name: text.optional(), args: z.record(z.string(), z.unknown()).optional() }).optional(),
});

type Payload = z.infer<typeof payloadSchema>;

const PASCAL_KEYS = ["CommandLine", "AbsolutePath", "TargetFile", "SearchPath", "Query", "Url", "Pattern"];

// why: Antigravity tool args use PascalCase keys that the shared summarize does not know
const summary = (args: Record<string, unknown> | undefined) => {
  const key = PASCAL_KEYS.find((candidate) => typeof args?.[candidate] === "string");
  return (key ? String(args?.[key]).split("\n")[0].slice(0, 120) : undefined) ?? summarize(args);
};

const antigravityParser = () => {
  const lastInput = new Map<string, string>();
  const titled = new Set<string>();

  const toolId = (p: Payload) => (p.stepIdx === undefined ? undefined : `${p.conversationId}:${p.stepIdx}`);

  const handlers: Record<string, (p: Payload, at: string) => AgentEvent[]> = {
    SessionStart: (p, at) => [
      { type: "session.started", sessionId: p.conversationId, at, harness: "antigravity", cwd: p.workspacePaths?.[0] },
      {
        type: "agent.started",
        sessionId: p.conversationId,
        at,
        agentId: p.conversationId,
        name: "main",
        model: p.modelName,
      },
    ],
    PreInvocation: (p, at) => {
      const input = clip(p.lastUserInput, 1000);
      if (!input || lastInput.get(p.conversationId) === input) return [];
      lastInput.set(p.conversationId, input);
      const title = titled.has(p.conversationId) ? undefined : input.split("\n")[0].slice(0, 80);
      titled.add(p.conversationId);
      return [
        ...(title
          ? [
              {
                type: "session.started" as const,
                sessionId: p.conversationId,
                at,
                harness: "antigravity",
                cwd: p.workspacePaths?.[0],
                title,
              },
            ]
          : []),
        { type: "message", sessionId: p.conversationId, at, agentId: p.conversationId, role: "user", text: input },
      ];
    },
    PreToolUse: (p, at) => {
      const id = toolId(p);
      const tool = p.toolCall?.name;
      return id && tool
        ? [
            {
              type: "tool.started",
              sessionId: p.conversationId,
              at,
              agentId: p.conversationId,
              toolId: id,
              name: tool,
              summary: summary(p.toolCall?.args),
            },
          ]
        : [];
    },
    PostToolUse: (p, at) => {
      const id = toolId(p);
      return id ? [{ type: "tool.finished", sessionId: p.conversationId, at, toolId: id, ok: !p.error }] : [];
    },
  };

  return (raw: unknown): AgentEvent[] => {
    const payload = parseOrThrow(payloadSchema, raw, "Invalid hook payload");
    const event = payload.hookEvent ?? payload.hookEventName ?? payload.hook_event_name ?? payload.event;
    if (!event) throw new InvalidPayload("Missing hook event name");
    const handler = handlerFor(handlers, event);
    return handler ? handler(payload, now()) : [];
  };
};

export const antigravity: Adapter = {
  id: "antigravity",
  name: "Antigravity",
  harness: "antigravity",
  hook: antigravityParser(),
};
