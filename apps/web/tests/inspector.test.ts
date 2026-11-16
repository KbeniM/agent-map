import { describe, expect, test } from "bun:test";
import { applyAll, emptyGraph } from "@agent-map/shared/graph";
import { nodeId } from "@agent-map/shared/layout";
import { agentDetails, nodeSubtitle, nodeTitle, resolveNode } from "../src/lib/inspector";

const graph = applyAll(emptyGraph(), [
  {
    type: "session.started",
    sessionId: "s1",
    harness: "claude-code",
    title: "Fix auth",
    cwd: "/repo",
    at: "2026-11-16T10:00:00.000Z",
  },
  {
    type: "message",
    sessionId: "s1",
    agentId: "s1",
    role: "assistant",
    model: "claude-sonnet-4",
    text: "Working on it",
    at: "2026-11-16T10:00:01.000Z",
  },
  {
    type: "tool.started",
    sessionId: "s1",
    agentId: "s1",
    toolId: "t1",
    name: "Read",
    summary: "src/app.ts",
    at: "2026-11-16T10:00:02.000Z",
  },
  {
    type: "agent.started",
    sessionId: "s1",
    agentId: "sub1",
    parentAgentId: "s1",
    name: "Scout",
    at: "2026-11-16T10:00:03.000Z",
  },
]);

describe("inspector", () => {
  test("resolves main agent, subagent, and tool call nodes", () => {
    const main = resolveNode(graph, nodeId.agent("s1"));
    if (!main?.agent) throw new Error("missing main agent");
    expect(main.tool).toBeUndefined();
    expect(nodeTitle(graph, main.agent)).toBe("Fix auth");
    expect(nodeSubtitle(graph, main.agent)).toBe("claude-code · claude-sonnet-4 · /repo");

    const sub = resolveNode(graph, nodeId.agent("sub1"));
    if (!sub?.agent) throw new Error("missing subagent");
    expect(nodeTitle(graph, sub.agent)).toBe("Scout");
    expect(nodeSubtitle(graph, sub.agent)).toBe("Subagent of Fix auth");

    const tool = resolveNode(graph, nodeId.tool("t1"));
    if (!tool?.agent || !tool.tool) throw new Error("missing tool");
    expect(tool.tool.name).toBe("Read");
    expect(nodeTitle(graph, tool.agent, tool.tool)).toBe("Read");
  });

  test("builds newest-first timeline and children for an agent", () => {
    const main = resolveNode(graph, nodeId.agent("s1"));
    if (!main?.agent) throw new Error("missing main agent");
    const details = agentDetails(graph, main.agent);
    expect(details.isMain).toBe(true);
    expect(details.speaker).toBe("Claude");
    expect(details.children.map((child) => child.id)).toEqual(["sub1"]);
    expect(details.entries.map((entry) => entry.at)).toEqual(["2026-11-16T10:00:02.000Z", "2026-11-16T10:00:01.000Z"]);
  });
});
