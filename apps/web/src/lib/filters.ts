import type { Graph } from "@rancher/shared/graph";
import type { Filters } from "@/stores/preferences";

export function filterGraph(
  graph: Graph,
  filters: Pick<Filters, "query" | "harness" | "liveOnly"> & { errorsOnly?: boolean },
  now: number,
  liveMs: number,
): Graph {
  const query = filters.query.trim().toLowerCase();
  const failed = (sessionId: string) => Object.values(graph.tools[sessionId] ?? {}).some((tool) => tool.ok === false);
  const hidden = new Set(
    Object.values(graph.sessions)
      .filter(
        (session) =>
          (query && !`${session.title} ${session.cwd ?? ""} ${session.harness}`.toLowerCase().includes(query)) ||
          (filters.harness !== "all" && session.harness !== filters.harness) ||
          (filters.liveOnly && now - Date.parse(session.lastAt) >= liveMs) ||
          (filters.errorsOnly && !failed(session.id)),
      )
      .map((session) => session.id),
  );
  if (hidden.size === 0) return graph;
  const keep = ([id]: [string, unknown]) => !hidden.has(id);
  const sessions = Object.fromEntries(Object.entries(graph.sessions).filter(keep));
  const agents = Object.fromEntries(Object.entries(graph.agents).filter(([, agent]) => !hidden.has(agent.sessionId)));
  const tools = Object.fromEntries(Object.entries(graph.tools).filter(keep));
  return { sessions, agents, tools };
}
