import type { MapLink, MapNode } from "@agent-map/shared/layout";
import { toMap } from "@agent-map/shared/layout";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-3d";
import type { Object3D } from "three";
import { useNow } from "@/lib/time";
import { useGraph } from "@/stores/graph";
import { token } from "./colour";
import { dispose, nodeObject, objectKey } from "./objects";

type Node = NodeObject<MapNode>;
type Props = { selected?: string; onSelect: (id?: string) => void };

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const resize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return size;
}

export function AgentGraph({ selected, onSelect }: Props) {
  const graph = useGraph((state) => state.graph);
  const now = useNow(5000);
  const size = useWindowSize();
  const ref = useRef<ForceGraphMethods<Node, MapLink>>(undefined);
  // why: the simulation keeps x, y and z on the node objects, so each node is reused across renders
  const [nodes] = useState(() => new Map<string, Node>());
  const objects = useRef(new Map<string, { key: string; object: Object3D }>());
  const fitted = useRef(false);
  const colours = useMemo(
    () => ({
      background: token("--graph-background"),
      link: token("--graph-link"),
      particle: token("--graph-particle"),
    }),
    [],
  );

  const data = useMemo(() => {
    const map = toMap(graph, now);
    const parents = new Map(map.links.map((link) => [link.target, link.source]));
    const ids = new Set(map.nodes.map((node) => node.id));
    for (const id of nodes.keys()) if (!ids.has(id)) nodes.delete(id);
    for (const node of map.nodes) {
      const previous = nodes.get(node.id);
      const parent = nodes.get(parents.get(node.id) ?? "");
      // why: a new node starts at its parent so it grows out of the agent that spawned it
      const spawn = parent && !previous ? { x: parent.x, y: parent.y, z: parent.z } : {};
      nodes.set(node.id, previous ? Object.assign(previous, node) : { ...node, ...spawn });
    }
    return {
      nodes: map.nodes.map((node) => nodes.get(node.id) as Node),
      links: map.links.map((link) => ({ ...link })),
    };
  }, [graph, now, nodes]);

  const hasNodes = data.nodes.length > 0;
  useEffect(() => {
    if (!hasNodes || fitted.current || selected) return;
    // why: live sessions keep the simulation warm, so the first fit waits for the layout to spread instead of engine stop
    const timer = setTimeout(() => {
      fitted.current = true;
      ref.current?.zoomToFit(800, 80);
    }, 1500);
    return () => clearTimeout(timer);
  }, [hasNodes, selected]);

  useEffect(() => {
    const node = selected ? nodes.get(selected) : undefined;
    if (!node || node.x === undefined || node.y === undefined || node.z === undefined) return;
    const distance = node.type === "tool" ? 40 : 90;
    const ratio = 1 + distance / Math.max(1, Math.hypot(node.x, node.y, node.z));
    ref.current?.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      { x: node.x, y: node.y, z: node.z },
      900,
    );
  }, [selected, nodes]);

  const threeObject = (node: Node) => {
    const key = objectKey(node, node.id === selected);
    const cached = objects.current.get(node.id);
    if (cached?.key === key) return cached.object;
    if (cached) dispose(cached.object);
    const object = nodeObject(node, node.id === selected);
    objects.current.set(node.id, { key, object });
    return object;
  };

  return (
    <ForceGraph3D<MapNode, MapLink>
      ref={ref}
      width={size.width}
      height={size.height}
      graphData={data}
      backgroundColor={colours.background}
      showNavInfo={false}
      nodeThreeObject={threeObject}
      nodeLabel={(node) => (node.type === "tool" ? escapeHtml(node.label) : "")}
      linkColor={() => colours.link}
      linkOpacity={0.35}
      linkWidth={(link) => (link.live ? 0.6 : 0.25)}
      linkDirectionalParticles={(link) => (link.live ? 3 : 0)}
      linkDirectionalParticleWidth={1.4}
      linkDirectionalParticleSpeed={0.012}
      linkDirectionalParticleColor={() => colours.particle}
      onNodeClick={(node) => onSelect(String(node.id))}
      onBackgroundClick={() => onSelect(undefined)}
    />
  );
}
