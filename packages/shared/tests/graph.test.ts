import { describe, expect, test } from "bun:test";
import type { AgentEvent } from "../src/events";
import { apply, applyAll, emptyGraph, forgetSession, mergeGraphs, parentOf } from "../src/graph";

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
    expect(graph.tools.s1.t2).toMatchObject({ ok: false, finishedAt: at(4) });
  });

  test("links a subagent to the agent whose tool call spawned it, in any order", () => {
    const graph = applyAll(emptyGraph(), [run[2], run[1]]);
    expect(parentOf(graph, graph.agents.a1)).toBe("s1");
    expect(parentOf(graph, graph.agents.s1)).toBeUndefined();
  });

  test("stops a subagent when its spawning tool call finishes", () => {
    expect(applyAll(emptyGraph(), run).agents.a1.stoppedAt).toBe(at(5));
  });

  test("keeps the model an agent started with until a reply names another", () => {
    const started: AgentEvent = { ...run[2], model: "gpt-5" } as AgentEvent;
    const reply: AgentEvent = {
      type: "message",
      sessionId: "s1",
      agentId: "a1",
      role: "assistant",
      text: "ok",
      at: at(3),
    };
    expect(applyAll(emptyGraph(), [started, reply]).agents.a1.model).toBe("gpt-5");
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

  test("keeps the first message and the latest ones per agent", () => {
    const messages = Array.from(
      { length: 40 },
      (_, i): AgentEvent => ({
        type: "message",
        sessionId: "s1",
        agentId: "s1",
        role: "assistant",
        text: `m${i}`,
        at: at(i % 60),
      }),
    );
    const kept = applyAll(emptyGraph(), messages).agents.s1.messages.map((message) => message.text);
    expect(kept).toHaveLength(30);
    expect(kept[0]).toBe("m0");
    expect(kept.at(-1)).toBe("m39");
  });

  test("forgets a session with its agents and tools", () => {
    const other: AgentEvent = {
      type: "tool.started",
      sessionId: "s2",
      agentId: "s2",
      toolId: "x",
      name: "Read",
      at: at(1),
    };
    const graph = forgetSession(applyAll(emptyGraph(), [...run, other]), "s1");
    expect(Object.keys(graph.sessions)).toEqual(["s2"]);
    expect(Object.keys(graph.agents)).toEqual(["s2"]);
    expect(Object.keys(graph.tools)).toEqual(["s2"]);
    expect(Object.keys(graph.tools.s2)).toEqual(["x"]);
  });

  test("merges graphs from several bridges", () => {
    const other: AgentEvent = {
      type: "tool.started",
      sessionId: "s2",
      agentId: "s2",
      toolId: "x",
      name: "Read",
      at: at(1),
    };
    const merged = mergeGraphs([applyAll(emptyGraph(), run), applyAll(emptyGraph(), [other])]);
    expect(Object.keys(merged.sessions).sort()).toEqual(["s1", "s2"]);
  });

  test("links a subagent to a named parent agent when no spawn call is known", () => {
    const events: AgentEvent[] = [
      { type: "agent.started", sessionId: "s1", agentId: "a1", name: "planner", at: at(1) },
      { type: "agent.started", sessionId: "s1", agentId: "a2", name: "worker", parentAgentId: "a1", at: at(2) },
      { type: "agent.started", sessionId: "s1", agentId: "a3", name: "orphan", parentAgentId: "missing", at: at(3) },
    ];
    const graph = applyAll(emptyGraph(), events);
    expect(parentOf(graph, graph.agents.a2)).toBe("a1");
    expect(parentOf(graph, graph.agents.a3)).toBe("s1");
  });

  test("does not mutate the previous graph", () => {
    const before = applyAll(emptyGraph(), run.slice(0, 2));
    const snapshot = structuredClone(before);
    applyAll(before, run.slice(2));
    expect(before).toEqual(snapshot);
  });

  test("shares the tools of sessions an event does not touch", () => {
    const other: AgentEvent = {
      type: "tool.started",
      sessionId: "s2",
      agentId: "s2",
      toolId: "x",
      name: "Read",
      at: at(1),
    };
    const before = applyAll(emptyGraph(), [...run, other]);
    const after = apply(before, { type: "tool.finished", sessionId: "s2", toolId: "x", ok: true, at: at(6) });
    expect(after.tools.s1).toBe(before.tools.s1);
    expect(after.tools.s2).not.toBe(before.tools.s2);
    expect(before.tools.s2.x.finishedAt).toBeUndefined();
  });

  test("stops a subagent spawned earlier in the same batch", () => {
    const graph = applyAll(emptyGraph(), [run[1], run[5], run[2]]);
    expect(graph.agents.a1.stoppedAt).toBeUndefined();
    expect(applyAll(graph, [{ ...run[5], at: at(7) } as AgentEvent]).agents.a1.stoppedAt).toBe(at(7));
  });

  test("batched applyAll matches sequential apply", () => {
    const base = applyAll(emptyGraph(), run.slice(0, 2));
    const more: AgentEvent[] = [
      ...run.slice(2),
      { type: "message", sessionId: "s1", agentId: "a1", role: "assistant", text: "done", at: at(6) },
    ];
    const batched = applyAll(base, more);
    const sequential = more.reduce(apply, base);
    expect(batched).toEqual(sequential);
  });
});
