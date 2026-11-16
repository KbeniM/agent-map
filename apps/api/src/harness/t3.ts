import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@rancher/shared/events";
import type { Adapter, FileSource } from "./adapter";
import { clip, summarize } from "./pairing";

type State = { sinceHours: number; emitted: Set<string> };

type ThreadRow = {
  thread_id: string;
  project_id: string | null;
  title: string | null;
  default_provider: string | null;
  created_at: string;
  updated_at: string;
};

type SubagentRow = {
  subagent_id: string;
  thread_id: string;
  provider: string | null;
  child_thread_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  payload_json: string;
};

type MessageRow = {
  thread_id: string;
  role: string;
  created_at: string;
  payload_json: string;
};

type TurnItemRow = {
  turn_item_id: string;
  thread_id: string;
  type: string;
  status: string;
  updated_at: string;
  payload_json: string;
};

const TOOL_TYPES = new Set(["command_execution", "file_change", "dynamic_tool", "file_search", "web_search"]);

// why: T3 native item and delegated-task ids can exceed the 200-char event schema limit
const shortId = (raw: string) => (raw.length <= 180 ? raw : `h:${Bun.hash(raw).toString(36)}`);

function parseJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isoStamp(value: unknown, fallback: string) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function toolMeta(type: string, payload: Record<string, unknown>) {
  if (type === "dynamic_tool") {
    const input =
      payload.input && typeof payload.input === "object" && !Array.isArray(payload.input)
        ? (payload.input as Record<string, unknown>)
        : undefined;
    return { name: clip(payload.toolName, 120) ?? "tool", summary: summarize(input) ?? clip(payload.title, 200) };
  }
  if (type === "command_execution") {
    return { name: "shell", summary: clip(payload.input ?? payload.command ?? payload.title, 200) };
  }
  if (type === "file_change") {
    return { name: "edit", summary: clip(payload.fileName ?? payload.title, 200) };
  }
  if (type === "file_search") {
    return { name: "search", summary: clip(payload.pattern ?? payload.title, 200) };
  }
  const first = Array.isArray(payload.patterns) ? payload.patterns[0] : undefined;
  return { name: "web_search", summary: clip(first ?? payload.title, 200) };
}

function resolveScope(
  threadId: string,
  childOf: Map<string, { parentThreadId: string; agentId: string }>,
): { sessionId: string; agentId: string } {
  const leaf = childOf.get(threadId);
  if (!leaf) return { sessionId: shortId(threadId), agentId: shortId(threadId) };
  let cursor = leaf.parentThreadId;
  const seen = new Set([threadId]);
  while (childOf.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    cursor = childOf.get(cursor)?.parentThreadId ?? cursor;
  }
  return { sessionId: shortId(cursor), agentId: leaf.agentId };
}

function queryRows<T>(db: Database, sql: string, params: string[] = []): T[] {
  return db.query(sql).all(...params) as T[];
}

