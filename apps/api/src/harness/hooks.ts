import type { AgentEvent } from "@rancher/shared/events";
import { z } from "zod";
import { clip, hookShape, parseOrThrow, summarize, text } from "./pairing";

const payloadSchema = z.looseObject({
  ...hookShape,
  model: text.optional(),
  agent_id: z.string().max(200).optional(),
  agent_type: text.optional(),
  tool_name: text.optional(),
  tool_use_id: z.string().max(200).optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
  prompt: text.optional(),
  last_assistant_message: text.optional(),
  session_title: text.optional(),
});

type Payload = z.infer<typeof payloadSchema>;
type Pending = { tools: string[]; seen: Set<string> };

const SPAWN = /^(agent|task|spawn_agent)$/i;
// why: hook payloads name subagents "agent-<id>" while transcript files use the bare id
const agentKey = (id: string) => id.replace(/^agent-/, "");

// why: Claude Code and Codex hooks share one payload shape, only the harness name differs
export function hookParser(harness: string) {
  // shortcut: a SubagentStart names no spawning tool call, so it takes the oldest open spawn call; exact once hooks send the id
  const pending = new Map<string, Pending>();
  const sessionState = (id: string) => {
    const state = pending.get(id) ?? { tools: [], seen: new Set<string>() };
    pending.set(id, state);
    return state;
  };

  const handlers: Record<string, (payload: Payload, at: string, agentId: string) => AgentEvent[]> = {
    SessionStart: (p, at) => [
      { type: "session.started", sessionId: p.session_id, at, harness, cwd: p.cwd, title: clip(p.session_title, 200) },
      ...(p.model
        ? [
            {
              type: "agent.started" as const,
              sessionId: p.session_id,
              at,
              agentId: p.session_id,
              name: "main",
              model: p.model,
            },
          ]
        : []),
    ],
    UserPromptSubmit: (p, at, agentId) => {
      const prompt = clip(p.prompt, 1000);
      return prompt
        ? [{ type: "message", sessionId: p.session_id, at, agentId, role: "user", text: prompt, model: undefined }]
        : [];
    },
    PreToolUse: (p, at, agentId) => {
      if (!p.tool_use_id || !p.tool_name) return [];
      if (SPAWN.test(p.tool_name)) sessionState(p.session_id).tools.push(p.tool_use_id);
      const summary = summarize(p.tool_input);
      return [
        {
          type: "tool.started",
          sessionId: p.session_id,
          at,
          agentId,
          toolId: p.tool_use_id,
          name: p.tool_name,
          summary,
        },
      ];
    },
    PostToolUse: (p, at) =>
      p.tool_use_id ? [{ type: "tool.finished", sessionId: p.session_id, at, toolId: p.tool_use_id, ok: true }] : [],
    PostToolUseFailure: (p, at) =>
      p.tool_use_id ? [{ type: "tool.finished", sessionId: p.session_id, at, toolId: p.tool_use_id, ok: false }] : [],
    SubagentStart: (p, at) => {
      if (!p.agent_id) return [];
      const state = sessionState(p.session_id);
      const agentId = agentKey(p.agent_id);
      if (state.seen.has(agentId)) return [];
      state.seen.add(agentId);
      const name = clip(p.agent_type, 120) ?? "agent";
      return [
        {
          type: "agent.started",
          sessionId: p.session_id,
          at,
          agentId,
          name,
          parentToolId: state.tools.shift(),
          model: p.model,
        },
      ];
    },
    SubagentStop: (p, at) => {
      if (!p.agent_id) return [];
      const agentId = agentKey(p.agent_id);
      const answer = clip(p.last_assistant_message, 1000);
      return [
        ...(answer
          ? [
              {
                type: "message" as const,
                sessionId: p.session_id,
                at,
                agentId,
                role: "assistant" as const,
                text: answer,
              },
            ]
          : []),
        { type: "agent.stopped", sessionId: p.session_id, at, agentId },
      ];
    },
    Stop: (p, at, agentId) => {
      const answer = clip(p.last_assistant_message, 1000);
      return answer
        ? [{ type: "message", sessionId: p.session_id, at, agentId, role: "assistant", text: answer, model: p.model }]
        : [];
    },
    SessionEnd: (p, at) => [{ type: "agent.stopped", sessionId: p.session_id, at, agentId: p.session_id }],
  };

  return (raw: unknown): AgentEvent[] => {
    const payload = parseOrThrow(payloadSchema, raw, "Invalid hook payload");
    const handler = handlers[payload.hook_event_name];
    const agentId = payload.agent_id ? agentKey(payload.agent_id) : payload.session_id;
    return handler ? handler(payload, new Date().toISOString(), agentId) : [];
  };
}
