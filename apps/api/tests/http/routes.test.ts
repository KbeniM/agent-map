import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";

const app = createApp(() => ({ dir: "/tmp/projects", sessions: 2 }));
const at = "2026-11-16T10:00:00.000Z";
const post = (body: string) =>
  app.request("/v1/events", { method: "POST", body, headers: { "content-type": "application/json" } });

const valid = { type: "tool.started", sessionId: "s", agentId: "s", toolId: "t", name: "search", at };

// why: every input-taking route needs a row here, the completeness test below enforces it
const MALFORMED: Record<string, [string, string][]> = {
  "POST /v1/events": [
    ["broken JSON", "{"],
    ["unknown event type", JSON.stringify({ ...valid, type: "tool.paused" })],
    ["missing field", JSON.stringify({ ...valid, toolId: undefined })],
    ["empty batch", "[]"],
  ],
};

describe("routes", () => {
  test("every input-taking route has malformed cases", () => {
    const inputRoutes = app.routes
      .filter((route) => route.method === "POST")
      .map((route) => `${route.method} ${route.path}`);
    expect(Object.keys(MALFORMED).sort()).toEqual([...new Set(inputRoutes)].sort());
  });

  for (const [route, cases] of Object.entries(MALFORMED)) {
    for (const [name, body] of cases) {
      test(`${route} rejects ${name} with 400`, async () => {
        expect((await post(body)).status).toBe(400);
      });
    }
  }

  test("POST /v1/events accepts one event or a batch", async () => {
    expect(await (await post(JSON.stringify(valid))).json()).toEqual({ accepted: 1 });
    const batch = await post(JSON.stringify([valid, { ...valid, toolId: "t2" }]));
    expect(batch.status).toBe(202);
    expect(await batch.json()).toEqual({ accepted: 2 });
  });

  test("GET /v1/harnesses lists the watcher and pushed sessions", async () => {
    await post(JSON.stringify({ ...valid, sessionId: "pushed" }));
    const harnesses = (await (await app.request("/v1/harnesses")).json()) as {
      id: string;
      name: string;
      source: string;
      sessions: number;
    }[];
    expect(harnesses[0]).toEqual({ id: "claude-code", name: "Claude Code", source: "/tmp/projects", sessions: 2 });
    expect(harnesses[1].sessions).toBeGreaterThanOrEqual(1);
  });

  test("CORS only allows the web origin", async () => {
    const allowed = await app.request("/v1/harnesses", { headers: { origin: "http://localhost:5173" } });
    const other = await app.request("/v1/harnesses", { headers: { origin: "https://evil.example" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });
});
