import type { AgentEvent } from "@agent-map/shared/events";
import { applyAll, emptyGraph, forgetSession, type Graph, mergeGraphs } from "@agent-map/shared/graph";
import { useMemo } from "react";
import { create } from "zustand";

export type Connection = "connecting" | "open" | "unauthorized" | "closed";

type GraphStore = {
  graphs: Record<string, Graph>;
  connections: Record<string, Connection>;
  receive: (bridgeId: string, events: AgentEvent[]) => void;
  reset: (bridgeId: string) => void;
  forget: (bridgeId: string, sessionId: string) => void;
  drop: (bridgeId: string) => void;
  setConnection: (bridgeId: string, connection: Connection) => void;
};

export const useGraphs = create<GraphStore>()((set) => ({
  graphs: {},
  connections: {},
  receive: (bridgeId, events) =>
    set((state) => ({
      graphs: { ...state.graphs, [bridgeId]: applyAll(state.graphs[bridgeId] ?? emptyGraph(), events) },
    })),
  reset: (bridgeId) => set((state) => ({ graphs: { ...state.graphs, [bridgeId]: emptyGraph() } })),
  forget: (bridgeId, sessionId) =>
    set((state) => ({
      graphs: { ...state.graphs, [bridgeId]: forgetSession(state.graphs[bridgeId] ?? emptyGraph(), sessionId) },
    })),
  drop: (bridgeId) =>
    set((state) => {
      const { [bridgeId]: _graph, ...graphs } = state.graphs;
      const { [bridgeId]: _connection, ...connections } = state.connections;
      return { graphs, connections };
    }),
  setConnection: (bridgeId, connection) =>
    set((state) => ({ connections: { ...state.connections, [bridgeId]: connection } })),
}));

export function useGraph() {
  const graphs = useGraphs((state) => state.graphs);
  return useMemo(() => mergeGraphs(Object.values(graphs)), [graphs]);
}

export function useSessionBridge() {
  const graphs = useGraphs((state) => state.graphs);
  return (sessionId: string) => Object.entries(graphs).find(([, graph]) => graph.sessions[sessionId])?.[0];
}
