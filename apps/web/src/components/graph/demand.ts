import { type RefObject, useEffect, useRef } from "react";
import type { ForceGraphMethods } from "react-force-graph-3d";

type Graph = ForceGraphMethods<never, never>;

let awakeUntil = 0;
let wake: (() => void) | undefined;

// why: the map draws thousands of objects per frame, so frames render only while something on it moves
export function demandFrames(ms = 300) {
  awakeUntil = Math.max(awakeUntil, performance.now() + ms);
  wake?.();
}

const INTERACTION_MS = 1500;
const EVENTS = ["pointerdown", "pointermove", "wheel", "touchstart", "touchmove"] as const;

export function useRenderOnDemand(ref: RefObject<ForceGraphMethods<never, never> | undefined>, busy: () => boolean) {
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  });
  useEffect(() => {
    const graph = ref.current as Graph | undefined;
    if (!graph) return;
    const canvas = graph.renderer().domElement;
    const interact = () => demandFrames(INTERACTION_MS);
    const { cameraPosition, zoomToFit } = graph;
    // why: camera glides start from timers as well as renders, and each glide needs frames until it lands
    graph.cameraPosition = ((...args: Parameters<Graph["cameraPosition"]>) => {
      demandFrames((args[2] ?? 0) + 300);
      return cameraPosition.apply(graph, args);
    }) as Graph["cameraPosition"];
    graph.zoomToFit = ((...args: Parameters<Graph["zoomToFit"]>) => {
      demandFrames((args[0] ?? 0) + 300);
      return zoomToFit.apply(graph, args);
    }) as Graph["zoomToFit"];
    let asleep = false;
    // why: resuming runs a frame synchronously, and that frame calls back here, so the resume waits for the next frame
    wake = () => {
      if (!asleep) return;
      asleep = false;
      requestAnimationFrame(() => graph.resumeAnimation());
    };
    for (const type of EVENTS) canvas.addEventListener(type, interact, { passive: true });
    window.addEventListener("keydown", interact);
    const timer = setInterval(() => {
      if (asleep || performance.now() <= awakeUntil || busyRef.current()) return;
      asleep = true;
      graph.pauseAnimation();
    }, 250);
    demandFrames(INTERACTION_MS);
    return () => {
      clearInterval(timer);
      for (const type of EVENTS) canvas.removeEventListener(type, interact);
      window.removeEventListener("keydown", interact);
      graph.cameraPosition = cameraPosition;
      graph.zoomToFit = zoomToFit;
      wake = undefined;
      graph.resumeAnimation();
    };
  }, [ref]);

  // why: any render can change data, theme, size or selection, and each needs at least one fresh frame
  useEffect(() => {
    demandFrames();
  });
}
