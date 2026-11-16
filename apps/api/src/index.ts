import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/bun";
// @ts-expect-error a file embedded with { type: "file" } has no TypeScript type; Bun resolves it to a path string
import forwarder from "../bin/agent-map-hook" with { type: "file" };
// @ts-expect-error a file embedded with { type: "file" } has no TypeScript type; Bun resolves it to a path string
import plugin from "../bin/opencode-plugin.js" with { type: "file" };
import pkg from "../package.json";
import { createApp } from "./app";
import { env } from "./env";
import { createStore } from "./events/store";
import { ADAPTERS } from "./harness/registry";
import { createRuntime } from "./runtime";

// why: anything beyond loopback carries tool activity off the machine, so it must be authenticated
if (!env.loopback && !env.AGENT_MAP_TOKEN) {
  console.error(`Refusing to listen on ${env.HOST} without AGENT_MAP_TOKEN.`);
  process.exit(1);
}

mkdirSync(env.DATA_DIR, { recursive: true });
const store = createStore(join(env.DATA_DIR, "events.db"));
const runtime = createRuntime({
  adapters: ADAPTERS,
  store,
  dataDir: env.DATA_DIR,
  defaults: { retentionDays: env.RETENTION_DAYS, sinceHours: env.SINCE_HOURS },
});
const stop = await runtime.start();
const app = createApp({ store, runtime, token: env.AGENT_MAP_TOKEN, origins: env.origins, version: pkg.version });

// why: the files are embedded so the compiled desktop sidecar serves them without a repo checkout beside it
app.get("/hook.sh", () => new Response(Bun.file(forwarder), { headers: { "content-type": "text/x-shellscript" } }));
app.get(
  "/opencode-plugin.js",
  () => new Response(Bun.file(plugin), { headers: { "content-type": "text/javascript" } }),
);
if (env.STATIC_DIR) {
  const page = serveStatic({ path: join(env.STATIC_DIR, "index.html") });
  app.use("/*", serveStatic({ root: env.STATIC_DIR }));
  // why: unknown /v1 paths must stay 404 instead of falling through to the app shell
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/v1/")) return c.notFound();
    return (await page(c, next)) ?? c.notFound();
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stop();
    store.close();
    process.exit(0);
  });
}

console.log(`agent-map bridge on http://${env.HOST}:${env.BRIDGE_PORT}`);

export default { port: env.BRIDGE_PORT, hostname: env.HOST, fetch: app.fetch };
