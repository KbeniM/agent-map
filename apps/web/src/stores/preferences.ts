import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_BRIDGE_URL } from "@/lib/env";

export type Theme = "system" | "light" | "dark";
export type View = "3d" | "2d";

type Preferences = {
  url: string;
  theme: Theme;
  view: View;
  setUrl: (url: string) => void;
  setTheme: (theme: Theme) => void;
  setView: (view: View) => void;
};

// why: index.html reads this key before first paint to avoid a theme flash, keep both in sync
const PREFERENCES_KEY = "agent-map-preferences";

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      url: DEFAULT_BRIDGE_URL,
      theme: "system",
      view: "3d",
      setUrl: (url) => set({ url }),
      setTheme: (theme) => set({ theme }),
      setView: (view) => set({ view }),
    }),
    { name: PREFERENCES_KEY },
  ),
);
