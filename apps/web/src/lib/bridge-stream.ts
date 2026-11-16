import { type AgentEvent, agentEventSchema } from "@agent-map/shared/events";
import { type Connection, useGraphs } from "@/stores/graph";
import type { Bridge } from "@/stores/preferences";
import { authHeaders } from "./api";
import { backoff, type Message, parseBlocks } from "./sse";

type Handlers = { onMessage: (message: Message) => void; onConnection: (connection: Connection) => void };
type StoreActions = {
  receive: (bridgeId: string, events: AgentEvent[]) => void;
  reset: (bridgeId: string) => void;
  forget: (bridgeId: string, sessionId: string) => void;
  setConnection: (bridgeId: string, connection: Connection) => void;
  drop: (bridgeId: string) => void;
};

async function read(body: NonNullable<Response["body"]>, onMessage: (message: Message) => void) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    const parsed = parseBlocks(buffer + value);
    buffer = parsed.rest;
    for (const message of parsed.messages) onMessage(message);
  }
}

const open = (bridge: Bridge, lastId: string, signal: AbortSignal) =>
  fetch(`${bridge.url}/v1/stream`, {
    headers: { accept: "text/event-stream", ...authHeaders(bridge), ...(lastId ? { "last-event-id": lastId } : {}) },
    signal,
  }).catch(() => undefined);

export async function follow(bridge: Bridge, signal: AbortSignal, { onMessage, onConnection }: Handlers) {
  let lastId = "";
  let attempt = 0;
  const track = (message: Message) => {
    lastId = message.id ?? lastId;
    onMessage(message);
  };
  while (!signal.aborted) {
    onConnection(attempt === 0 ? "connecting" : "closed");
    const response = await open(bridge, lastId, signal);
    if (response?.status === 401) return onConnection("unauthorized");
    if (response?.ok && response.body) {
      onConnection("open");
      attempt = 0;
      await read(response.body, track).catch(() => undefined);
    }
    if (signal.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, backoff(attempt++)));
  }
}

const parseEvent = (raw: string): AgentEvent | undefined => {
  try {
    const parsed = agentEventSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

export function createMessageDispatcher(bridgeId: string, actions: Omit<StoreActions, "setConnection" | "drop">) {
  let queue: AgentEvent[] = [];
  let frame = 0;
  // why: replaying history sends thousands of events at once, so they land in one store update per frame
  const flush = () => {
    frame = 0;
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    actions.receive(bridgeId, batch);
  };

  return {
    dispatch(message: Message) {
      if (message.event === "reset") {
        queue = [];
        actions.reset(bridgeId);
      } else if (message.event === "forget") {
        // why: drop buffered events for the forgotten session so the next frame does not resurrect it
        queue = queue.filter((event) => event.sessionId !== message.data);
        actions.forget(bridgeId, message.data);
      } else if (message.event === "message") {
        const event = parseEvent(message.data);
        if (!event) return;
        queue.push(event);
        frame ||= requestAnimationFrame(flush);
      }
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      queue = [];
    },
  };
}

export function connectBridge(bridge: Bridge, actions: StoreActions = useGraphs.getState()) {
  const controller = new AbortController();
  const dispatcher = createMessageDispatcher(bridge.id, actions);
  void follow(bridge, controller.signal, {
    onConnection: (connection) => actions.setConnection(bridge.id, connection),
    onMessage: dispatcher.dispatch,
  });
  return () => {
    controller.abort();
    dispatcher.stop();
    actions.drop(bridge.id);
  };
}
