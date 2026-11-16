import type { AgentEvent } from "@agent-map/shared/events";

type Block = {
  type?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
  text?: string;
};
type Line = {
  type?: string;
  timestamp?: string;
  cwd?: string;
  isMeta?: boolean;
  message?: { content?: string | Block[] };
};

export type Cursor = { sessionId: string; agentId: string; started: boolean };

const SUMMARY_KEYS = ["description", "file_path", "pattern", "command", "url", "query", "prompt", "skill"];

// why: only one short field of the tool input leaves the bridge, never the full input or output
export function summarize(input: Record<string, unknown> | undefined) {
  const key = SUMMARY_KEYS.find((name) => typeof input?.[name] === "string");
  const value = key ? String(input?.[key]) : undefined;
  return value?.split("\n")[0].slice(0, 120);
}

const promptText = (content: string | Block[] | undefined) => {
  const text = typeof content === "string" ? content : content?.find((block) => block.type === "text")?.text;
  return text && !text.startsWith("<") ? text.split("\n")[0].slice(0, 80) : undefined;
};

function opening(line: Line, cursor: Cursor, at: string): AgentEvent[] {
  if (cursor.started || line.type !== "user" || line.isMeta) return [];
  const title = promptText(line.message?.content);
  if (!title) return [];
  cursor.started = true;
  const { sessionId, agentId } = cursor;
  return [
    agentId === sessionId
      ? { type: "session.started", sessionId, at, harness: "claude-code", title, cwd: line.cwd }
      : { type: "agent.started", sessionId, at, agentId, name: "agent" },
  ];
}

function blockEvent(block: Block, { sessionId, agentId }: Cursor, at: string): AgentEvent | undefined {
  if (block.type === "tool_use" && block.id && block.name) {
    return {
      type: "tool.started",
      sessionId,
      at,
      agentId,
      toolId: block.id,
      name: block.name,
      summary: summarize(block.input),
    };
  }
  if (block.type === "tool_result" && block.tool_use_id) {
    return { type: "tool.finished", sessionId, at, toolId: block.tool_use_id, ok: !block.is_error };
  }
}

export function parseLine(raw: string, cursor: Cursor): AgentEvent[] {
  let line: Line;
  try {
    line = JSON.parse(raw);
  } catch {
    return [];
  }
  const at = line.timestamp;
  if (!at || (line.type !== "user" && line.type !== "assistant")) return [];
  const content = line.message?.content;
  const blocks = Array.isArray(content) ? content : [];
  const tools = blocks.map((block) => blockEvent(block, cursor, at)).filter((event) => event !== undefined);
  return [...opening(line, cursor, at), ...tools];
}

export type SubagentMeta = { agentType?: string; description?: string; toolUseId?: string };

export const subagentStarted = (cursor: Cursor, meta: SubagentMeta, at: string): AgentEvent => ({
  type: "agent.started",
  sessionId: cursor.sessionId,
  agentId: cursor.agentId,
  at,
  name: meta.agentType || "agent",
  parentToolId: meta.toolUseId,
});
