import type { MapLink, MapNode } from "@agent-map/shared/layout";
import { type RefObject, useEffect, useRef } from "react";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-3d";
import type { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import type { View } from "@/stores/preferences";

export type Node = NodeObject<MapNode>;
export type Link = LinkObject<MapNode, MapLink>;
type GraphRef = RefObject<ForceGraphMethods<Node, Link> | undefined>;

// why: separate sessions share no links, so without a pull toward the centre they drift out of view
function gravity(strength: number) {
  let nodes: Node[] = [];
  const force = (alpha: number) => {
    for (const node of nodes) {
      node.vx = (node.vx ?? 0) - (node.x ?? 0) * strength * alpha;
      node.vy = (node.vy ?? 0) - (node.y ?? 0) * strength * alpha;
      node.vz = (node.vz ?? 0) - (node.z ?? 0) * strength * alpha;
    }
  };
  force.initialize = (next: Node[]) => {
    nodes = next;
  };
  return force;
}

export function useForces(ref: GraphRef) {
  useEffect(() => {
    const graph = ref.current;
    graph?.d3Force("gravity", gravity(0.04));
    graph?.d3Force("charge")?.strength?.(-45);
    return () => {
      graph?.d3Force("gravity", null);
    };
  }, [ref]);
}

export function useFirstFit(ref: GraphRef, hasNodes: boolean, selected: string | undefined) {
  const fitted = useRef(false);
  useEffect(() => {
    if (!hasNodes || fitted.current || selected) return;
    // why: live sessions keep the simulation warm, so the first fit waits for the layout to spread instead of engine stop
    const timer = setTimeout(() => {
      fitted.current = true;
      ref.current?.zoomToFit(900, 80);
    }, 1500);
    return () => clearTimeout(timer);
  }, [ref, hasNodes, selected]);
}

function cameraFor(node: Node, view: View) {
  const [x, y, z] = [node.x ?? 0, node.y ?? 0, node.z ?? 0];
  const distance = node.type === "tool" ? 90 : 260;
  if (view === "2d") return { x, y, z: distance * 1.6 };
  const ratio = 1 + distance / Math.max(1, Math.hypot(x, y, z));
  return { x: x * ratio, y: y * ratio, z: z * ratio };
}

export function useFocus(
  ref: GraphRef,
  nodes: Map<string, Node>,
  selected: string | undefined,
  view: View,
  ready: boolean,
) {
  const following = useRef<{ id: string; after: number } | undefined>(undefined);

  useEffect(() => {
    if (!selected || !ready) return;
    const focusOn = () => {
      const node = nodes.get(selected);
      if (node?.x === undefined || node.y === undefined) return;
      ref.current?.cameraPosition(cameraFor(node, view), { x: node.x, y: node.y, z: node.z ?? 0 }, 900);
      // why: following starts once the 900 ms camera glide ends, or the two would fight over the target
      following.current = { id: selected, after: performance.now() + 950 };
    };
    // why: a node selected from the URL has no position until the layout has run for a moment
    const timer = setTimeout(focusOn, nodes.get(selected)?.x === undefined ? 2200 : 0);
    return () => {
      clearTimeout(timer);
      following.current = undefined;
    };
  }, [ref, selected, nodes, view, ready]);

  // why: live sessions keep the layout moving, so the camera glides with the selected node instead of losing it
  return () => {
    const follow = following.current;
    const node = follow && performance.now() > follow.after ? nodes.get(follow.id) : undefined;
    const graph = ref.current;
    if (node?.x === undefined || node.y === undefined || !graph) return;
    const target = (graph.controls() as TrackballControls).target;
    const camera = graph.camera().position;
    const step = { x: (node.x - target.x) * 0.12, y: (node.y - target.y) * 0.12, z: ((node.z ?? 0) - target.z) * 0.12 };
    target.set(target.x + step.x, target.y + step.y, target.z + step.z);
    camera.set(camera.x + step.x, camera.y + step.y, camera.z + step.z);
  };
}

export function useViewSwitch(ref: GraphRef, view: View) {
  useEffect(() => {
    const graph = ref.current;
    if (!graph) return;
    (graph.controls() as TrackballControls).noRotate = view === "2d";
    const box = graph.getGraphBbox();
    if (!box) return;
    const center = { x: (box.x[0] + box.x[1]) / 2, y: (box.y[0] + box.y[1]) / 2, z: 0 };
    const distance = Math.max(box.x[1] - box.x[0], box.y[1] - box.y[0], 200) * 1.2;
    const camera =
      view === "2d" ? { ...center, z: distance } : { x: center.x + distance * 0.5, y: center.y, z: distance * 0.85 };
    graph.cameraPosition(camera, center, 900);
  }, [ref, view]);
}
