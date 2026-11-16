import { useMemo } from "react";
import { useGraph } from "@/stores/graph";
import { usePreferences } from "@/stores/preferences";
import { filterGraph } from "./filters";
import { useNow } from "./time";

export function useVisibleGraph() {
  const graph = useGraph();
  const filters = usePreferences((state) => state.filters);
  const liveMs = usePreferences((state) => state.display.liveSeconds) * 1000;
  const now = useNow(5000);
  return { graph: useMemo(() => filterGraph(graph, filters, now, liveMs), [graph, filters, now, liveMs]), now, liveMs };
}
