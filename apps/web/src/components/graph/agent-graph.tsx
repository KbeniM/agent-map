import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import type { Object3D } from "three";
import { useResolvedTheme } from "@/lib/theme";
import { useVisibleGraph } from "@/lib/visible";
import { useMapStore } from "@/stores/map";
import { type ColourBy, type LabelVisibility, usePreferences } from "@/stores/preferences";
import { type Link, type Node, reducedMotion, useFirstFit, useFocus, useForces, useViewSwitch } from "./camera";
import { token } from "./colour";
import { demandFrames, useRenderOnDemand } from "./demand";
import { release, settle } from "./motion";
import {
  clipLinkParticles,
  linkObject,
  nodeObject,
  placeLinkObject,
  RADIUS,
  syncLinkObject,
  syncNodeObject,
} from "./objects";
import { arrowRelPosFor, linkStyle, type MapSnapshot, reconcileMap, resetLayoutNodes } from "./projection";

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

function useMapData(nodes: Map<string, Node>) {
  const { graph, now, liveMs } = useVisibleGraph();
  const toolsPerAgent = usePreferences((state) => state.display.toolsPerAgent);
  const previous = useRef<MapSnapshot | undefined>(undefined);
  const snapshot = useMemo(
    () => reconcileMap(previous.current, nodes, graph, now, { toolsPerAgent, liveMs }),
    [graph, now, nodes, toolsPerAgent, liveMs],
  );
  useLayoutEffect(() => {
    previous.current = snapshot;
  }, [snapshot]);
  return snapshot;
}

const HUE: Record<ColourBy, (node: Node) => string> = {
  session: (node) => node.sessionId,
  provider: (node) => node.provider ?? "unknown",
  harness: (node) => node.harness,
};

const DIMENSIONS = { "2d": 2, "3d": 3 } as const;
const RENDERER_CONFIG = { antialias: true, alpha: false, powerPreference: "high-performance" } as const;

const pin = (node: Node) => {
  node.fx = node.x;
  node.fy = node.y;
  node.fz = node.z;
};

type NodeWithObj = Node & { __threeObj?: Object3D };

const MESSAGE_LABEL_MS = 5000;
const isMessageFlashVisible = (link: Link, at = Date.now()) =>
  link.type === "spawn" &&
  Boolean(link.label && link.labelAt) &&
  at - Date.parse(link.labelAt as string) < MESSAGE_LABEL_MS;
const isLinkLabelVisible = (link: Link, touched: boolean, at = Date.now()) =>
  touched || isMessageFlashVisible(link, at);
const isNodeLabelVisible = (labels: LabelVisibility, selected: boolean, live: boolean) =>
  labels === "all" || (labels === "focus" && (selected || live));

