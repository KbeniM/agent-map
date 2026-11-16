import type { AgentEvent } from "@agent-map/shared/events";

export type Entry = { seq: number; event: AgentEvent };
type Listener = (entry: Entry) => void;

// why: a bridge restart resets seq, so a client holding an old Last-Event-ID must know to start over
export const bootId = crypto.randomUUID().slice(0, 8);

const MAX = 100_000;
const entries: Entry[] = [];
const listeners = new Set<Listener>();
let seq = 0;

// shortcut: in-memory log capped at MAX events, persist to disk once restarts must keep pushed events
export function publish(events: AgentEvent[]) {
  for (const event of events) {
    const entry = { seq: ++seq, event };
    entries.push(entry);
    if (entries.length > MAX) entries.shift();
    for (const listener of listeners) listener(entry);
  }
}

export const since = (after: number) => entries.filter((entry) => entry.seq > after);

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