export function readT3Database(dbPath: string, sinceHours: number): AgentEvent[] {
  let db: Database;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("SQLITE_BUSY") || message.includes("locked")) return [];
    throw error;
  }
  try {
    const cutoff = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
    let threads: ThreadRow[];
    try {
      threads = queryRows<ThreadRow>(
        db,
        `SELECT thread_id, project_id, title, default_provider, created_at, updated_at
         FROM orchestration_v2_projection_threads
         WHERE deleted_at IS NULL AND updated_at >= ?
         ORDER BY created_at ASC`,
        [cutoff],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("no such table") || message.includes("SQLITE_BUSY") || message.includes("locked")) return [];
      throw error;
    }
    if (threads.length === 0) return [];

    const projects = new Map(
      queryRows<{ project_id: string; workspace_root: string }>(
        db,
        "SELECT project_id, workspace_root FROM projection_projects",
      ).map((row) => [row.project_id, row.workspace_root]),
    );
    const subagents = queryRows<SubagentRow>(
      db,
      `SELECT subagent_id, thread_id, provider, child_thread_id, status, started_at, completed_at, updated_at, payload_json
       FROM orchestration_v2_projection_subagents
       WHERE updated_at >= ?
       ORDER BY started_at ASC`,
      [cutoff],
    );

    const childOf = new Map<string, { parentThreadId: string; agentId: string }>();
    for (const sub of subagents) {
      if (sub.child_thread_id) {
        childOf.set(sub.child_thread_id, {
          parentThreadId: sub.thread_id,
          agentId: shortId(sub.child_thread_id),
        });
      }
    }

    const models = new Map<string, string>();
    for (const row of queryRows<{ thread_id: string; payload_json: string }>(
      db,
      "SELECT thread_id, payload_json FROM orchestration_v2_projection_provider_sessions ORDER BY rowid ASC",
    )) {
      const model = clip(parseJson(row.payload_json).model, 120);
      if (model) models.set(row.thread_id, model);
    }
    for (const row of queryRows<{ thread_id: string; payload_json: string }>(
      db,
      "SELECT thread_id, payload_json FROM orchestration_v2_projection_runs WHERE requested_at >= ? ORDER BY rowid ASC",
      [cutoff],
    )) {
      const selection = parseJson(row.payload_json).modelSelection as { model?: unknown } | undefined;
      const model = clip(selection?.model, 120);
      if (model) models.set(row.thread_id, model);
    }

    const activeThreads = new Set(threads.map((thread) => thread.thread_id));
    const events: AgentEvent[] = [];

    for (const thread of threads) {
      if (childOf.has(thread.thread_id)) continue;
      const sessionId = shortId(thread.thread_id);
      const at = isoStamp(thread.created_at, thread.updated_at);
      const cwd = thread.project_id ? clip(projects.get(thread.project_id), 500) : undefined;
      const model = models.get(thread.thread_id) ?? clip(thread.default_provider, 120);
      events.push({
        type: "session.started",
        sessionId,
        at,
        harness: "t3",
        title: clip(thread.title, 200),
        cwd,
      });
      events.push({
        type: "agent.started",
        sessionId,
        at,
        agentId: sessionId,
        name: "main",
        model,
      });
    }

    const messages = queryRows<MessageRow>(
      db,
      `SELECT thread_id, role, created_at, payload_json
       FROM orchestration_v2_projection_messages
       WHERE created_at >= ?
       ORDER BY created_at ASC, rowid ASC`,
      [cutoff],
    );
    const threadsWithMessages = new Set<string>();
    for (const msg of messages) threadsWithMessages.add(msg.thread_id);

    for (const sub of subagents) {
      if (!activeThreads.has(sub.thread_id)) continue;
      const parentScope = resolveScope(sub.thread_id, childOf);
      const agentId = shortId(sub.child_thread_id ?? sub.subagent_id);
      const payload = parseJson(sub.payload_json);
      const selection = payload.modelSelection as { model?: unknown } | undefined;
      const subModel =
        clip(payload.model ?? selection?.model, 120) ??
        (sub.child_thread_id ? models.get(sub.child_thread_id) : undefined) ??
        clip(sub.provider, 120);
      const startedAt = isoStamp(sub.started_at, sub.updated_at);
      events.push({
        type: "agent.started",
        sessionId: parentScope.sessionId,
        at: startedAt,
        agentId,
        name: clip(payload.title, 120) ?? clip(sub.provider, 120) ?? "subagent",
        parentAgentId: parentScope.agentId,
        model: subModel,
      });
      if (!sub.child_thread_id || !threadsWithMessages.has(sub.child_thread_id)) {
        const prompt = clip(payload.prompt, 1000);
        if (prompt) {
          events.push({
            type: "message",
            sessionId: parentScope.sessionId,
            at: startedAt,
            agentId,
            role: "user",
            text: prompt,
          });
        }
      }
      if (sub.completed_at && sub.status !== "running") {
        const completedAt = isoStamp(sub.completed_at, sub.updated_at);
        if (!sub.child_thread_id || !threadsWithMessages.has(sub.child_thread_id)) {
          const result = clip(payload.result, 1000);
          if (result) {
            events.push({
              type: "message",
              sessionId: parentScope.sessionId,
              at: completedAt,
              agentId,
              role: "assistant",
              text: result,
              model: subModel,
            });
          }
        }
        events.push({
          type: "agent.stopped",
          sessionId: parentScope.sessionId,
          at: completedAt,
          agentId,
        });
      }
    }

    for (const msg of messages) {
      if (!activeThreads.has(msg.thread_id)) continue;
      if (msg.role !== "user" && msg.role !== "assistant") continue;
      const text = clip(parseJson(msg.payload_json).text, 1000);
      if (!text) continue;
      const scope = resolveScope(msg.thread_id, childOf);
      events.push({
        type: "message",
        sessionId: scope.sessionId,
        at: isoStamp(msg.created_at, cutoff),
        agentId: scope.agentId,
        role: msg.role,
        text,
        ...(msg.role === "assistant" ? { model: models.get(msg.thread_id) } : {}),
      });
    }

    const items = queryRows<TurnItemRow>(
      db,
      `SELECT turn_item_id, thread_id, type, status, updated_at, payload_json
       FROM orchestration_v2_projection_turn_items
       WHERE updated_at >= ?
       ORDER BY rowid ASC`,
      [cutoff],
    );
    for (const item of items) {
      if (!activeThreads.has(item.thread_id) || !TOOL_TYPES.has(item.type)) continue;
      const scope = resolveScope(item.thread_id, childOf);
      const payload = parseJson(item.payload_json);
      const toolId = shortId(item.turn_item_id);
      const { name, summary } = toolMeta(item.type, payload);
      const startedAt = isoStamp(payload.startedAt, item.updated_at);
      events.push({
        type: "tool.started",
        sessionId: scope.sessionId,
        at: startedAt,
        agentId: scope.agentId,
        toolId,
        name,
        summary,
      });
      if (item.status !== "running") {
        events.push({
          type: "tool.finished",
          sessionId: scope.sessionId,
          at: isoStamp(payload.completedAt ?? payload.updatedAt, item.updated_at),
          toolId,
          ok: item.status === "completed",
        });
      }
    }

    return events;
  } finally {
    db.close();
  }
}

const stateDb: FileSource<State> = {
  defaultPath: process.env.T3_USERDATA_DIR ?? join(homedir(), ".t3", "userdata"),
  globs: ["statev2.sqlite"],
  mode: "snapshot",
  open(_relative, _absolute, _mtime, sinceHours) {
    return { state: { sinceHours, emitted: new Set() } };
  },
  read(absolute, state) {
    const fresh: AgentEvent[] = [];
    for (const event of readT3Database(absolute, state.sinceHours)) {
      const key = JSON.stringify(event);
      if (state.emitted.has(key)) continue;
      state.emitted.add(key);
      fresh.push(event);
    }
    return fresh;
  },
};

export const t3: Adapter = {
  id: "t3",
  name: "T3 Code",
  harness: "t3",
  files: stateDb,
};
