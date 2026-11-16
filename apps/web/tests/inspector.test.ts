import { describe, expect, test } from "bun:test";
import { applyAll, emptyGraph } from "@rancher/shared/graph";
import { nodeId } from "@rancher/shared/layout";
import { agentDetails, agentTrace, nodeSubtitle, nodeTitle, resolveNode } from "../src/lib/inspector";

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
    type: "tool.finished",
    sessionId: "s1",
    toolId: "t1",
    ok: false,
    at: "2026-11-16T10:00:02.500Z",
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
    expect(nodeSubtitle(graph, main.agent)).toEqual(["claude-code", "claude-sonnet-4", "/repo"]);

    const sub = resolveNode(graph, nodeId.agent("sub1"));
    if (!sub?.agent) throw new Error("missing subagent");
    expect(nodeTitle(graph, sub.agent)).toBe("Scout");
    expect(nodeSubtitle(graph, sub.agent)).toEqual(["Subagent of Fix auth"]);
    expect(agentDetails(graph, sub.agent).parent?.id).toBe("s1");

    const tool = resolveNode(graph, nodeId.tool("t1"));
    if (!tool?.agent || !tool.tool) throw new Error("missing tool");
    expect(tool.tool.name).toBe("Read");
    expect(nodeTitle(graph, tool.agent, tool.tool)).toBe("Read");
  });

  test("builds chronological timeline, tool breakdown, errors, and trace snapshot", () => {
    const main = resolveNode(graph, nodeId.agent("s1"));
    if (!main?.agent) throw new Error("missing main agent");
    const details = agentDetails(graph, main.agent);
    expect(details.isMain).toBe(true);
    expect(details.speaker).toBe("Claude");
    expect(details.children.map((child) => child.id)).toEqual(["sub1"]);
    expect(details.entries.map((entry) => entry.at)).toEqual(["2026-11-16T10:00:01.000Z", "2026-11-16T10:00:02.000Z"]);
    expect(details.errorCount).toBe(1);
    expect(details.toolSummary).toEqual([{ name: "Read", total: 1, running: 0, failed: 1 }]);
    expect(agentTrace(graph, main.agent).tools.map((tool) => tool.id)).toEqual(["t1"]);
  });
});
