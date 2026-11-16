import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import type { AgentEvent } from "@rancher/shared/events";
import { ADAPTERS } from "../apps/api/src/harness/registry";

const [dist, seed] = process.argv.slice(2);
const PORT = 4300;
const BRIDGE = `http://127.0.0.1:${PORT}`;
const LIVE_SECONDS = 10;
const EVENTS_PER_TICK = 10;

const dataDir = mkdtempSync(join(tmpdir(), "rancher-perf-"));
cpSync(join(seed, "events.db"), join(dataDir, "events.db"));
const adapters = Object.fromEntries(ADAPTERS.map((adapter) => [adapter.id, { enabled: false }]));
writeFileSync(join(dataDir, "settings.json"), JSON.stringify({ adapters, retentionDays: 365 }));

const bridge = Bun.spawn(["bun", "apps/api/src/index.ts"], {
  env: { ...process.env, BRIDGE_PORT: String(PORT), STATIC_DIR: dist, DATA_DIR: dataDir, RETENTION_DAYS: "365" },
  stdout: "ignore",
  stderr: "inherit",
});
for (let i = 0; i < 100; i++) {
  if (
    await fetch(`${BRIDGE}/v1/health`).then(
      (response) => response.ok,
      () => false,
    )
  )
    break;
  await Bun.sleep(100);
}

