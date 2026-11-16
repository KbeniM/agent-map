import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentEvent, agentEventSchema } from "@rancher/shared/events";
import { watchFiles } from "../../src/harness/files";
import { readT3Database, t3 } from "../../src/harness/t3";
import { until } from "../helpers";

const dir = await mkdtemp(join(tmpdir(), "rancher-t3-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

function createT3Schema(db: Database) {
  db.run("PRAGMA journal_mode = WAL");
  db.run(`
    CREATE TABLE projection_projects (project_id TEXT PRIMARY KEY, workspace_root TEXT);
    CREATE TABLE orchestration_v2_projection_threads (
      thread_id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT,
      default_provider TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE orchestration_v2_projection_provider_sessions (
      thread_id TEXT NOT NULL,
      provider TEXT,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE orchestration_v2_projection_runs (
      thread_id TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE orchestration_v2_projection_subagents (
      subagent_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      provider TEXT,
      child_thread_id TEXT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE orchestration_v2_projection_messages (
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE orchestration_v2_projection_turn_items (
      turn_item_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);
}

describe("t3 adapter", () => {
  test("reads threads, models, messages, tools, subagents and hashes long ids", () => {
    const dbPath = join(dir, "snapshot.sqlite");
    const db = new Database(dbPath, { create: true });
    createT3Schema(db);

    const now = new Date();
    const ts = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
    const old = new Date(now.getTime() - 48 * 3_600_000).toISOString();

    db.run("INSERT INTO projection_projects VALUES ('p1', '/work/rancher')");
    db.run(
      "INSERT INTO orchestration_v2_projection_threads VALUES ('t1', 'p1', 'Main task', 'antigravity', ?, ?, NULL)",
      [ts(-5000), ts(-100)],
    );
    db.run(
      "INSERT INTO orchestration_v2_projection_threads VALUES ('sub1', 'p1', 'Scout', 'claudeAgent', ?, ?, NULL)",
      [ts(-4000), ts(-200)],
    );
    db.run("INSERT INTO orchestration_v2_projection_threads VALUES ('old', 'p1', 'Old', 'antigravity', ?, ?, NULL)", [
      old,
      old,
    ]);
    db.run("INSERT INTO orchestration_v2_projection_threads VALUES ('deleted', 'p1', 'Gone', 'antigravity', ?, ?, ?)", [
      ts(-3000),
      ts(-100),
      ts(-50),
    ]);

    db.run("INSERT INTO orchestration_v2_projection_provider_sessions VALUES ('t1', 'antigravity', ?)", [
      JSON.stringify({ model: "gemini-4-hydrogen" }),
    ]);
    db.run("INSERT INTO orchestration_v2_projection_runs VALUES ('t1', ?, ?)", [
      ts(-4500),
      JSON.stringify({ modelSelection: { model: "gemini-4-hydrogen" } }),
    ]);

    db.run(
      "INSERT INTO orchestration_v2_projection_subagents VALUES ('sa1', 't1', 'claudeAgent', 'sub1', 'completed', ?, ?, ?, ?)",
      [
        ts(-4000),
        ts(-200),
        ts(-200),
        JSON.stringify({ title: "Scout files", model: "claude-haiku-5-5", prompt: "ignored", result: "done" }),
      ],
    );
    db.run(
      "INSERT INTO orchestration_v2_projection_subagents VALUES ('sa2', 't1', 'claudeAgent', NULL, 'running', ?, NULL, ?, ?)",
      [ts(-3000), ts(-3000), JSON.stringify({ title: "Direct child", prompt: "check tests" })],
    );

    db.run("INSERT INTO orchestration_v2_projection_messages VALUES ('t1', 'user', ?, ?)", [
      ts(-4900),
      JSON.stringify({ text: "hello" }),
    ]);
    db.run("INSERT INTO orchestration_v2_projection_messages VALUES ('t1', 'assistant', ?, ?)", [
      ts(-4800),
      JSON.stringify({ text: "working" }),
    ]);
    db.run("INSERT INTO orchestration_v2_projection_messages VALUES ('sub1', 'user', ?, ?)", [
      ts(-3900),
      JSON.stringify({ text: "scan repo" }),
    ]);

    const longId = `turn-item:${"x".repeat(220)}`;
    db.run("INSERT INTO orchestration_v2_projection_turn_items VALUES (?, 't1', 'dynamic_tool', 'completed', ?, ?)", [
      longId,
      ts(-4700),
      JSON.stringify({
        toolName: "Read",
        input: { file_path: "a.ts" },
        startedAt: ts(-4750),
        completedAt: ts(-4700),
      }),
    ]);
    db.run(
      "INSERT INTO orchestration_v2_projection_turn_items VALUES ('cmd1', 't1', 'command_execution', 'failed', ?, ?)",
      [ts(-4600), JSON.stringify({ input: "bun test", startedAt: ts(-4650), completedAt: ts(-4600) })],
    );
    db.run(
      "INSERT INTO orchestration_v2_projection_turn_items VALUES ('fc1', 'sub1', 'file_change', 'running', ?, ?)",
      [ts(-3500), JSON.stringify({ fileName: "b.ts", startedAt: ts(-3500) })],
    );
    db.run("INSERT INTO orchestration_v2_projection_turn_items VALUES ('ws1', 't1', 'web_search', 'completed', ?, ?)", [
      ts(-4500),
      JSON.stringify({ patterns: ["https://example.com"], startedAt: ts(-4510) }),
    ]);
    db.run("INSERT INTO orchestration_v2_projection_turn_items VALUES ('r1', 't1', 'reasoning', 'completed', ?, ?)", [
      ts(-4400),
      JSON.stringify({ text: "internal" }),
    ]);
    db.close();

    const events = readT3Database(dbPath, 24);
    for (const event of events) expect(() => agentEventSchema.parse(event)).not.toThrow();

    expect(events.filter((e) => e.type === "session.started")).toEqual([
      expect.objectContaining({ sessionId: "t1", harness: "t3", title: "Main task", cwd: "/work/rancher" }),
    ]);
    expect(events.filter((e) => e.type === "agent.started")).toMatchObject([
      { sessionId: "t1", agentId: "t1", name: "main", model: "gemini-4-hydrogen" },
      { sessionId: "t1", agentId: "sub1", name: "Scout files", parentAgentId: "t1", model: "claude-haiku-5-5" },
      { sessionId: "t1", agentId: "sa2", name: "Direct child", parentAgentId: "t1" },
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "message", sessionId: "t1", agentId: "sub1", role: "user", text: "scan repo" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "message", sessionId: "t1", agentId: "sa2", role: "user", text: "check tests" }),
    );
    const readTool = events.find((e) => e.type === "tool.started" && e.name === "Read");
    expect(readTool && "toolId" in readTool ? readTool.toolId.length : 999).toBeLessThanOrEqual(200);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "tool.finished", sessionId: "t1", toolId: "cmd1", ok: false }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "tool.started",
        sessionId: "t1",
        agentId: "sub1",
        name: "edit",
        summary: "b.ts",
      }),
    );
    expect(events.some((e) => e.type === "tool.finished" && e.toolId === "fc1")).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "agent.stopped", sessionId: "t1", agentId: "sub1" }));
  });

  test("returns empty for a database without v2 tables", () => {
    const dbPath = join(dir, "empty.sqlite");
    const db = new Database(dbPath, { create: true });
    db.run("CREATE TABLE unrelated (id TEXT)");
    db.close();
    expect(readT3Database(dbPath, 24)).toEqual([]);
  });

  test("watchFiles detects WAL writes without touching the main sqlite file", async () => {
    const root = join(dir, "live");
    const dbPath = join(root, "statev2.sqlite");
    await Bun.write(join(root, ".keep"), "");
    const db = new Database(dbPath, { create: true });
    createT3Schema(db);
    const now = new Date().toISOString();
    db.run("INSERT INTO orchestration_v2_projection_threads VALUES ('t1', NULL, 'Live', 'antigravity', ?, ?, NULL)", [
      now,
      now,
    ]);
    db.run("PRAGMA wal_checkpoint(TRUNCATE)");

    const events: AgentEvent[] = [];
    const source = t3.files as NonNullable<typeof t3.files>;
    const watcher = watchFiles(source, root, 24, (batch) => events.push(...batch), 20);
    try {
      await until(() => events.some((e) => e.type === "session.started"));

      db.run("INSERT INTO orchestration_v2_projection_messages VALUES ('t1', 'user', ?, ?)", [
        new Date().toISOString(),
        JSON.stringify({ text: "new wal message" }),
      ]);
      await until(() => events.some((e) => e.type === "message" && e.text === "new wal message"));
    } finally {
      watcher.stop();
      db.close();
    }
  });
});
