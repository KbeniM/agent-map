import type { Graph } from "@rancher/shared/graph";
import { toMap } from "@rancher/shared/layout";
import type { Link, Node } from "./camera";

export const RADIUS = { session: 9, agent: 6, tool: 3 } as const;

export type MapOptions = { toolsPerAgent: number; liveMs: number };

export function projectMap(cache: Map<string, Node>, graph: Graph, now: number, options: MapOptions) {
  const map = toMap(graph, now, options);
  const parents = new Map(map.links.map((link) => [link.target, link.source]));
  const ids = new Set(map.nodes.map((node) => node.id));
  for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
  for (const node of map.nodes) {
    const previous = cache.get(node.id);
    const parent = cache.get(parents.get(node.id) ?? "");
    // why: a new node starts at its parent so it grows out of the agent that spawned it
    const spawn = parent && !previous ? { x: parent.x, y: parent.y, z: parent.z } : {};
    cache.set(node.id, previous ? Object.assign(previous, node) : { ...node, ...spawn });
  }
  return {
    nodes: map.nodes.map((node) => cache.get(node.id) as Node),
    links: map.links.map((link) => ({ ...link })),
  };
}

export type MapSnapshot = { data: { nodes: Node[]; links: Link[] }; topology: string; visual: string };

const topologyKey = (nodes: Node[], links: Link[]) =>
  `${nodes.map((node) => node.id).join("\0")}\n${links.map((link) => link.id).join("\0")}`;

const visualKey = (nodes: Node[], links: Link[]) =>
  `${nodes.map((node) => `${node.id}|${node.label}|${node.live}|${node.ok}|${node.provider}|${node.harness}`).join("\0")}\n${links.map((link) => `${link.id}|${link.type}|${link.live}|${link.label ?? ""}|${link.labelAt ?? ""}`).join("\0")}`;

// why: passing a fresh graphData reference on 5 s timer ticks reheats d3-force and shakes settled nodes
export function reconcileMap(
  previous: MapSnapshot | undefined,
  cache: Map<string, Node>,
  graph: Graph,
  now: number,
  options: MapOptions,
): MapSnapshot {
  const next = projectMap(cache, graph, now, options);
  const topology = topologyKey(next.nodes, next.links);
  const visual = visualKey(next.nodes, next.links);
  // why: three-forcegraph keys link meshes by object identity, so a fresh copy of every link rebuilds every tube and arrow
  const kept = new Map(previous?.data.links.map((link) => [link.id, link]));
  const links = next.links.map((link) => {
    const current = kept.get(link.id);
    if (!current) return link;
    current.type = link.type;
    current.live = link.live;
    current.label = link.label;
    current.labelAt = link.labelAt;
    return current;
  });
  if (previous && previous.topology === topology) return { data: previous.data, topology, visual };
  return { data: { nodes: next.nodes, links }, topology, visual };
}

const INITIAL_RADIUS = 10;
const INITIAL_ANGLE_ROLL = Math.PI * (3 - Math.sqrt(5));
const INITIAL_ANGLE_YAW = (Math.PI * 20) / (9 + Math.sqrt(221));

// why: clearing pins alone reheats from disturbed positions, causing repeated resets to drift into different equilibria
export function resetLayoutNodes(nodes: Node[], dimensions: 2 | 3) {
  const ordered = [...nodes].sort((a, b) => {
    const left = String(a.id);
    const right = String(b.id);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i];
    node.fx = undefined;
    node.fy = undefined;
    node.fz = undefined;
    node.vx = 0;
    node.vy = 0;
    node.vz = 0;
    const radius = INITIAL_RADIUS * (dimensions > 2 ? Math.cbrt(0.5 + i) : Math.sqrt(0.5 + i));
    const roll = i * INITIAL_ANGLE_ROLL;
    if (dimensions === 2) {
      node.x = radius * Math.cos(roll);
      node.y = radius * Math.sin(roll);
      node.z = 0;
    } else {
      const yaw = i * INITIAL_ANGLE_YAW;
      node.x = radius * Math.sin(roll) * Math.cos(yaw);
      node.y = radius * Math.cos(roll);
      node.z = radius * Math.sin(roll) * Math.sin(yaw);
    }
  }
}

type ArrowLink = Link & { __curve?: { getLength: () => number } };

export type Vec3 = { x: number; y: number; z: number };
export type CurveLike = { getLength: () => number; getPointAt: (u: number) => Vec3 };

