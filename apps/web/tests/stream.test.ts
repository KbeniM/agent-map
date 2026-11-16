import { describe, expect, test } from "bun:test";
import type { AgentEvent } from "@rancher/shared/events";
import { createMessageDispatcher, follow } from "../src/lib/bridge-stream";
import type { Message } from "../src/lib/sse";
import type { Connection } from "../src/stores/graph";
import type { Bridge } from "../src/stores/preferences";

const bridge: Bridge = { id: "b1", name: "Local", url: "http://127.0.0.1:4100", token: "secret", enabled: true };
const at = "2026-11-16T10:00:00.000Z";

const sseBody = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

describe("follow", () => {
  test("stops with unauthorized on 401", async () => {
    const originalFetch = globalThis.fetch;
    const states: Connection[] = [];
    const controller = new AbortController();
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    try {
      await follow(bridge, controller.signal, {
        onConnection: (state) => states.push(state),
        onMessage: () => {},
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(states).toEqual(["connecting", "unauthorized"]);
  });

  test("streams chunked SSE messages and sends authorization and last-event-id", async () => {
    const originalFetch = globalThis.fetch;
    const originalSetTimeout = globalThis.setTimeout;
    const states: Connection[] = [];
    const messages: Message[] = [];
    const headers: Record<string, string>[] = [];
    const controller = new AbortController();
    let call = 0;

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      headers.push(Object.fromEntries(new Headers(init?.headers).entries()));
      call++;
      if (call === 1) {
        return new Response(sseBody('id: db:1\ndata: {"type":', '"a"}\n\n'), { status: 200 });
      }
      controller.abort();
      return new Response(sseBody("event: reset\ndata: ok\n\n"), { status: 200 });
    }) as unknown as typeof fetch;
    globalThis.setTimeout = ((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    try {
      await follow(bridge, controller.signal, {
        onConnection: (state) => states.push(state),
        onMessage: (message) => messages.push(message),
      });
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(states).toEqual(["connecting", "open", "closed", "open"]);
    expect(messages).toEqual([
      { id: "db:1", event: "message", data: '{"type":"a"}' },
      { event: "reset", data: "ok" },
    ]);
    expect(headers[0].authorization).toBe("Bearer secret");
    expect(headers[0]["last-event-id"]).toBeUndefined();
    expect(headers[1]["last-event-id"]).toBe("db:1");
  });
});

describe("createMessageDispatcher", () => {
  test("drops buffered events for a forgotten session and ignores malformed JSON", () => {
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    let flush: FrameRequestCallback | undefined;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      flush = cb;
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;

    const received: AgentEvent[] = [];
    const forgotten: string[] = [];
    const dispatcher = createMessageDispatcher("b1", {
      receive: (_id, events) => received.push(...events),
      reset: () => {},
      forget: (_id, sessionId) => forgotten.push(sessionId),
    });

    try {
      dispatcher.dispatch({
        event: "message",
        data: JSON.stringify({ type: "session.started", sessionId: "s1", harness: "codex", at }),
      });
      dispatcher.dispatch({
        event: "message",
        data: JSON.stringify({ type: "session.started", sessionId: "s2", harness: "codex", at }),
      });
      dispatcher.dispatch({ event: "message", data: "{not-json" });
      dispatcher.dispatch({ event: "forget", data: "s1" });
      flush?.(0);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    }

    expect(forgotten).toEqual(["s1"]);
    expect(received.map((event) => event.sessionId)).toEqual(["s2"]);
  });
});
