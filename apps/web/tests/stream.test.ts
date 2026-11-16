import { describe, expect, test } from "bun:test";
import type { Message } from "../src/lib/sse";
import { follow } from "../src/lib/stream";
import type { Connection } from "../src/stores/graph";
import type { Bridge } from "../src/stores/preferences";

const bridge: Bridge = { id: "b1", name: "Local", url: "http://127.0.0.1:4100", token: "secret", enabled: true };

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
