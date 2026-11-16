import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@agent-map/shared/events";
import type { Adapter, FileSource } from "./adapter";
import { hookParser } from "./hooks";
import { summarize } from "./pairing";

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
  message?: { content?: string | Block[]; model?: string };
};

export type Cursor = { sessionId: string; agentId: string; started: boolean };

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

const MESSAGE_MAX = 1000;
const HANDBACK = "SubagentHandback";

function message(line: Line, { sessionId, agentId }: Cursor, at: string): AgentEvent[] {
  const content = line.message?.content;
  const blocks = typeof content === "string" ? [{ type: "text", text: content }] : (content ?? []);
  const role = line.type === "assistant" ? "assistant" : "user";
  const handback = blocks.find((block) => block.name === HANDBACK)?.input?.message;
  const texts = blocks.filter((block) => block.type === "text").map((block) => block.text ?? "");
  // why: system reminders and command echoes arrive as user text wrapped in tags, they are not messages
  const text = [...texts, typeof handback === "string" ? handback : ""]
    .filter((value) => value.trim() && !value.startsWith("<"))
    .join("\n")
    .trim();
  if (line.isMeta || !text) return [];
  const model = role === "assistant" ? line.message?.model : undefined;
  return [{ type: "message", sessionId, at, agentId, role, text: text.slice(0, MESSAGE_MAX), model }];
}

// why: a subagent's hand-back call ends its run, so no tool_result ever follows it in the transcript
function handback(blocks: Block[], { sessionId, agentId }: Cursor, at: string): AgentEvent[] {
  const call = blocks.find((block) => block.type === "tool_use" && block.name === HANDBACK && block.id);
  if (!call?.id) return [];
  return [
    { type: "tool.finished", sessionId, at, toolId: call.id, ok: true },
    { type: "agent.stopped", sessionId, at, agentId },
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
  return [...opening(line, cursor, at), ...message(line, cursor, at), ...tools, ...handback(blocks, cursor, at)];
}

type SubagentMeta = { agentType?: string; description?: string; toolUseId?: string };

const MAIN = /^[^/]+\/([^/]+)\.jsonl$/;
const SUBAGENT = /^[^/]+\/([^/]+)\/subagents\/agent-([^/]+)\.jsonl$/;

async function readMeta(path: string): Promise<SubagentMeta> {
  const file = Bun.file(path.replace(/\.jsonl$/, ".meta.json"));
  return (await file.exists()) ? file.json().catch(() => ({})) : {};
}

const transcripts: FileSource<Cursor> = {
  defaultPath: join(homedir(), ".claude", "projects"),
  // why: main transcripts scan first, so a subagent's spawning tool call is known before the subagent
  globs: ["*/*.jsonl", "*/*/subagents/agent-*.jsonl"],
  mode: "append",
  async open(relative, absolute, mtime) {
    const main = MAIN.exec(relative);
    if (main) return { state: { sessionId: main[1], agentId: main[1], started: false } };
    const sub = SUBAGENT.exec(relative);
    if (!sub) return undefined;
    const meta = await readMeta(absolute);
    const state = { sessionId: sub[1], agentId: sub[2], started: true };
    const started: AgentEvent = {
      type: "agent.started",
      sessionId: state.sessionId,
      agentId: state.agentId,
      at: mtime.toISOString(),
      name: meta.agentType || "agent",
      parentToolId: meta.toolUseId,
    };
    return { state, events: [started] };
  },
  parse: (text, state) => text.split("\n").flatMap((line) => (line ? parseLine(line, state) : [])),
};

export const claudeCode: Adapter = {
  id: "claude-code",
  name: "Claude Code",
  harness: "claude-code",
  files: transcripts,
  hook: hookParser("claude-code"),
};
