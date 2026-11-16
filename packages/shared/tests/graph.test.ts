import { describe, expect, test } from "bun:test";
import type { AgentEvent } from "../src/events";
import { applyAll, emptyGraph, parentOf } from "../src/graph";

const at = (second: number) => `2026-11-16T10:00:${String(second).padStart(2, "0")}.000Z`;

const run: AgentEvent[] = [
  { type: "session.started", sessionId: "s1", at: at(0), harness: "claude-code", title: "Fix login" },
  { type: "tool.started", sessionId: "s1", agentId: "s1", toolId: "t1", name: "Agent", at: at(1) },
  { type: "agent.started", sessionId: "s1", agentId: "a1", name: "scout", parentToolId: "t1", at: at(2) },
  { type: "tool.started", sessionId: "s1", agentId: "a1", toolId: "t2", name: "Grep", at: at(3) },
  { type: "tool.finished", sessionId: "s1", toolId: "t2", ok: false, at: at(4) },
  { type: "tool.finished", sessionId: "s1", toolId: "t1", ok: true, at: at(5) },
];

describe("apply", () => {
  test("builds the session, its main agent, the subagent and their tools", () => {
    const graph = applyAll(emptyGraph(), run);
    expect(graph.sessions.s1).toMatchObject({ harness: "claude-code", title: "Fix login", lastAt: at(5) });
    expect(graph.agents.s1.toolIds).toEqual(["t1"]);
    expect(graph.agents.a1.toolIds).toEqual(["t2"]);
    expect(graph.tools.t2).toMatchObject({ ok: false, finishedAt: at(4) });
  });

  test("links a subagent to the agent whose tool call spawned it, in any order", () => {
    const graph = applyAll(emptyGraph(), [run[2], run[1]]);
    expect(parentOf(graph, graph.agents.a1)).toBe("s1");
    expect(parentOf(graph, graph.agents.s1)).toBeUndefined();
  });

  test("stops a subagent when its spawning tool call finishes", () => {
    expect(applyAll(emptyGraph(), run).agents.a1.stoppedAt).toBe(at(5));
  });

  test("creates the session for a harness that only reports tools", () => {
    const graph = applyAll(emptyGraph(), [run[3]]);
    expect(graph.sessions.s1.harness).toBe("unknown");
    expect(graph.agents.a1.name).toBe("main");
  });

  test("ignores a finish for a tool it never saw", () => {
    const graph = applyAll(emptyGraph(), [
      { type: "tool.finished", sessionId: "s1", toolId: "x", ok: true, at: at(1) },
    ]);
    expect(graph.tools).toEqual({});
  });

  test("does not mutate the previous graph", () => {
    const before = applyAll(emptyGraph(), run.slice(0, 2));
    const snapshot = structuredClone(before);
    applyAll(before, run.slice(2));
    expect(before).toEqual(snapshot);
  });
});
