import { create } from "zustand";

type MapStore = {
  leftOpen: boolean;
  paused: boolean;
  fitTick: number;
  reheatTick: number;
  setLeftOpen: (open: boolean) => void;
  toggleLeft: () => void;
  togglePause: () => void;
  fit: () => void;
  reheat: () => void;
};

export const useMapStore = create<MapStore>()((set) => ({
  leftOpen: true,
  paused: false,
  fitTick: 0,
  reheatTick: 0,
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  toggleLeft: () => set((state) => ({ leftOpen: !state.leftOpen })),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  fit: () => set((state) => ({ fitTick: state.fitTick + 1 })),
  reheat: () => set((state) => ({ paused: false, reheatTick: state.reheatTick + 1 })),
}));
