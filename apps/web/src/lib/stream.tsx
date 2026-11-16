import { type AgentEvent, agentEventSchema } from "@agent-map/shared/events";
import { useEffect } from "react";
import { type Connection, useGraphs } from "@/stores/graph";
import { type Bridge, usePreferences } from "@/stores/preferences";
import { authHeaders } from "./api";
import { backoff, type Message, parseBlocks } from "./sse";

type Handlers = { onMessage: (message: Message) => void; onConnection: (connection: Connection) => void };

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

function useBridge(bridge: Bridge) {
  useEffect(() => {
    const { receive, reset, forget, setConnection, drop } = useGraphs.getState();
    const controller = new AbortController();
    let queue: AgentEvent[] = [];
    let frame = 0;
    // why: replaying history sends thousands of events at once, so they land in one store update per frame
    const flush = () => {
      frame = 0;
      receive(bridge.id, queue);
      queue = [];
    };
    void follow(bridge, controller.signal, {
      onConnection: (connection) => setConnection(bridge.id, connection),
      onMessage: (message) => {
        if (message.event === "reset") {
          queue = [];
          reset(bridge.id);
        } else if (message.event === "forget") forget(bridge.id, message.data);
        else if (message.event === "message") {
          const parsed = agentEventSchema.safeParse(JSON.parse(message.data));
          if (!parsed.success) return;
          queue.push(parsed.data);
          frame ||= requestAnimationFrame(flush);
        }
      },
    });
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      drop(bridge.id);
    };
  }, [bridge]);
}

function BridgeStream({ bridge }: { bridge: Bridge }) {
  useBridge(bridge);
  return null;
}

export function BridgeStreams() {
  const bridges = usePreferences((state) => state.bridges);
  return bridges.filter((bridge) => bridge.enabled).map((bridge) => <BridgeStream key={bridge.id} bridge={bridge} />);
}