// why: a stub DevTools hook sees every React commit, so the page counts which components rendered without a profiler build
const probe = () => {
  const renders: Record<string, number> = {};
  const seen = new WeakMap<object, unknown>();
  const frames: number[] = [];
  const longTasks: number[] = [];
  const draws = { count: 0 };
  for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const method of ["drawElements", "drawArrays"] as const) {
      const original = context.prototype[method] as (...args: unknown[]) => void;
      context.prototype[method] = function (this: unknown, ...args: unknown[]) {
        draws.count++;
        return original.apply(this, args);
      } as never;
    }
  }
  const nameOf = (type: {
    displayName?: string;
    name?: string;
    render?: { name?: string };
    type?: { name?: string };
  }) => type.displayName || type.name || type.render?.name || type.type?.name || "anonymous";
  type Fiber = {
    tag: number;
    type: never;
    flags: number;
    child?: Fiber;
    sibling?: Fiber;
    memoizedProps: unknown;
    memoizedState: unknown;
  };
  const walk = (fiber: Fiber | undefined) => {
    for (let node = fiber; node; node = node.sibling) {
      if ([0, 1, 11, 14, 15].includes(node.tag) && node.flags & 1) {
        const key = [node.memoizedProps, node.memoizedState];
        const previous = seen.get(node) as unknown[] | undefined;
        if (!previous || previous[0] !== key[0] || previous[1] !== key[1]) {
          const name = nameOf(node.type);
          renders[name] = (renders[name] ?? 0) + 1;
        }
        seen.set(node, key);
      }
      walk(node.child);
    }
  };
  Object.assign(window, {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: {
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      onCommitFiberRoot: (_id: number, root: { current: Fiber }) => walk(root.current.child),
      onCommitFiberUnmount: () => {},
      onPostCommitFiberRoot: () => {},
      checkDCE: () => {},
    },
    __perf: { renders, frames, longTasks, draws },
  });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration);
  }).observe({ type: "longtask", buffered: true });
  let last = performance.now();
  const tick = (now: number) => {
    frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

type Perf = { renders: Record<string, number>; frames: number[]; longTasks: number[]; draws: { count: number } };
const reset = (page: Page) =>
  page.evaluate(() => {
    const perf = (window as unknown as { __perf: Perf }).__perf;
    for (const key of Object.keys(perf.renders)) delete perf.renders[key];
    perf.frames.length = 0;
    perf.longTasks.length = 0;
    perf.draws.count = 0;
  });
const collect = async (page: Page) => {
  const perf = await page.evaluate(() => (window as unknown as { __perf: Perf }).__perf);
  const sorted = [...perf.frames].sort((a, b) => a - b);
  const top = Object.entries(perf.renders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return {
    "long tasks": perf.longTasks.length,
    "long task ms": Math.round(perf.longTasks.reduce((sum, ms) => sum + ms, 0)),
    frames: sorted.length,
    "p95 frame ms": Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
    "frames > 50ms": sorted.filter((ms) => ms > 50).length,
    "draw calls": perf.draws.count,
    "component renders": Object.values(perf.renders).reduce((sum, count) => sum + count, 0),
    top: top.map(([name, count]) => `${name}:${count}`).join(" "),
  };
};

let tick = 0;
async function live(sessionId: string) {
  const end = Date.now() + LIVE_SECONDS * 1000;
  while (Date.now() < end) {
    const at = new Date().toISOString();
    const events: AgentEvent[] = [];
    for (let i = 0; i < EVENTS_PER_TICK / 2; i++) {
      const toolId = `live-${tick++}`;
      events.push({
        type: "tool.started",
        sessionId,
        agentId: sessionId,
        toolId,
        name: "Read",
        summary: "src/x.ts",
        at,
      });
      events.push({ type: "tool.finished", sessionId, toolId, ok: true, at });
    }
    await fetch(`${BRIDGE}/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(events),
    });
    await Bun.sleep(100);
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  // why: SwiftShader makes every frame cost seconds, which hides frame-level changes; PERF_SWIFTSHADER=1 forces it on GPU-less hosts
  args: process.env.PERF_SWIFTSHADER
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    : ["--ignore-gpu-blocklist", ...(process.platform === "win32" ? ["--use-angle=d3d11"] : [])],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(probe);
const results: Record<string, unknown> = {};
results.renderer = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  return gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
});
const started = performance.now();
await page.goto(BRIDGE);
await page
  .getByText(/^100 sessions$/)
  .waitFor({ timeout: 30_000 })
  .catch(async (error) => {
    await page.screenshot({ path: join(dataDir, "fail.png") });
    console.log(join(dataDir, "fail.png"), await page.locator("body").textContent());
    throw error;
  });
results["history loaded ms"] = Math.round(performance.now() - started);
results.load = await collect(page);
// why: the force layout cools within its 15 s cooldown, after which nothing on the map changes
await Bun.sleep(16_000);
await reset(page);
await Bun.sleep(5000);
results["idle 5 s"] = await collect(page);

await reset(page);
// why: PERF_PROFILE=1 prints the hottest functions of the live phase, built with --minify false for readable names
const cdp = process.env.PERF_PROFILE ? await page.context().newCDPSession(page) : undefined;
await cdp?.send("Profiler.enable");
await cdp?.send("Profiler.start");
await live("session-99");
results["live, no panel"] = await collect(page);
if (cdp) {
  const { profile } = await cdp.send("Profiler.stop");
  const self = new Map<string, number>();
  const interval = (profile.endTime - profile.startTime) / (profile.samples?.length ?? 1) / 1000;
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  for (const id of profile.samples ?? []) {
    const frame = byId.get(id)?.callFrame;
    const key = frame ? `${frame.functionName || "(anon)"} ${frame.url.split("/").pop()}:${frame.lineNumber}` : "?";
    self.set(key, (self.get(key) ?? 0) + interval);
  }
  console.log(
    [...self]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([key, ms]) => `${Math.round(ms)}ms ${key}`)
      .join("\n"),
  );
}

await page
  .getByRole("link", { name: /Task 99/ })
  .first()
  .click();
await page.getByRole("heading", { name: "Task 99" }).waitFor();
await Bun.sleep(1000);
await reset(page);
await live("session-99");
results["live, session panel open"] = await collect(page);
// why: without a collection the heap reading is whatever garbage the last frame left
await (await page.context().newCDPSession(page)).send("HeapProfiler.collectGarbage");
results["heap MB"] = await page.evaluate(() =>
  Math.round((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1e6),
);

console.log(JSON.stringify(results, null, 2));
await browser.close();
bridge.kill();
process.exit(0);
