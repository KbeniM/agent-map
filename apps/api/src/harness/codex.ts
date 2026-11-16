import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@rancher/shared/events";
import { z } from "zod";
import type { Adapter, FileSource } from "./adapter";
import { hookParser } from "./hooks";
import { clip, summarize } from "./pairing";

type State = { sessionId: string; agentId: string; titled: boolean; model?: string };

const record = z.record(z.string(), z.unknown());
const lineSchema = z.object({ timestamp: z.string(), type: z.string(), payload: record });
const spawnSchema = z.object({
  parent_thread_id: z.string().optional(),
  agent_role: z.string().optional(),
  agent_nickname: z.string().optional(),
});

const EXIT = /Process exited with code (\d+)/;
const TOOL_CALLS = new Set(["function_call", "custom_tool_call", "local_shell_call"]);
const TOOL_OUTPUTS = new Set(["function_call_output", "custom_tool_call_output"]);

function argumentsOf(payload: Record<string, unknown>) {
  if (typeof payload.input === "string") return { input: payload.input.split("\n")[0] };
  const action = payload.action as { command?: string[] } | undefined;
  if (action?.command) return { command: action.command.join(" ") };
  try {
    return JSON.parse(String(payload.arguments ?? "{}")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// why: the rollout stores tool output as text only, so a nonzero exit line is the one failure signal
const succeeded = (output: unknown) => {
  const code = typeof output === "string" ? EXIT.exec(output)?.[1] : undefined;
  return code === undefined || code === "0";
};

function sessionMeta(payload: Record<string, unknown>, state: State, at: string): AgentEvent[] {
  const id = String(payload.id ?? state.agentId);
  const root = String(payload.session_id ?? id);
  const source = payload.source as { subagent?: { thread_spawn?: unknown } } | undefined;
  const spawn = spawnSchema.safeParse(source?.subagent?.thread_spawn);
  state.sessionId = root;
  state.agentId = id;
  if (root === id)
    return [{ type: "session.started", sessionId: root, at, harness: "codex", cwd: clip(payload.cwd, 500) }];
  const name = spawn.data?.agent_role ?? spawn.data?.agent_nickname ?? "agent";
  return [
    { type: "agent.started", sessionId: root, at, agentId: id, name, parentAgentId: spawn.data?.parent_thread_id },
  ];
}

function eventMessage(payload: Record<string, unknown>, state: State, at: string): AgentEvent[] {
  const { sessionId, agentId } = state;
  const text = clip(payload.message, 1000);
  if (payload.type === "user_message" && text) {
    const title = !state.titled && agentId === sessionId ? text.split("\n")[0].slice(0, 80) : undefined;
    state.titled ||= Boolean(title);
    return [
      ...(title ? [{ type: "session.started" as const, sessionId, at, harness: "codex", title }] : []),
      { type: "message", sessionId, at, agentId, role: "user", text },
    ];
  }
  if (payload.type === "agent_message" && text)
    return [{ type: "message", sessionId, at, agentId, role: "assistant", text, model: state.model }];
  if (payload.type === "patch_apply_end" && typeof payload.call_id === "string") {
    return [{ type: "tool.finished", sessionId, at, toolId: payload.call_id, ok: payload.success !== false }];
  }
  return [];
}

function responseItem(payload: Record<string, unknown>, state: State, at: string): AgentEvent[] {
  const callId = typeof payload.call_id === "string" ? payload.call_id : undefined;
  if (!callId) return [];
  const { sessionId, agentId } = state;
  if (TOOL_CALLS.has(String(payload.type))) {
    const name = String(payload.name ?? (payload.type === "local_shell_call" ? "shell" : payload.type));
    return [
      { type: "tool.started", sessionId, at, agentId, toolId: callId, name, summary: summarize(argumentsOf(payload)) },
    ];
  }
  if (TOOL_OUTPUTS.has(String(payload.type)))
    return [{ type: "tool.finished", sessionId, at, toolId: callId, ok: succeeded(payload.output) }];
  return [];
}

export function parseRollout(raw: string, state: State): AgentEvent[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  const line = lineSchema.safeParse(value);
  if (!line.success) return [];
  const { type, payload, timestamp: at } = line.data;
  if (type === "session_meta") return sessionMeta(payload, state, at);
  if (type === "turn_context") {
    state.model = clip(payload.model, 120) ?? state.model;
    return [];
  }
  if (type === "event_msg") return eventMessage(payload, state, at);
  if (type === "response_item") return responseItem(payload, state, at);
  return [];
}

const ROLLOUT = /rollout-[^/]*?([0-9a-f]{8}-[0-9a-f-]{27})\.jsonl$/;

const rollouts: FileSource<State> = {
  defaultPath: join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions"),
  globs: ["*/*/*/rollout-*.jsonl"],
  mode: "append",
  open(relative) {
    const id = ROLLOUT.exec(relative)?.[1] ?? relative;
    return { state: { sessionId: id, agentId: id, titled: false } };
  },
  parse: (text, state) => text.split("\n").flatMap((line) => (line ? parseRollout(line, state) : [])),
};

export const codex: Adapter = {
  id: "codex",
  name: "Codex",
  harness: "codex",
  files: rollouts,
  hook: hookParser("codex"),
};
