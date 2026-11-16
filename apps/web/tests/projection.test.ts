import { describe, expect, test } from "bun:test";
import { applyAll, emptyGraph } from "@rancher/shared/graph";
import { nodeId } from "@rancher/shared/layout";
import * as THREE from "three";
import type { Link, Node } from "../src/components/graph/camera";
import {
  arrowRelPosFor,
  endTrimDistance,
  linkStyle,
  nodeRadius,
  projectMap,
  RADIUS,
  reconcileMap,
  resetLayoutNodes,
  trimCurveRange,
  trimStraightSpan,
} from "../src/components/graph/projection";

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

describe("reconcileMap", () => {
  test("reuses graphData when topology is unchanged, updates visual state in place, and replaces on topology change", () => {
    const cache = new Map<string, Node>();
    const base = applyAll(emptyGraph(), [
      { type: "session.started", sessionId: "s1", harness: "codex", title: "One", at },
      { type: "tool.started", sessionId: "s1", agentId: "s1", toolId: "t1", name: "Read", at },
    ]);
    const options = { toolsPerAgent: 5, liveMs: 30_000 };

    const first = reconcileMap(undefined, cache, base, now, options);
    // why: d3-force replaces string link ends with Node references after start
    const simLink = first.data.links[0] as unknown as { source: unknown; target: unknown; live: boolean };
    simLink.source = first.data.nodes[0];
    simLink.target = first.data.nodes[1];

    const idleTick = reconcileMap(first, cache, base, now + 5000, options);
    expect(idleTick.data).toBe(first.data);
    expect(idleTick.visual).toBe(first.visual);

    const finished = applyAll(base, [{ type: "tool.finished", sessionId: "s1", toolId: "t1", ok: true, at }]);
    const visualOnly = reconcileMap(idleTick, cache, finished, now + 5000, options);
    expect(visualOnly.data).toBe(first.data);
    expect(visualOnly.visual).not.toBe(first.visual);
    expect(simLink.live).toBe(false);
    expect(simLink.source).toBe(first.data.nodes[0]);

    const added = applyAll(finished, [
      { type: "tool.started", sessionId: "s1", agentId: "s1", toolId: "t2", name: "Edit", at },
    ]);
    const structural = reconcileMap(visualOnly, cache, added, now + 5000, options);
    expect(structural.data).not.toBe(first.data);
    expect(structural.data.nodes).toHaveLength(3);
    expect(structural.data.links[0]).toBe(first.data.links[0]);

    const withSubagent = applyAll(base, [
      { type: "agent.started", sessionId: "s1", agentId: "sub", parentAgentId: "s1", name: "Scout", at },
    ]);
    const subFirst = reconcileMap(undefined, new Map(), withSubagent, now, options);
    const laterAt = "2026-11-16T10:00:04.000Z";
    const withMsg = applyAll(withSubagent, [
      { type: "message", sessionId: "s1", agentId: "sub", role: "user", text: "Check auth", at: laterAt },
    ]);
    const subMsg = reconcileMap(subFirst, new Map(), withMsg, now, options);
    expect(subMsg.data).toBe(subFirst.data);
    expect(subMsg.data.links.find((link) => link.type === "spawn")).toMatchObject({
      label: "Check auth",
      labelAt: laterAt,
    });
  });
});

describe("arrowRelPosFor", () => {
  test("stops directional arrow outside the target node rim and ring", () => {
    const start: Node = {
      id: "a",
      type: "session",
      label: "Main",
      sessionId: "s",
      live: true,
      harness: "codex",
      x: 0,
      y: 0,
      z: 0,
    };
    const end: Node = {
      id: "b",
      type: "agent",
      label: "Sub",
      sessionId: "s",
      live: true,
      harness: "codex",
      x: 58,
      y: 0,
      z: 0,
    };
    const link = { id: "a>b", source: start, target: end, type: "spawn", live: true } as unknown as Link;
    const rel = arrowRelPosFor(link);
    const arrowLen = 2.2;
    const posAlongLine = RADIUS.session + arrowLen + (58 - RADIUS.session - RADIUS.agent - arrowLen) * rel;
    const tipDistFromCenter = 58 - posAlongLine;
    expect(tipDistFromCenter).toBeGreaterThan(RADIUS.agent * 1.2);
    expect(rel).toBeLessThan(0.99);
  });
});

