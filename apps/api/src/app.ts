import { ingestSchema } from "@agent-map/shared/events";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { publish } from "./events/log";
import { stream } from "./http/stream";

type Watcher = () => { dir: string; sessions: number };

export function createApp(claudeCode: Watcher) {
  const pushed = new Set<string>();
  return new Hono()
    .use("/v1/*", cors({ origin: env.WEB_ORIGIN }))
    .get("/v1/harnesses", (c) =>
      c.json([
        { id: "claude-code", name: "Claude Code", source: claudeCode().dir, sessions: claudeCode().sessions },
        { id: "http", name: "Any harness", source: "POST /v1/events", sessions: pushed.size },
      ]),
    )
    .post("/v1/events", zValidator("json", ingestSchema), (c) => {
      const body = c.req.valid("json");
      const events = Array.isArray(body) ? body : [body];
      for (const event of events) pushed.add(event.sessionId);
      publish(events);
      return c.json({ accepted: events.length }, 202);
    })
    .get("/v1/stream", stream);
}

export type AppType = ReturnType<typeof createApp>;
