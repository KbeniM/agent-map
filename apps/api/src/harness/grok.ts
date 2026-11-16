import type { AgentEvent } from "@rancher/shared/events";
import { z } from "zod";
import type { Adapter } from "./adapter";
import { clip, handlerFor, isoOf, parseOrThrow, summarize, text } from "./pairing";

const payloadSchema = z.looseObject({
  hookEventName: z.string().min(1).max(60),
  sessionId: z.string().min(1).max(200),
  cwd: text.optional(),
  workspaceRoot: text.optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  prompt: text.optional(),
  lastAssistantMessage: text.optional(),
  toolName: text.optional(),
  toolUseId: z.string().max(200).optional(),
  toolInput: z.record(z.string(), z.unknown()).optional(),
  agentId: z.string().min(1).max(200).optional(),
  agentType: text.optional(),
  agentName: text.optional(),
});

type Payload = z.infer<typeof payloadSchema>;

const grokParser = () => {
  const titled = new Set<string>();

  const finished = (p: Payload, at: string, ok: boolean): AgentEvent[] =>
    p.toolUseId ? [{ type: "tool.finished", sessionId: p.sessionId, at, toolId: p.toolUseId, ok }] : [];

  const handlers: Record<string, (p: Payload, at: string, agentId: string) => AgentEvent[]> = {
    SessionStart: (p, at) => [
      { type: "session.started", sessionId: p.sessionId, at, harness: "grok", cwd: p.cwd ?? p.workspaceRoot },
    ],
    UserPromptSubmit: (p, at, agentId) => {
      const prompt = clip(p.prompt, 1000);
      if (!prompt) return [];
      const title = titled.has(p.sessionId) ? undefined : prompt.split("\n")[0].slice(0, 80);
      titled.add(p.sessionId);
      return [
        ...(title
          ? [
              {
                type: "session.started" as const,
                sessionId: p.sessionId,
                at,
                harness: "grok",
                cwd: p.cwd ?? p.workspaceRoot,
                title,
              },
            ]
          : []),
        { type: "message", sessionId: p.sessionId, at, agentId, role: "user", text: prompt },
      ];
    },
    PreToolUse: (p, at, agentId) =>
      p.toolUseId && p.toolName
        ? [
            {
              type: "tool.started",
              sessionId: p.sessionId,
              at,
              agentId,
              toolId: p.toolUseId,
              name: p.toolName,
              summary: summarize(p.toolInput),
            },
          ]
        : [],
    PostToolUse: (p, at) => finished(p, at, true),
    PostToolUseFailure: (p, at) => finished(p, at, false),
    SubagentStart: (p, at) =>
      p.agentId
        ? [
            {
              type: "agent.started",
              sessionId: p.sessionId,
              at,
              agentId: p.agentId,
              name: clip(p.agentType ?? p.agentName, 120) ?? "agent",
            },
          ]
        : [],
    SubagentStop: (p, at) =>
      p.agentId ? [{ type: "agent.stopped", sessionId: p.sessionId, at, agentId: p.agentId }] : [],
    Stop: (p, at, agentId) => {
      const answer = clip(p.lastAssistantMessage, 1000);
      return answer ? [{ type: "message", sessionId: p.sessionId, at, agentId, role: "assistant", text: answer }] : [];
    },
    SessionEnd: (p, at) => [{ type: "agent.stopped", sessionId: p.sessionId, at, agentId: p.sessionId }],
  };

  return (raw: unknown): AgentEvent[] => {
    const payload = parseOrThrow(payloadSchema, raw, "Invalid hook payload");
    const handler = handlerFor(handlers, payload.hookEventName);
    const agentId = payload.hookEventName.startsWith("Subagent")
      ? payload.sessionId
      : (payload.agentId ?? payload.sessionId);
    return handler ? handler(payload, isoOf(payload.timestamp), agentId) : [];
  };
};

export const grok: Adapter = { id: "grok", name: "Grok Build", harness: "grok", hook: grokParser() };