export function AgentGraph({ selected, onSelect }: Props) {
  const view = usePreferences((state) => state.view);
  const display = usePreferences((state) => state.display);
  const paused = useMapStore((state) => state.paused);
  const fitTick = useMapStore((state) => state.fitTick);
  const reheatTick = useMapStore((state) => state.reheatTick);
  const theme = useResolvedTheme();
  const size = useWindowSize();
  const ref = useRef<ForceGraphMethods<Node, Link>>(undefined);
  // why: the simulation keeps x, y and z on the node objects, so each node is reused across renders
  const [nodes] = useState(() => new Map<string, Node>());
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

  const snapshot = useMapData(nodes);
  const data = snapshot.data;
  const hasNodes = data.nodes.length > 0;
  useForces(ref, display.spacing ?? "balanced");
  useFirstFit(ref, hasNodes, selected);
  useViewSwitch(ref, view);
  const follow = useFocus(ref, nodes, selected, view, hasNodes, display.panSpeed ?? 1);

  const hoveredRef = useRef<string | undefined>(undefined);
  const stateRef = useRef({
    selected,
    view,
    theme,
    colourBy: display.colourBy,
    flowing: display.particles && !reducedMotion(),
    arrows: display.arrows ?? true,
    curvedLinks: display.curvedLinks ?? true,
    halos: display.halos ?? true,
    labels: display.labels ?? ("all" as LabelVisibility),
    colours,
    data,
    follow,
    onSelect,
  });
  useLayoutEffect(() => {
    stateRef.current = {
      selected,
      view,
      theme,
      colourBy: display.colourBy,
      flowing: display.particles && !reducedMotion(),
      arrows: display.arrows ?? true,
      curvedLinks: display.curvedLinks ?? true,
      halos: display.halos ?? true,
      labels: display.labels ?? "all",
      colours,
      data,
      follow,
      onSelect,
    };
  }, [selected, view, theme, display, colours, data, follow, onSelect]);

  // why: particles move along live links, so the map keeps drawing while any link is live
  useRenderOnDemand(
    ref as never,
    () => stateRef.current.flowing && stateRef.current.data.links.some((link) => link.live),
  );

  const seenNodes = useRef(new Set<string>());
  const prevNodes = useRef<NodeWithObj[]>([]);
  const syncedData = useRef<MapSnapshot["data"] | undefined>(undefined);
  const prevTopologySettings = useRef({ arrows: display.arrows ?? true, curvedLinks: display.curvedLinks ?? true });

  useEffect(() => {
    if (fitTick > 0) ref.current?.zoomToFit(reducedMotion() ? 0 : 600, 80);
  }, [fitTick]);

  useEffect(() => {
    if (reheatTick === 0) return;
    resetLayoutNodes(stateRef.current.data.nodes, DIMENSIONS[stateRef.current.view]);
    ref.current?.d3ReheatSimulation();
    demandFrames(2500);
  }, [reheatTick]);

  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) ref.current?.d3ReheatSimulation();
    wasPaused.current = paused;
  }, [paused]);

  useEffect(() => {
    const currentSet = new Set(snapshot.data.nodes);
    for (const old of prevNodes.current) {
      if (!currentSet.has(old) && old.__threeObj) {
        release(old.__threeObj);
        seenNodes.current.delete(String(old.id));
      }
    }
    prevNodes.current = snapshot.data.nodes as NodeWithObj[];

    const focus = hoveredRef.current ?? selected;
    const flowing = display.particles && !reducedMotion();
    const halos = display.halos ?? true;
    const labels = display.labels ?? "all";
    const arrows = display.arrows ?? true;
    const curvedLinks = display.curvedLinks ?? true;
    const topologyChanged =
      prevTopologySettings.current.arrows !== arrows || prevTopologySettings.current.curvedLinks !== curvedLinks;
    prevTopologySettings.current = { arrows, curvedLinks };

    if (syncedData.current === snapshot.data) {
      const dark = theme === "dark";
      const nowMs = Date.now();
      for (const node of snapshot.data.nodes as NodeWithObj[]) {
        if (!node.__threeObj) continue;
        const isSelected = node.id === selected;
        syncNodeObject(node.__threeObj, node, {
          selected: isSelected,
          dark,
          theme,
          hue: HUE[display.colourBy](node),
          halos,
          showLabel: isNodeLabelVisible(labels, isSelected, node.live),
        });
      }
      let needsRefresh = topologyChanged;
      for (const link of snapshot.data.links) {
        const touched = focus !== undefined && (endId(link.source) === focus || endId(link.target) === focus);
        if (
          syncLinkObject(
            link,
            touched,
            isLinkLabelVisible(link, touched, nowMs),
            colours,
            flowing,
            selected,
            arrows,
            halos,
          )
        )
          needsRefresh = true;
      }
      if (needsRefresh) ref.current?.refresh();
    }
    syncedData.current = snapshot.data;

    let timer: number | undefined;
    const scheduleExpiry = () => {
      const nowMs = Date.now();
      let earliest = Number.POSITIVE_INFINITY;
      for (const link of snapshot.data.links) {
        if (link.type !== "spawn" || !link.label || !link.labelAt) continue;
        const expiresAt = Date.parse(link.labelAt) + MESSAGE_LABEL_MS;
        if (expiresAt > nowMs && expiresAt < earliest) earliest = expiresAt;
      }
      if (!Number.isFinite(earliest)) return;
      timer = window.setTimeout(
        () => {
          const s = stateRef.current;
          const currentFocus = hoveredRef.current ?? s.selected;
          const currentNow = Date.now();
          for (const link of snapshot.data.links) {
            const touched =
              currentFocus !== undefined &&
              (endId(link.source) === currentFocus || endId(link.target) === currentFocus);
            syncLinkObject(
              link,
              touched,
              isLinkLabelVisible(link, touched, currentNow),
              s.colours,
              s.flowing,
              s.selected,
              s.arrows,
              s.halos,
            );
          }
          scheduleExpiry();
        },
        Math.max(20, earliest - nowMs + 20),
      );
    };
    scheduleExpiry();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [snapshot, selected, theme, display, colours]);

  useEffect(() => {
    const scene = ref.current?.scene();
    if (!scene) return;
    const previous = scene.onBeforeRender;
    // why: three-forcegraph places directional particles along center-to-center curves right before rendering
    scene.onBeforeRender = (...args) => {
      previous.apply(scene, args);
      const s = stateRef.current;
      clipLinkParticles(s.data.links, s.selected, s.halos, s.arrows);
    };
    return () => {
      scene.onBeforeRender = previous;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const node of prevNodes.current) if (node.__threeObj) release(node.__threeObj);
    };
  }, []);

  // why: ForceGraph3D clears and rebuilds all Three.js objects whenever accessor prop references change
  const accessors = useMemo(() => {
    const focusId = () => hoveredRef.current ?? stateRef.current.selected;
    const touches = (link: Link) => {
      const focus = focusId();
      return focus !== undefined && (endId(link.source) === focus || endId(link.target) === focus);
    };
    const linkDelegates = linkStyle(stateRef.current.colours, touches, stateRef.current.flowing);
    const hover = (next?: string) => {
      const prev = hoveredRef.current;
      if (prev === next) return;
      hoveredRef.current = next;
      const s = stateRef.current;
      const prevFocus = prev ?? s.selected;
      const focus = next ?? s.selected;
      const nowMs = Date.now();
      for (const link of s.data.links) {
        const src = endId(link.source);
        const tgt = endId(link.target);
        if (src !== prevFocus && tgt !== prevFocus && src !== focus && tgt !== focus) continue;
        const touched = focus !== undefined && (src === focus || tgt === focus);
        syncLinkObject(
          link,
          touched,
          isLinkLabelVisible(link, touched, nowMs),
          s.colours,
          s.flowing,
          s.selected,
          s.arrows,
          s.halos,
        );
      }
    };
    return {
      nodeVal: (node: Node) => RADIUS[node.type] ** 3,
      nodeLabel: (node: Node) => escapeHtml(node.type === "tool" ? node.label : ""),
      nodeThreeObject: (node: Node) => {
        const s = stateRef.current;
        const id = String(node.id);
        const isSelected = node.id === s.selected;
        const object = nodeObject(node, {
          selected: isSelected,
          dark: s.theme === "dark",
          theme: s.theme,
          hue: HUE[s.colourBy](node),
          halos: s.halos,
          showLabel: isNodeLabelVisible(s.labels, isSelected, node.live),
        });
        const fresh = !seenNodes.current.has(id);
        seenNodes.current.add(id);
        settle(object, fresh ? 0.01 : 0.7);
        return object;
      },
      linkThreeObject: (link: Link) => {
        const touched = touches(link);
        return linkObject(link, isLinkLabelVisible(link, touched), stateRef.current.colours, touched);
      },
      linkPositionUpdate: (
        object: Object3D,
        { start, end }: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } },
        link: unknown,
      ) => {
        const typed = link as Link;
        const s = stateRef.current;
        placeLinkObject(object, typed, start, end, {
          selectedId: s.selected,
          halos: s.halos,
          arrows: s.arrows,
          touched: touches(typed),
        });
        return true;
      },
      linkColor: (link: Link) =>
        touches(link)
          ? stateRef.current.colours.focus
          : link.type === "spawn"
            ? stateRef.current.colours.message
            : stateRef.current.colours.link,
      linkWidth: linkDelegates.linkWidth,
      linkCurvature: (link: Link) => (stateRef.current.curvedLinks && link.type === "spawn" ? 0.14 : 0),
      linkDirectionalArrowLength: (link: Link) =>
        !stateRef.current.arrows ? 0 : linkDelegates.linkDirectionalArrowLength(link),
      linkDirectionalArrowColor: (link: Link) =>
        touches(link)
          ? stateRef.current.colours.focus
          : link.type === "spawn"
            ? stateRef.current.colours.message
            : stateRef.current.colours.link,
      linkDirectionalArrowRelPos: arrowRelPosFor,
      linkDirectionalParticles: (link: Link) => (stateRef.current.flowing && link.live ? 3 : 0),
      linkDirectionalParticleWidth: linkDelegates.linkDirectionalParticleWidth,
      linkDirectionalParticleColor: (link: Link) =>
        link.type === "spawn" ? stateRef.current.colours.message : stateRef.current.colours.particle,
      onEngineTick: () => {
        demandFrames();
        stateRef.current.follow();
      },
      onNodeHover: (node: Node | null) => hover(node?.id === undefined ? undefined : String(node.id)),
      onLinkHover: (link: Link | null) => hover(link?.target ? endId(link.target) : undefined),
      onNodeClick: (node: Node) => stateRef.current.onSelect(String(node.id)),
      onBackgroundClick: () => stateRef.current.onSelect(undefined),
    };
  }, []);

  return (
    <ForceGraph3D<Node, Link>
      ref={ref}
      width={size.width}
      height={size.height}
      rendererConfig={RENDERER_CONFIG}
      graphData={data}
      numDimensions={DIMENSIONS[view]}
      cooldownTicks={paused ? 0 : Infinity}
      d3AlphaDecay={0.045}
      d3VelocityDecay={0.55}
      backgroundColor={colours.background}
      showNavInfo={false}
      nodeRelSize={1}
      linkOpacity={0.55}
      linkDirectionalParticleSpeed={display.particleSpeed ?? 0.004}
      onNodeDragEnd={pin}
      {...accessors}
    />
  );
}
