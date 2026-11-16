import type { AgentEvent } from "@agent-map/shared/events";
import { z } from "zod";
import type { Adapter } from "./adapter";
import { clip, fifoPairing, handlerFor, hookShape, isoOf, parseOrThrow, summarize, text } from "./pairing";

const payloadSchema = z.looseObject({
  ...hookShape,
  timestamp: z.string().optional(),
  prompt: text.optional(),
  prompt_response: text.optional(),
  tool_name: text.optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
  tool_response: z.looseObject({ error: z.unknown().optional() }).optional(),
  llm_request: z.looseObject({ model: z.string().max(120).optional() }).optional(),
});

type Payload = z.infer<typeof payloadSchema>;

const geminiParser = () => {
  const pairing = fifoPairing();
  const titled = new Set<string>();
  // shortcut: one model per session, a mid-session switch shows on the next BeforeModel; the map keeps every session until restart
  const models = new Map<string, string>();

  const handlers: Record<string, (p: Payload, at: string) => AgentEvent[]> = {
    SessionStart: (p, at) => [
      { type: "session.started", sessionId: p.session_id, at, harness: "gemini-cli", cwd: p.cwd },
    ],
    BeforeModel: (p, at) => {
      const model = p.llm_request?.model;
      if (!model || models.get(p.session_id) === model) return [];
      models.set(p.session_id, model);
      return [{ type: "agent.started", sessionId: p.session_id, at, agentId: p.session_id, name: "main", model }];
    },
    BeforeAgent: (p, at) => {
      const prompt = clip(p.prompt, 1000);
      if (!prompt) return [];
      const title = titled.has(p.session_id) ? undefined : prompt.split("\n")[0].slice(0, 80);
      titled.add(p.session_id);
      return [
        ...(title
          ? [
              {
                type: "session.started" as const,
                sessionId: p.session_id,
                at,
                harness: "gemini-cli",
                cwd: p.cwd,
                title,
              },
            ]
          : []),
        { type: "message", sessionId: p.session_id, at, agentId: p.session_id, role: "user", text: prompt },
      ];
    },
    AfterAgent: (p, at) => {
      const answer = clip(p.prompt_response, 1000);
      return answer
        ? [
            {
              type: "message",
              sessionId: p.session_id,
              at,
              agentId: p.session_id,
              role: "assistant",
              text: answer,
              model: models.get(p.session_id),
            },
          ]
        : [];
    },
    BeforeTool: (p, at) =>
      p.tool_name
        ? [
            {
              type: "tool.started",
              sessionId: p.session_id,
              at,
              agentId: p.session_id,
              toolId: pairing.start(p.session_id, p.tool_name),
              name: p.tool_name,
              summary: summarize(p.tool_input),
            },
          ]
        : [],
    AfterTool: (p, at) => {
      const toolId = p.tool_name ? pairing.finish(p.session_id, p.tool_name) : undefined;
      return toolId
        ? [{ type: "tool.finished", sessionId: p.session_id, at, toolId, ok: !p.tool_response?.error }]
        : [];
    },
    SessionEnd: (p, at) => {
      titled.delete(p.session_id);
      models.delete(p.session_id);
      return [{ type: "agent.stopped", sessionId: p.session_id, at, agentId: p.session_id }];
    },
  };

  return (raw: unknown): AgentEvent[] => {
    const payload = parseOrThrow(payloadSchema, raw, "Invalid hook payload");
    const handler = handlerFor(handlers, payload.hook_event_name);
    return handler ? handler(payload, isoOf(payload.timestamp)) : [];
  };
};

export const geminiCli: Adapter = { id: "gemini-cli", name: "Gemini CLI", harness: "gemini-cli", hook: geminiParser() };
