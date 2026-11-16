import { describe, expect, test } from "bun:test";
import { claudeCode } from "../../src/harness/claude-code";
import { at, bridge } from "../helpers";

const valid = { type: "tool.started", sessionId: "s", agentId: "s", toolId: "t", name: "search", at };
const json = (method: string, body: string, headers: Record<string, string> = {}) => ({
  method,
  body,
  headers: { "content-type": "application/json", ...headers },
});

// why: every input-taking route needs a row here, the completeness test below enforces it
const MALFORMED: Record<string, [string, string, string][]> = {
  "POST /v1/events": [
    ["broken JSON", "/v1/events", "{"],
    ["unknown event type", "/v1/events", JSON.stringify({ ...valid, type: "tool.paused" })],
    ["missing field", "/v1/events", JSON.stringify({ ...valid, toolId: undefined })],
    ["empty batch", "/v1/events", "[]"],
  ],
  "POST /v1/hooks/:adapter": [
    ["broken JSON", "/v1/hooks/claude-code", "{"],
    ["a non-object body", "/v1/hooks/claude-code", "[1]"],
    ["a payload without session_id", "/v1/hooks/claude-code", JSON.stringify({ hook_event_name: "Stop" })],
    ["a malformed adapter name", "/v1/hooks/Not_An_Adapter!", "{}"],
  ],
  "PATCH /v1/settings": [
    ["broken JSON", "/v1/settings", "{"],
    ["an empty patch", "/v1/settings", "{}"],
    ["a retention out of range", "/v1/settings", JSON.stringify({ retentionDays: 0 })],
  ],
};

describe("routes", async () => {
  const { app } = await bridge({ adapters: [claudeCode] });

  test("every input-taking route has malformed cases", () => {
    const inputRoutes = app.routes
      .filter((route) => ["POST", "PATCH"].includes(route.method))
      .map((route) => `${route.method} ${route.path}`);
    expect(Object.keys(MALFORMED).sort()).toEqual([...new Set(inputRoutes)].sort());
  });

  for (const [route, cases] of Object.entries(MALFORMED)) {
    for (const [name, path, body] of cases) {
      test(`${route} rejects ${name} with 400`, async () => {
        const method = route.split(" ")[0];
        expect((await app.request(path, json(method, body))).status).toBe(400);
      });
    }
  }

  test("POST /v1/events accepts one event or a batch, and drops repeats", async () => {
    expect(await (await app.request("/v1/events", json("POST", JSON.stringify(valid)))).json()).toEqual({
      accepted: 1,
    });
    const batch = await app.request("/v1/events", json("POST", JSON.stringify([valid, { ...valid, toolId: "t2" }])));
    expect(batch.status).toBe(202);
    expect(await batch.json()).toEqual({ accepted: 1 });
  });

  test("POST /v1/hooks/:adapter maps a hook payload to events", async () => {
    const body = JSON.stringify({
      session_id: "h1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_use_id: "x",
    });
    const response = await app.request("/v1/hooks/claude-code", json("POST", body));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: 1 });
  });

  test("POST /v1/hooks/:adapter is 404 for an adapter without hooks", async () => {
    expect((await app.request("/v1/hooks/nope", json("POST", "{}"))).status).toBe(404);
  });

  test("PATCH /v1/settings saves and returns the merged settings", async () => {
    const response = await app.request("/v1/settings", json("PATCH", JSON.stringify({ retentionDays: 30 })));
    const saved = (await response.json()) as { retentionDays: number };
    const read = (await (await app.request("/v1/settings")).json()) as { retentionDays: number };
    expect([saved.retentionDays, read.retentionDays]).toEqual([30, 30]);
  });

  test("GET /v1/adapters lists each adapter with its modes", async () => {
    const adapters = (await (await app.request("/v1/adapters")).json()) as { id: string; modes: string[] }[];
    expect(adapters).toEqual([expect.objectContaining({ id: "claude-code", modes: ["files", "hooks"] })]);
  });

  test("DELETE /v1/sessions/:id forgets the session", async () => {
    expect(await (await app.request("/v1/sessions/s", { method: "DELETE" })).json()).toEqual({ removed: 2 });
  });

  test("CORS only allows the web origin", async () => {
    const allowed = await app.request("/v1/adapters", { headers: { origin: "http://localhost:5173" } });
    const other = await app.request("/v1/adapters", { headers: { origin: "https://evil.example" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("auth", async () => {
  const { app } = await bridge({ token: "secret-token" });
  const routes = [
    ["GET", "/v1/adapters", "/v1/adapters"],
    ["GET", "/v1/settings", "/v1/settings"],
    ["GET", "/v1/stream", "/v1/stream"],
    ["POST", "/v1/events", "/v1/events"],
    ["POST", "/v1/hooks/claude-code", "/v1/hooks/:adapter"],
    ["PATCH", "/v1/settings", "/v1/settings"],
    ["DELETE", "/v1/sessions/s", "/v1/sessions/:id"],
  ];

  for (const [method, path] of routes) {
    test(`${method} ${path} is 401 without the token`, async () => {
      expect((await app.request(path, { method })).status).toBe(401);
    });
    test(`${method} ${path} is 401 with a wrong token`, async () => {
      expect((await app.request(path, { method, headers: { authorization: "Bearer nope" } })).status).toBe(401);
    });
  }

  test("every /v1 route except health is in the auth table", () => {
    const listed = new Set(routes.map(([method, , pattern]) => `${method} ${pattern}`));
    const actual = app.routes
      .filter((route) => route.method !== "ALL" && route.path !== "/v1/health")
      .map((route) => `${route.method} ${route.path}`);
    expect([...new Set(actual)].sort()).toEqual([...listed].sort());
  });

  test("health needs no token", async () => {
    expect((await app.request("/v1/health")).status).toBe(200);
  });

  test("the right token passes", async () => {
    expect((await app.request("/v1/adapters", { headers: { authorization: "Bearer secret-token" } })).status).toBe(200);
  });
});
