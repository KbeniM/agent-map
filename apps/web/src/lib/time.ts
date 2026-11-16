import { useSyncExternalStore } from "react";

type Clock = { now: number; read: () => number; subscribe: (listener: () => void) => () => void };
const clocks = new Map<number, Clock>();

function clockOf(everyMs: number) {
  const existing = clocks.get(everyMs);
  if (existing) return existing;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  const clock: Clock = {
    now: Date.now(),
    read: () => clock.now,
    subscribe: (listener) => {
      if (listeners.size === 0) {
        clock.now = Date.now();
        timer = setInterval(() => {
          clock.now = Date.now();
          for (const notify of listeners) notify();
        }, everyMs);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) clearInterval(timer);
      };
    },
  };
  clocks.set(everyMs, clock);
  return clock;
}

// why: one timer per interval, so every reader of the same rate gets the same now and renders in the same commit
export function useNow(everyMs: number) {
  const clock = clockOf(everyMs);
  return useSyncExternalStore(clock.subscribe, clock.read);
}

export function ago(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

export function duration(from: string, to: string | undefined, now: number) {
  const ms = (to ? Date.parse(to) : now) - Date.parse(from);
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
