import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_BRIDGE_URL } from "@/lib/env";

export type Theme = "system" | "light" | "dark";
export type View = "3d" | "2d";
export type ColourBy = "session" | "provider" | "harness";
export type ToolLabels = "live" | "hover";

export type Bridge = { id: string; name: string; url: string; token: string; enabled: boolean };
type Display = {
  colourBy: ColourBy;
  toolsPerAgent: number;
  toolLabels: ToolLabels;
  particles: boolean;
  liveSeconds: number;
};
export type Filters = { query: string; harness: string; liveOnly: boolean };

type Preferences = {
  bridges: Bridge[];
  theme: Theme;
  view: View;
  display: Display;
  filters: Filters;
  saveBridge: (bridge: Bridge) => void;
  removeBridge: (id: string) => void;
  setTheme: (theme: Theme) => void;
  setView: (view: View) => void;
  setDisplay: (display: Partial<Display>) => void;
  setFilters: (filters: Partial<Filters>) => void;
};

const LOCAL_BRIDGE: Bridge = {
  id: "local",
  name: "This machine",
  url: DEFAULT_BRIDGE_URL,
  token: "",
  enabled: true,
};
const DEFAULT_DISPLAY: Display = {
  colourBy: "session",
  toolsPerAgent: 8,
  toolLabels: "live",
  particles: true,
  liveSeconds: 30,
};
const DEFAULT_FILTERS: Filters = { query: "", harness: "all", liveOnly: false };

// why: index.html reads this key before first paint to avoid a theme flash, keep both in sync
const PREFERENCES_KEY = "agent-map-preferences";

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      bridges: [LOCAL_BRIDGE],
      theme: "system",
      view: "3d",
      display: DEFAULT_DISPLAY,
      filters: DEFAULT_FILTERS,
      saveBridge: (bridge) =>
        set((state) => ({
          bridges: state.bridges.some((other) => other.id === bridge.id)
            ? state.bridges.map((other) => (other.id === bridge.id ? bridge : other))
            : [...state.bridges, bridge],
        })),
      removeBridge: (id) => set((state) => ({ bridges: state.bridges.filter((bridge) => bridge.id !== id) })),
      setTheme: (theme) => set({ theme }),
      setView: (view) => set({ view }),
      setDisplay: (display) => set((state) => ({ display: { ...state.display, ...display } })),
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
    }),
    {
      name: PREFERENCES_KEY,
      version: 2,
      // why: version 1 stored a single bridge URL; it becomes the first bridge
      migrate: (persisted, version) => {
        const old = persisted as { url?: string } & Partial<Preferences>;
        if (version < 2 && old.url) return { ...old, bridges: [{ ...LOCAL_BRIDGE, url: old.url }] };
        return old;
      },
    },
  ),
);
