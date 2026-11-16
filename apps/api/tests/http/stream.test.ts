import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { bootId, publish } from "../../src/events/log";

const app = createApp(() => ({ dir: "", sessions: 0 }));
const event = (toolId: string) =>
  ({
    type: "tool.started",
    sessionId: "stream",
    agentId: "stream",
    toolId,
    name: "x",
    at: "2026-11-16T10:00:00.000Z",
  }) as const;

async function read(headers: Record<string, string>, wanted: number) {
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
    publish([event("first")]);
    const pending = read({}, 3);
    await Bun.sleep(20);
    publish([event("second")]);
    const text = await pending;
    expect(text.startsWith(`event: reset\ndata: ${bootId}`)).toBe(true);
    expect(text).toContain('"toolId":"first"');
    expect(text).toContain('"toolId":"second"');
  });

  test("resumes after Last-Event-ID from the same boot without a reset", async () => {
    publish([event("a"), event("b")]);
    const all = await read({}, 2);
    const ids = [...all.matchAll(/^id: (.+)$/gm)].map((match) => match[1]);
    const text = await read({ "Last-Event-ID": ids[0] }, 1);
    expect(text).not.toContain("event: reset");
  });

  test("starts over when Last-Event-ID comes from another boot", async () => {
    expect(await read({ "Last-Event-ID": "stale:5" }, 1)).toStartWith("event: reset");
  });
});
