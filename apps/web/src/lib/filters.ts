import { forgetSession, type Graph } from "@agent-map/shared/graph";
import type { Filters } from "@/stores/preferences";

export function filterGraph(graph: Graph, filters: Filters, now: number, liveMs: number): Graph {
  const query = filters.query.trim().toLowerCase();
  const hidden = Object.values(graph.sessions).filter(
    (session) =>
      (query && !`${session.title} ${session.cwd ?? ""} ${session.harness}`.toLowerCase().includes(query)) ||
      (filters.harness !== "all" && session.harness !== filters.harness) ||
      (filters.liveOnly && now - Date.parse(session.lastAt) >= liveMs),
  );
  return hidden.reduce((filtered, session) => forgetSession(filtered, session.id), graph);
}
