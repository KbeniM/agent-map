import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_BRIDGE_URL } from "@/lib/env";

type Bridge = { url: string; setUrl: (url: string) => void };

export const useBridge = create<Bridge>()(
  persist((set) => ({ url: DEFAULT_BRIDGE_URL, setUrl: (url) => set({ url }) }), { name: "agent-map-bridge" }),
);
