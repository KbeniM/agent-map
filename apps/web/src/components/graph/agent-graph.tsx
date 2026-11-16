import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import type { Object3D } from "three";
import { useResolvedTheme } from "@/lib/theme";
import { useVisibleGraph } from "@/lib/visible";
import { type ColourBy, usePreferences } from "@/stores/preferences";
import { type Link, type Node, reducedMotion, useFirstFit, useFocus, useForces, useViewSwitch } from "./camera";
import { token } from "./colour";
import { settle } from "./motion";
import { dispose, linkObject, nodeObject, objectKey, RADIUS } from "./objects";
import { linkStyle, projectMap } from "./projection";

type Props = { selected?: string; onSelect: (id?: string) => void };

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
// why: the simulation swaps a link's source and target ids for the node objects once it starts
const endId = (end: unknown) => String(typeof end === "object" && end ? (end as Node).id : end);

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const resize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return size;
}

type Cache = Map<string, { key: string; object: Object3D }>;

function cached(
  cache: Cache,
  id: string,
  key: string,
  build: () => Object3D,
  onNew?: (object: Object3D, fresh: boolean) => void,
) {
  const hit = cache.get(id);
  if (hit?.key === key) return hit.object;
  if (hit) dispose(hit.object);
  const object = build();
  cache.set(id, { key, object });
  onNew?.(object, !hit);
  return object;
}

function useMapData(nodes: Map<string, Node>) {
  const { graph, now, liveMs } = useVisibleGraph();
  const toolsPerAgent = usePreferences((state) => state.display.toolsPerAgent);
  return useMemo(
    () => projectMap(nodes, graph, now, { toolsPerAgent, liveMs }),
    [graph, now, nodes, toolsPerAgent, liveMs],
  );
}

const HUE: Record<ColourBy, (node: Node) => string> = {
  session: (node) => node.sessionId,
  provider: (node) => node.provider ?? "unknown",
  harness: (node) => node.harness,
};

function useObjects(selected: string | undefined, theme: string, showLabel: (link: Link) => boolean) {
  const [nodeObjects] = useState<Cache>(() => new Map());
  const [linkObjects] = useState<Cache>(() => new Map());
  const colourBy = usePreferences((state) => state.display.colourBy);
  return {
    nodeThreeObject: (node: Node) => {
      const look = { selected: node.id === selected, dark: theme === "dark", theme, hue: HUE[colourBy](node) };
      return cached(
        nodeObjects,
        String(node.id),
        objectKey(node, look),
        () => nodeObject(node, look),
        (object, fresh) => settle(object, fresh ? 0.01 : 0.7),
      );
    },
    linkThreeObject: (link: Link) => {
      const visible = showLabel(link);
      return cached(linkObjects, link.id, `${link.label}|${visible}|${theme}`, () => linkObject(link, visible));
    },
  };
}

const DIMENSIONS = { "2d": 2, "3d": 3 } as const;

const pin = (node: Node) => {
  node.fx = node.x;
  node.fy = node.y;
  node.fz = node.z;
};

export function AgentGraph({ selected, onSelect }: Props) {
  const view = usePreferences((state) => state.view);
  const theme = useResolvedTheme();
  const size = useWindowSize();
  const ref = useRef<ForceGraphMethods<Node, Link>>(undefined);
  // why: the simulation keeps x, y and z on the node objects, so each node is reused across renders
  const [nodes] = useState(() => new Map<string, Node>());
  const [hovered, setHovered] = useState<string>();
  const colours = useMemo(
    () => ({
      background: token("--graph-background"),
      link: token("--graph-link"),
      particle: token("--graph-particle"),
      message: token("--graph-message"),
      focus: token("--graph-label"),
      // why: the tokens come from the DOM, so the theme is what tells this memo the values changed
      theme,
    }),
    [theme],
  );

  const data = useMapData(nodes);

  const hasNodes = data.nodes.length > 0;
  useForces(ref);
  useFirstFit(ref, hasNodes, selected);
  useViewSwitch(ref, view);
  const follow = useFocus(ref, nodes, selected, view, hasNodes);

  const focus = hovered ?? selected;
  const touches = (link: Link) => focus !== undefined && (endId(link.source) === focus || endId(link.target) === focus);
  const display = usePreferences((state) => state.display);
  const objects = useObjects(
    selected,
    theme,
    (link) => link.type === "spawn" || touches(link) || (display.toolLabels === "live" && link.live),
  );
  const hover = (id?: string) => setHovered(id);

  return (
    <ForceGraph3D<Node, Link>
      ref={ref}
      width={size.width}
      height={size.height}
      graphData={data}
      numDimensions={DIMENSIONS[view]}
      backgroundColor={colours.background}
      showNavInfo={false}
      nodeRelSize={1}
      nodeVal={(node) => RADIUS[node.type] ** 3}
      nodeThreeObject={objects.nodeThreeObject}
      nodeLabel={(node) => escapeHtml(node.type === "tool" ? node.label : "")}
      linkThreeObjectExtend
      linkThreeObject={objects.linkThreeObject}
      linkPositionUpdate={(object, { start, end }) => {
        object.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
        return false;
      }}
      {...linkStyle(colours, touches, display.particles && !reducedMotion())}
      linkOpacity={0.55}
      linkDirectionalArrowRelPos={1}
      linkDirectionalParticleSpeed={0.01}
      onEngineTick={follow}
      onNodeHover={(node) => hover(node?.id === undefined ? undefined : String(node.id))}
      onLinkHover={(link) => hover(link?.target && endId(link.target))}
      onNodeDragEnd={pin}
      onNodeClick={(node) => onSelect(String(node.id))}
      onBackgroundClick={() => onSelect(undefined)}
    />
  );
}
