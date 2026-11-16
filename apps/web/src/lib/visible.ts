import type { Graph } from "@rancher/shared/graph";
import { useGraph } from "@/stores/graph";
import { type Filters, usePreferences } from "@/stores/preferences";
import { filterGraph } from "./filters";
import { useNow } from "./time";

type Visible = { graph: Graph; filters: Filters; now: number; liveMs: number; result: Graph };
let cached: Visible | undefined;

// why: the map and the sessions panel filter the same graph, so one cached result serves both and keeps one reference
function visible(graph: Graph, filters: Filters, now: number, liveMs: number) {
  const at = filters.liveOnly ? now : 0;
  if (cached?.graph !== graph || cached.filters !== filters || cached.now !== at || cached.liveMs !== liveMs) {
    cached = { graph, filters, now: at, liveMs, result: filterGraph(graph, filters, at, liveMs) };
  }
  return cached.result;
}

export function useVisibleGraph() {
  const graph = useGraph();
  const filters = usePreferences((state) => state.filters);
  const liveMs = usePreferences((state) => state.display.liveSeconds) * 1000;
  const now = useNow(5000);
  return { graph: visible(graph, filters, now, liveMs), now, liveMs };
}
