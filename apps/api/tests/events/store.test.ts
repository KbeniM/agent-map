import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@agent-map/shared/events";
import { createStore } from "../../src/events/store";
import { at } from "../helpers";

const tool = (toolId: string, sessionId = "s1"): AgentEvent => ({
  type: "tool.started",
  sessionId,
  agentId: sessionId,
  toolId,
  name: "Read",
  at,
});

describe("createStore", () => {
  test("stores an identical event once", () => {
    const store = createStore(":memory:");
    expect(store.publish([tool("t1"), tool("t1"), tool("t2")])).toBe(2);
    expect([...store.since(0)].map((entry) => entry.event)).toEqual([tool("t1"), tool("t2")]);
  });

  test("keeps events and its id across a reopen", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "agent-map-store-")), "events.db");
    const first = createStore(path);
    first.publish([tool("t1")]);
    const id = first.id;
    first.close();
    const second = createStore(path);
    expect(second.id).toBe(id);
    expect(second.publish([tool("t1")])).toBe(0);
    expect([...second.since(0)]).toHaveLength(1);
  });

  test("forgets a session and refuses its later events", () => {
    const store = createStore(":memory:");
    const notices: string[] = [];
    store.subscribe((notice) => notices.push(notice.type));
    store.publish([tool("t1"), tool("t2", "s2")]);
    expect(store.forget("s1")).toBe(1);
    expect(store.publish([tool("t3")])).toBe(0);
    expect([...store.since(0)].map((entry) => entry.event.sessionId)).toEqual(["s2"]);
    expect(notices).toEqual(["event", "event", "forget"]);
  });

  test("prunes events older than the retention window", () => {
    const store = createStore(":memory:");
    store.publish([
      { ...tool("old"), at: "2020-01-01T00:00:00.000Z" },
      { ...tool("new"), at: new Date().toISOString() },
    ]);
    expect(store.prune(7)).toBe(1);
    expect([...store.since(0)]).toHaveLength(1);
  });

  test("pages through more history than one query returns", () => {
    const store = createStore(":memory:");
    store.publish(Array.from({ length: 4500 }, (_, i) => tool(`t${i}`)));
    expect([...store.since(10)]).toHaveLength(4490);
  });

  test("migrates a pre-drizzle database without losing its id or events", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "agent-map-legacy-")), "events.db");
    const legacy = new Database(path, { create: true });
    legacy.run(
      "CREATE TABLE events (seq INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, session_id TEXT NOT NULL, at TEXT NOT NULL, body TEXT NOT NULL)",
    );
    legacy.run("CREATE TABLE hidden (session_id TEXT PRIMARY KEY)");
    legacy.run("CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL)");
    legacy.run("INSERT INTO meta (name, value) VALUES ('id', 'legacy12')");
    legacy.close();

    const store = createStore(path);
    expect(store.id).toBe("legacy12");
    expect(store.publish([tool("t1")])).toBe(1);
    store.close();
  });
});