describe("surface trimming", () => {
  test("trims straight connectors to node rims and hides overlapping spans", () => {
    const span = trimStraightSpan({ x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, 9, 6);
    expect(span).not.toBeNull();
    expect(span?.from.x).toBeCloseTo(9, 4);
    expect(span?.to.x).toBeCloseTo(34, 4);
    expect(span?.span).toBeCloseTo(25, 4);

    expect(trimStraightSpan({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 9, 6)).toBeNull();
  });

  test("trims curved connectors so endpoints never enter either node sphere", () => {
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(60, 0, 0);
    const curve = new THREE.QuadraticBezierCurve3(start, new THREE.Vector3(30, 12, 0), end);
    const range = trimCurveRange(curve, start, end, 9, 8);
    expect(range).not.toBeNull();
    if (!range) return;
    const [u0, u1] = range;
    expect(curve.getPointAt(u0).distanceTo(start)).toBeGreaterThanOrEqual(8.99);
    expect(curve.getPointAt(u1).distanceTo(end)).toBeGreaterThanOrEqual(7.99);

    const tiny = new THREE.QuadraticBezierCurve3(start, new THREE.Vector3(5, 1, 0), new THREE.Vector3(10, 0, 0));
    expect(trimCurveRange(tiny, start, { x: 10, y: 0, z: 0 }, 9, 6)).toBeNull();
  });

  test("computes nodeRadius and endTrimDistance for selected tools and directional arrows", () => {
    expect(nodeRadius({ id: "t1", type: "tool", live: false })).toBe(RADIUS.tool);
    expect(nodeRadius({ id: "t1", type: "tool", live: true })).toBeCloseTo(RADIUS.tool * 1.08, 4);
    expect(nodeRadius({ id: "t1", type: "tool", live: false }, "t1")).toBeCloseTo(RADIUS.tool * 1.4 * 1.08, 4);
    const spawn: Link = { id: "a>b", source: "a", target: "b", type: "spawn", live: true };
    expect(endTrimDistance(spawn, RADIUS.agent, false, true)).toBe(RADIUS.agent);
    expect(endTrimDistance(spawn, RADIUS.agent, true, true)).toBeGreaterThan(RADIUS.agent * 1.22);
  });
});

describe("linkStyle", () => {
  test("highlights touched links and arrows, and hides particles or arrows when disabled", () => {
    const colours = { link: "#111", particle: "#222", message: "#333", focus: "#444" };
    const spawn: Link = { id: "l1", source: "a", target: "b", type: "spawn", live: true };
    const tool: Link = { id: "l2", source: "a", target: "t1", type: "tool", live: true };

    const active = linkStyle(colours, (link) => link.target === "t1", true, true);
    expect(active.linkColor(tool)).toBe("#444");
    expect(active.linkDirectionalArrowColor(tool)).toBe("#444");
    expect(active.linkColor(spawn)).toBe("#333");
    expect(active.linkDirectionalArrowLength(spawn)).toBe(2.2);
    expect(active.linkDirectionalArrowLength(tool)).toBe(1.4);
    expect(active.linkDirectionalParticles(spawn)).toBe(3);

    const quiet = linkStyle(colours, () => false, false, false);
    expect(quiet.linkDirectionalParticles(spawn)).toBe(0);
    expect(quiet.linkDirectionalArrowLength(spawn)).toBe(0);
  });
});

describe("resetLayoutNodes", () => {
  test("clears pins and velocities and assigns identical canonical coordinates regardless of prior state or order", () => {
    const makeNodes = (): Node[] => [
      { id: "n2", type: "agent", label: "Two", sessionId: "s1", live: true, harness: "codex" },
      { id: "n1", type: "session", label: "One", sessionId: "s1", live: true, harness: "codex" },
      { id: "n3", type: "tool", label: "Three", sessionId: "s1", live: false, harness: "codex" },
    ];

    const first = makeNodes();
    first[0].x = 123;
    first[0].y = -45;
    first[0].z = 67;
    first[0].vx = 4;
    first[0].vy = -2;
    first[0].vz = 9;
    first[0].fx = 123;
    first[0].fy = -45;
    first[0].fz = 67;
    resetLayoutNodes(first, 3);

    const second = makeNodes().reverse();
    second[1].x = -300;
    second[1].y = 88;
    second[1].z = -12;
    second[1].vx = -7;
    resetLayoutNodes(second, 3);

    const byId = (list: Node[]) =>
      Object.fromEntries(
        list.map((node) => [
          node.id,
          {
            x: node.x,
            y: node.y,
            z: node.z,
            vx: node.vx,
            vy: node.vy,
            vz: node.vz,
            fx: node.fx,
            fy: node.fy,
            fz: node.fz,
          },
        ]),
      );

    expect(byId(first)).toEqual(byId(second));
    for (const node of first) {
      expect(node.fx).toBeUndefined();
      expect(node.fy).toBeUndefined();
      expect(node.fz).toBeUndefined();
      expect(node.vx).toBe(0);
      expect(node.vy).toBe(0);
      expect(node.vz).toBe(0);
    }

    resetLayoutNodes(first, 2);
    for (const node of first) expect(node.z).toBe(0);
  });
});