export const nodeRadius = (node: Pick<Node, "type" | "id" | "live">, selectedId?: string, halos = true) => {
  const base = RADIUS[node.type] * (node.type === "tool" && node.id === selectedId ? 1.4 : 1);
  const ringed = node.id === selectedId || (halos && node.live);
  return base * (ringed ? 1.08 : 1);
};

const rimOffset = (endR: number, curved: boolean) => endR * 0.22 + (curved ? 0.6 : 0.35);

export function arrowRelPosFor(link: Link): number {
  const start = link.source as Node;
  const end = link.target as Node;
  if (typeof start !== "object" || typeof end !== "object" || start.x === undefined || end.x === undefined) {
    return 0.86;
  }
  const startR = RADIUS[start.type];
  const endR = RADIUS[end.type];
  const arrowLen = link.type === "spawn" ? 2.2 : 1.4;
  const curve = (link as ArrowLink).__curve;
  const dist = Math.hypot(end.x - start.x, (end.y ?? 0) - (start.y ?? 0), (end.z ?? 0) - (start.z ?? 0));
  const lineLen = curve ? curve.getLength() : dist;
  const available = lineLen - startR - endR - arrowLen;
  if (available <= 0.5) return 0.5;
  // why: node rings reach ~1.2x sphere radius, so arrows stop just outside the outer rim rather than poking inside
  const rimExtra = rimOffset(endR, Boolean(curve));
  return Math.max(0.55, Math.min(0.98, 1 - rimExtra / available));
}

export function endTrimDistance(link: Link, endR: number, arrows: boolean, curved: boolean): number {
  if (!arrows) return endR;
  const arrowLen = link.type === "spawn" ? 2.2 : 1.4;
  return endR + rimOffset(endR, curved) + arrowLen * 0.45;
}

export function trimStraightSpan(
  start: Vec3,
  end: Vec3,
  startR: number,
  endR: number,
): { from: Vec3; to: Vec3; span: number } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dy, dz);
  const span = dist - startR - endR;
  if (span <= 0.1 || dist <= 0.001) return null;
  const ux = dx / dist;
  const uy = dy / dist;
  const uz = dz / dist;
  return {
    from: { x: start.x + ux * startR, y: start.y + uy * startR, z: start.z + uz * startR },
    to: { x: end.x - ux * endR, y: end.y - uy * endR, z: end.z - uz * endR },
    span,
  };
}

const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function trimCurveRange(
  curve: CurveLike,
  start: Vec3,
  end: Vec3,
  startR: number,
  endR: number,
): [number, number] | null {
  const len = curve.getLength();
  if (len <= startR + endR + 0.2) return null;
  let lo = 0;
  let hi = 0.5;
  if (dist3(curve.getPointAt(hi), start) < startR) return null;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (dist3(curve.getPointAt(mid), start) >= startR) hi = mid;
    else lo = mid;
  }
  const uStart = hi;
  lo = uStart;
  hi = 1;
  if (dist3(curve.getPointAt(lo), end) < endR) return null;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (dist3(curve.getPointAt(mid), end) >= endR) lo = mid;
    else hi = mid;
  }
  const uEnd = lo;
  if (uEnd - uStart <= 0.005) return null;
  return [uStart, uEnd];
}

export type LinkColours = Record<"link" | "particle" | "message" | "focus", string>;

// why: subagent links carry messages and read as blue; tool links stay quiet until hovered or live
export function linkStyle(colours: LinkColours, touches: (link: Link) => boolean, flowing: boolean, arrows = true) {
  const spawn = (link: Link) => link.type === "spawn";
  return {
    linkColor: (link: Link) => (touches(link) ? colours.focus : spawn(link) ? colours.message : colours.link),
    linkWidth: (link: Link) => (touches(link) ? 0.6 : spawn(link) ? 0.5 : 0.25),
    linkDirectionalArrowLength: (link: Link) => (!arrows ? 0 : spawn(link) ? 2.2 : 1.4),
    linkDirectionalArrowColor: (link: Link) =>
      touches(link) ? colours.focus : spawn(link) ? colours.message : colours.link,
    linkDirectionalParticles: (link: Link) => (flowing && link.live ? 3 : 0),
    linkDirectionalParticleWidth: (link: Link) => (spawn(link) ? 2 : 1.4),
    linkDirectionalParticleColor: (link: Link) => (spawn(link) ? colours.message : colours.particle),
  };
}
