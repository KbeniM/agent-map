import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_BRIDGE_URL } from "@/lib/env";

export type Theme = "system" | "light" | "dark";
export type View = "3d" | "2d";
export type ColourBy = "session" | "provider" | "harness";
export type ToolDisplay = "detailed" | "simple" | "off";
export type LabelVisibility = "all" | "focus" | "off";
export type GraphSpacing = "compact" | "balanced" | "spread";
export type SessionSort = "recent" | "tools" | "errors";
export type PanelSide = "left" | "right";
type PanelWidths = Partial<Record<PanelSide, number>>;

export const MIN_PANEL_WIDTH = 240;
export const MAX_PANEL_WIDTH = 640;

export const clampPanelWidth = (width: number, viewportWidth = 1280) =>
  Math.round(
    Math.min(
      Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.floor(viewportWidth * 0.6))),
      Math.max(MIN_PANEL_WIDTH, width),
    ),
  );

export type Bridge = { id: string; name: string; url: string; token: string; enabled: boolean };
export type Display = {
  colourBy: ColourBy;
  toolsPerAgent: number;
  toolDisplay: ToolDisplay;
  particles: boolean;
  particleSpeed: number;
  panSpeed: number;
  curvedLinks: boolean;
  arrows: boolean;
  halos: boolean;
  labels: LabelVisibility;
  spacing: GraphSpacing;
  liveSeconds: number;
};
export type Filters = { query: string; harness: string; liveOnly: boolean; errorsOnly: boolean; sort: SessionSort };

type Preferences = {
  bridges: Bridge[];
  theme: Theme;
  view: View;
  display: Display;
  filters: Filters;
  panelWidths: PanelWidths;
  saveBridge: (bridge: Bridge) => void;
  removeBridge: (id: string) => void;
  setTheme: (theme: Theme) => void;
  setView: (view: View) => void;
  setDisplay: (display: Partial<Display>) => void;
  resetDisplay: () => void;
  setFilters: (filters: Partial<Filters>) => void;
  setPanelWidth: (side: PanelSide, width: number) => void;
};

const LOCAL_BRIDGE: Bridge = {
  id: "local",
  name: "This machine",
  url: DEFAULT_BRIDGE_URL,
  token: "",
  enabled: true,
};
export const DEFAULT_DISPLAY: Display = {
  colourBy: "session",
  toolsPerAgent: 8,
  toolDisplay: "detailed",
  particles: true,
  particleSpeed: 0.004,
  panSpeed: 1,
  curvedLinks: true,
  arrows: true,
  halos: true,
  labels: "all",
  spacing: "balanced",
  liveSeconds: 30,
};
export const DEFAULT_FILTERS: Filters = {
  query: "",
  harness: "all",
  liveOnly: false,
  errorsOnly: false,
  sort: "recent",
};

// why: index.html reads this key before first paint to avoid a theme flash, keep both in sync
const PREFERENCES_KEY = "rancher-preferences";

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      bridges: [LOCAL_BRIDGE],
      theme: "system",
      view: "3d",
      display: DEFAULT_DISPLAY,
      filters: DEFAULT_FILTERS,
      panelWidths: {},
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
      resetDisplay: () => set({ display: DEFAULT_DISPLAY }),
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
      setPanelWidth: (side, width) => set((state) => ({ panelWidths: { ...state.panelWidths, [side]: width } })),
    }),
    {
      name: PREFERENCES_KEY,
      version: 3,
      // why: version 1 stored a single bridge URL; merging defaults backfills newly added display and filter fields
      migrate: (persisted, version) => {
        const old = persisted as { url?: string } & Partial<Preferences>;
        const base = version < 2 && old.url ? { ...old, bridges: [{ ...LOCAL_BRIDGE, url: old.url }] } : old;
        return {
          ...base,
          display: { ...DEFAULT_DISPLAY, ...base.display },
          filters: { ...DEFAULT_FILTERS, ...base.filters },
        };
      },
      merge: (persisted, current) => {
        const stored = persisted as Partial<Preferences> | undefined;
        return {
          ...current,
          ...stored,
          display: { ...DEFAULT_DISPLAY, ...stored?.display },
          filters: { ...DEFAULT_FILTERS, ...stored?.filters },
        };
      },
    },
  ),
);
