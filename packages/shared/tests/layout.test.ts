import { describe, expect, test } from "bun:test";
import type { AgentEvent } from "../src/events";
import { applyAll, emptyGraph } from "../src/graph";
import { toMap } from "../src/layout";

const at = "2026-11-16T10:00:00.000Z";
const now = Date.parse(at);

const events: AgentEvent[] = [
  { type: "session.started", sessionId: "s1", at, harness: "claude-code", title: "Fix login" },
  { type: "tool.started", sessionId: "s1", agentId: "s1", toolId: "spawn", name: "Agent", at },
  { type: "agent.started", sessionId: "s1", agentId: "a1", name: "scout", parentToolId: "spawn", at },
  ...Array.from(
    { length: 10 },
    (_, i): AgentEvent => ({
      type: "tool.started",
      sessionId: "s1",
      agentId: "a1",
      toolId: `t${i}`,
      name: "Read",
      at,
    }),
  ),
];

describe("toMap", () => {
  const map = toMap(applyAll(emptyGraph(), events), now, 4);

  test("draws the session as the root and the subagent under it", () => {
    expect(map.nodes.find((node) => node.id === "agent:s1")).toMatchObject({ type: "session", label: "Fix login" });
    expect(map.links).toContainEqual(expect.objectContaining({ source: "agent:s1", target: "agent:a1" }));
  });

  test("replaces the spawning tool call with the subagent", () => {
    expect(map.nodes.some((node) => node.id === "tool:spawn")).toBe(false);
  });

  test("keeps only the latest tools per agent", () => {
    const tools = map.nodes.filter((node) => node.type === "tool").map((node) => node.id);
    expect(tools).toEqual(["tool:t6", "tool:t7", "tool:t8", "tool:t9"]);
  });

  test("marks a session idle after its last event ages out", () => {
    const later = toMap(applyAll(emptyGraph(), events.slice(0, 1)), now + 60_000);
    expect(later.nodes[0].live).toBe(false);
  });
});
