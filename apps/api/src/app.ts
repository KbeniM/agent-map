import { zValidator } from "@hono/zod-validator";
import { bridgeSettingsPatchSchema } from "@rancher/shared/config";
import { ingestSchema } from "@rancher/shared/events";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Store } from "./events/store";
import { InvalidPayload } from "./harness/adapter";
import { stream } from "./http/stream";
import type { Runtime } from "./runtime";

type Options = { store: Store; runtime: Runtime; token: string; origins: string[]; version: string };

const MAX_BODY = 5 * 1024 * 1024;
const idParam = z.object({ id: z.string().min(1).max(200) });
const adapterParam = z.object({ adapter: z.string().regex(/^[a-z0-9-]{1,60}$/) });
const hookQuery = z.object({
  event: z
    .string()
    .regex(/^[A-Za-z_]{1,60}$/)
    .optional(),
});
const tooLarge = bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: "Body too large" }, 413) });

export function createApp({ store, runtime, token, origins, version }: Options) {
  const app = new Hono()
    .use("/v1/*", cors({ origin: origins, allowHeaders: ["authorization", "content-type", "last-event-id"] }))
    .get("/v1/health", (c) => c.json({ ok: true, version }))
    .use("/v1/*", async (c, next) => (token ? bearerAuth({ token })(c, next) : next()))
    .get("/v1/adapters", (c) => c.json(runtime.info()))
    .get("/v1/settings", (c) => c.json(runtime.settings()))
    .patch("/v1/settings", tooLarge, zValidator("json", bridgeSettingsPatchSchema), async (c) =>
      c.json(await runtime.update(c.req.valid("json"))),
    )
    .post("/v1/events", tooLarge, zValidator("json", ingestSchema), (c) => {
      const body = c.req.valid("json");
      const events = Array.isArray(body) ? body : [body];
      return c.json({ accepted: store.publish(events) }, 202);
    })
    .post(
      "/v1/hooks/:adapter",
      tooLarge,
      zValidator("param", adapterParam),
      zValidator("query", hookQuery),
      async (c) => {
        const payload = await c.req.json().catch(() => {
          throw new HTTPException(400, { message: "Malformed JSON" });
        });
        if (typeof payload !== "object" || payload === null)
          throw new HTTPException(400, { message: "Expected an object" });
        // why: some harnesses (Copilot CLI) only name the event in the hook config, so it travels as ?event=
        const event = c.req.valid("query").event;
        const accepted = runtime.hook(c.req.valid("param").adapter, event ? { ...payload, hookEvent: event } : payload);
        if (accepted === undefined) return c.json({ error: "Unknown or disabled adapter" }, 404);
        return c.json({ accepted }, 202);
      },
    )
    .delete("/v1/sessions/:id", zValidator("param", idParam), (c) =>
      c.json({ removed: store.forget(c.req.valid("param").id) }),
    )
    .get("/v1/stream", stream(store));

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    if (error instanceof InvalidPayload) return c.json({ error: error.message }, 400);
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });
  return app;
}

export type AppType = ReturnType<typeof createApp>;
