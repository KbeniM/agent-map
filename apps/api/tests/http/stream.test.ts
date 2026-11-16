import { describe, expect, test } from "bun:test";
import type { AgentEvent } from "@agent-map/shared/events";
import { at, bridge } from "../helpers";

const event = (toolId: string): AgentEvent => ({
  type: "tool.started",
  sessionId: "stream",
  agentId: "stream",
  toolId,
  name: "x",
  at,
});

async function read(app: Awaited<ReturnType<typeof bridge>>["app"], headers: Record<string, string>, wanted: number) {
  const controller = new AbortController();
  const response = await app.request("/v1/stream", { headers, signal: controller.signal });
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  let text = "";
  while ((text.match(/\n\n/g) ?? []).length < wanted) text += new TextDecoder().decode((await reader.read()).value);
  controller.abort();
  return text;
}

describe("GET /v1/stream", () => {
  test("starts with a reset and replays history, then sends new events", async () => {
    const { app, store } = await bridge();
    store.publish([event("first")]);
    const pending = read(app, {}, 3);
    await Bun.sleep(20);
    store.publish([event("second")]);
    const text = await pending;
    expect(text.startsWith(`event: reset\ndata: ${store.id}`)).toBe(true);
    expect(text.indexOf('"toolId":"first"')).toBeLessThan(text.indexOf('"toolId":"second"'));
  });

  test("resumes after Last-Event-ID from the same store without a reset", async () => {
    const { app, store } = await bridge();
    store.publish([event("a"), event("b")]);
    const text = await read(app, { "Last-Event-ID": `${store.id}:1` }, 1);
    expect(text).not.toContain("event: reset");
    expect(text).toContain('"toolId":"b"');
    expect(text).not.toContain('"toolId":"a"');
  });

  test("starts over when Last-Event-ID comes from another store", async () => {
    const { app } = await bridge();
    expect(await read(app, { "Last-Event-ID": "stale:5" }, 1)).toStartWith("event: reset");
  });

  test("tells clients to forget a deleted session", async () => {
    const { app, store } = await bridge();
    store.publish([event("a")]);
    const pending = read(app, {}, 3);
    await Bun.sleep(20);
    store.forget("stream");
    expect(await pending).toContain("event: forget\ndata: stream");
  });
});
