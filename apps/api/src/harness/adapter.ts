import type { AgentEvent } from "@agent-map/shared/events";

export class InvalidPayload extends Error {}

export type Emit = (events: AgentEvent[]) => void;

export type Opened<State> = { state: State; events?: AgentEvent[] };

export type FileSource<State> = {
  defaultPath: string;
  globs: string[];
  // why: append files are read from the last offset; snapshot files are rewritten in place and re-read whole
  mode: "append" | "snapshot";
  // why: method syntax keeps each adapter's own state type assignable to the shared registry type
  open(relative: string, absolute: string, mtime: Date): Promise<Opened<State> | undefined> | Opened<State> | undefined;
  parse(text: string, state: State): AgentEvent[];
};

export type Adapter = {
  id: string;
  name: string;
  harness: string;
  files?: FileSource<unknown>;
  hook?: (payload: unknown) => AgentEvent[];
};
