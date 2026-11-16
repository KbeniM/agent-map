import { describe, expect, test } from "bun:test";
import { applyAll, emptyGraph } from "@agent-map/shared/graph";
import { nodeId } from "@agent-map/shared/layout";
import type { Link, Node } from "../src/components/graph/camera";
import { linkStyle, projectMap } from "../src/components/graph/projection";

const at = "2026-11-16T10:00:00.000Z";
const now = Date.parse(at);

describe("projectMap", () => {
  test("inherits parent spawn coordinates, preserves existing nodes, and prunes removed ones", () => {
    const cache = new Map<string, Node>();
    const firstGraph = applyAll(emptyGraph(), [
      { type: "session.started", sessionId: "s1", harness: "codex", title: "One", at },
      { type: "session.started", sessionId: "s2", harness: "codex", title: "Two", at },
    ]);

    const first = projectMap(cache, firstGraph, now, { toolsPerAgent: 5, liveMs: 30_000 });
    expect(first.nodes.map((node) => node.id).sort()).toEqual([nodeId.agent("s1"), nodeId.agent("s2")]);

    const main = cache.get(nodeId.agent("s1"));
    if (!main) throw new Error("missing main node");
    main.x = 12;
    main.y = -4;
    main.z = 8;

    const nextGraph = applyAll(emptyGraph(), [
      { type: "session.started", sessionId: "s1", harness: "codex", title: "One", at },
      { type: "tool.started", sessionId: "s1", agentId: "s1", toolId: "t1", name: "Read", at },
    ]);

    const next = projectMap(cache, nextGraph, now, { toolsPerAgent: 5, liveMs: 30_000 });
    expect(cache.has(nodeId.agent("s2"))).toBe(false);
    expect(cache.get(nodeId.agent("s1"))).toBe(main);

    const tool = next.nodes.find((node) => node.id === nodeId.tool("t1"));
    expect(tool).toMatchObject({ x: 12, y: -4, z: 8 });
  });
});

describe("linkStyle", () => {
  test("highlights touched links and hides particles when not flowing", () => {
    const colours = { link: "#111", particle: "#222", message: "#333", focus: "#444" };
    const spawn: Link = { id: "l1", source: "a", target: "b", type: "spawn", live: true };
    const tool: Link = { id: "l2", source: "a", target: "t1", type: "tool", live: true };

    const active = linkStyle(colours, (link) => link.target === "t1", true);
    expect(active.linkColor(tool)).toBe("#444");
    expect(active.linkColor(spawn)).toBe("#333");
    expect(active.linkDirectionalParticles(spawn)).toBe(3);

    const quiet = linkStyle(colours, () => false, false);
    expect(quiet.linkDirectionalParticles(spawn)).toBe(0);
  });
});
