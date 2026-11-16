import { describe, expect, test } from "bun:test";
import type { AgentEvent } from "@rancher/shared/events";
import { applyAll, emptyGraph } from "@rancher/shared/graph";
import { filterGraph } from "../src/lib/filters";

const at = "2026-11-16T10:00:00.000Z";
const now = Date.parse(at);
const events: AgentEvent[] = [
  { type: "session.started", sessionId: "a", harness: "claude-code", title: "Fix login", cwd: "/shop", at },
  { type: "session.started", sessionId: "b", harness: "codex", title: "Write docs", at: "2026-11-16T09:00:00.000Z" },
  { type: "tool.started", sessionId: "b", agentId: "b", toolId: "tb1", name: "Bash", at: "2026-11-16T09:00:01.000Z" },
  { type: "tool.finished", sessionId: "b", toolId: "tb1", ok: false, at: "2026-11-16T09:00:02.000Z" },
];
const graph = applyAll(emptyGraph(), events);
const all = { query: "", harness: "all", liveOnly: false, errorsOnly: false };
const ids = (filtered: typeof graph) => Object.keys(filtered.sessions).sort();

describe("filterGraph", () => {
  test("keeps everything without filters", () => {
    expect(ids(filterGraph(graph, all, now, 30_000))).toEqual(["a", "b"]);
  });

  test("matches the query against title, folder and harness", () => {
    expect(ids(filterGraph(graph, { ...all, query: "SHOP" }, now, 30_000))).toEqual(["a"]);
    expect(ids(filterGraph(graph, { ...all, query: "codex" }, now, 30_000))).toEqual(["b"]);
  });

  test("filters by harness", () => {
    expect(ids(filterGraph(graph, { ...all, harness: "codex" }, now, 30_000))).toEqual(["b"]);
  });

  test("keeps only live sessions when asked", () => {
    expect(ids(filterGraph(graph, { ...all, liveOnly: true }, now, 30_000))).toEqual(["a"]);
  });

  test("keeps only sessions with failed tools when errorsOnly is set", () => {
    expect(ids(filterGraph(graph, { ...all, errorsOnly: true }, now, 30_000))).toEqual(["b"]);
  });
});
