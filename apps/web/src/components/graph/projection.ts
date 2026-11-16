import type { Graph } from "@agent-map/shared/graph";
import { toMap } from "@agent-map/shared/layout";
import type { Link, Node } from "./camera";

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

export type LinkColours = Record<"link" | "particle" | "message" | "focus", string>;

// why: subagent links carry messages and read as blue; tool links stay quiet until hovered or live
export function linkStyle(colours: LinkColours, touches: (link: Link) => boolean, flowing: boolean) {
  const spawn = (link: Link) => link.type === "spawn";
  return {
    linkColor: (link: Link) => (touches(link) ? colours.focus : spawn(link) ? colours.message : colours.link),
    linkWidth: (link: Link) => (touches(link) ? 0.6 : spawn(link) ? 0.5 : 0.25),
    linkDirectionalArrowLength: (link: Link) => (spawn(link) ? 3.5 : 2),
    linkDirectionalArrowColor: (link: Link) => (spawn(link) ? colours.message : colours.link),
    linkDirectionalParticles: (link: Link) => (flowing && link.live ? 3 : 0),
    linkDirectionalParticleWidth: (link: Link) => (spawn(link) ? 2 : 1.4),
    linkDirectionalParticleColor: (link: Link) => (spawn(link) ? colours.message : colours.particle),
  };
}
