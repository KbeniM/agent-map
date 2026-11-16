import type { MapLink, MapNode } from "@rancher/shared/layout";
import { type RefObject, useEffect, useRef } from "react";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-3d";
import type { PerspectiveCamera } from "three";
import type { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import type { GraphSpacing, View } from "@/stores/preferences";

export type Node = NodeObject<MapNode>;
export type Link = LinkObject<MapNode, MapLink>;
type GraphRef = RefObject<ForceGraphMethods<Node, Link> | undefined>;

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// why: under reduced motion the camera cuts to its new position instead of gliding
const glide = () => (reducedMotion() ? 0 : 900);

// why: TrackballControls scales pan by eye distance and panSpeed/damping; 1.45 compensates aspect ratio so right-drag feels crisp
export const panSpeedFor = (fovDeg: number, damping: number, multiplier = 1) =>
  2 * Math.tan((fovDeg * Math.PI) / 360) * damping * 1.45 * multiplier;

export function syncPanSpeed(controls: TrackballControls, fov: number, multiplier = 1) {
  const damping = controls.staticMoving ? 1 : controls.dynamicDampingFactor;
  controls.panSpeed = panSpeedFor(fov, damping, multiplier);
}

export function bindControls(controls: TrackballControls, fov: number, onInteract: () => void, multiplier = 1) {
  syncPanSpeed(controls, fov, multiplier);
  // why: three-render-objects creates TrackballControls before renderer.setSize(), leaving screen stuck at 300x150
  controls.handleResize?.();
  controls.addEventListener("start", onInteract);
  const element = controls.domElement;
  const observer =
    typeof ResizeObserver !== "undefined" && element ? new ResizeObserver(() => controls.handleResize()) : undefined;
  if (observer && element) observer.observe(element);
  return () => {
    observer?.disconnect();
    controls.removeEventListener("start", onInteract);
  };
}

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

const SPACING: Record<GraphSpacing, { gravity: number; charge: number; spawn: number; tool: number }> = {
  compact: { gravity: 0.06, charge: -30, spawn: 40, tool: 17 },
  balanced: { gravity: 0.04, charge: -50, spawn: 58, tool: 25 },
  spread: { gravity: 0.025, charge: -85, spawn: 84, tool: 36 },
};

export function useForces(ref: GraphRef, spacing: GraphSpacing) {
  const initial = useRef(true);
  useEffect(() => {
    const graph = ref.current;
    const preset = SPACING[spacing];
    graph?.d3Force("gravity", gravity(preset.gravity));
    graph?.d3Force("charge")?.strength?.(preset.charge);
    graph?.d3Force("link")?.distance?.((link: Link) => (link.type === "spawn" ? preset.spawn : preset.tool));
    if (initial.current) {
      initial.current = false;
    } else {
      graph?.d3ReheatSimulation();
    }
    return () => {
      graph?.d3Force("gravity", null);
    };
  }, [ref, spacing]);
}

export function useFirstFit(ref: GraphRef, hasNodes: boolean, selected: string | undefined) {
  const fitted = useRef(false);
  useEffect(() => {
    const controls = ref.current?.controls() as TrackballControls | undefined;
    if (!controls) return;
    const cancel = () => {
      fitted.current = true;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [ref]);

  useEffect(() => {
    if (!hasNodes || fitted.current || selected) return;
    // why: live sessions keep the simulation warm, so the first fit waits for the layout to spread instead of engine stop
    const timer = setTimeout(() => {
      fitted.current = true;
      ref.current?.zoomToFit(glide(), 80);
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
  panSpeed = 1,
) {
  const following = useRef<{ id: string; after: number } | undefined>(undefined);
  const glidingUntil = useRef(0);
  const panRef = useRef(panSpeed);
  panRef.current = panSpeed;

  useEffect(() => {
    const graph = ref.current;
    const controls = graph?.controls() as TrackballControls | undefined;
    if (!graph || !controls) return;
    const fov = (graph.camera() as PerspectiveCamera).fov || 50;
    return bindControls(
      controls,
      fov,
      () => {
        following.current = undefined;
        if (performance.now() < glidingUntil.current) {
          glidingUntil.current = 0;
          const pos = graph.camera().position;
          const target = controls.target;
          graph.cameraPosition({ x: pos.x, y: pos.y, z: pos.z }, { x: target.x, y: target.y, z: target.z }, 0);
        }
      },
      panRef.current,
    );
  }, [ref]);

  useEffect(() => {
    const graph = ref.current;
    const controls = graph?.controls() as TrackballControls | undefined;
    if (!graph || !controls) return;
    const fov = (graph.camera() as PerspectiveCamera).fov || 50;
    syncPanSpeed(controls, fov, panSpeed);
  }, [ref, panSpeed]);

  useEffect(() => {
    if (!selected || !ready) return;
    const focusOn = () => {
      const node = nodes.get(selected);
      if (node?.x === undefined || node.y === undefined) return;
      const duration = glide();
      ref.current?.cameraPosition(cameraFor(node, view), { x: node.x, y: node.y, z: node.z ?? 0 }, duration);
      const now = performance.now();
      glidingUntil.current = now + duration;
      // why: following starts once the 900 ms camera glide ends, or the two would fight over the target
      following.current = { id: selected, after: now + duration + 50 };
    };
    // why: a node selected from the URL has no position until the layout has run for a moment
    const timer = setTimeout(focusOn, nodes.get(selected)?.x === undefined ? 2200 : 0);
    return () => {
      clearTimeout(timer);
      following.current = undefined;
      glidingUntil.current = 0;
    };
  }, [ref, selected, nodes, view, ready]);

  // why: live sessions keep the layout moving, so the camera glides with the selected node instead of losing it
  return () => {
    const follow = following.current;
    const node = follow && performance.now() > follow.after ? nodes.get(follow.id) : undefined;
    const graph = ref.current;
    if (node?.x === undefined || node.y === undefined || !graph || reducedMotion()) return;
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
    graph.cameraPosition(camera, center, glide());
  }, [ref, view]);
}
