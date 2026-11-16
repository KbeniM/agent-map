import type { AgentEvent } from "@agent-map/shared/events";
import { applyAll, emptyGraph, type Graph } from "@agent-map/shared/graph";
import { create } from "zustand";

type Connection = "connecting" | "open" | "closed";

type GraphStore = {
  graph: Graph;
  connection: Connection;
  receive: (events: AgentEvent[]) => void;
  reset: () => void;
  setConnection: (connection: Connection) => void;
};

export const useGraph = create<GraphStore>()((set) => ({
  graph: emptyGraph(),
  connection: "connecting",
  receive: (events) => set((state) => ({ graph: applyAll(state.graph, events) })),
  reset: () => set({ graph: emptyGraph() }),
  setConnection: (connection) => set({ connection }),
}));
