import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app";
import { createStore } from "../src/events/store";
import type { Adapter } from "../src/harness/adapter";
import { createRuntime } from "../src/runtime";

export const at = "2026-11-16T10:00:00.000Z";

export async function bridge(options: { token?: string; adapters?: Adapter[] } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "agent-map-test-"));
  const store = createStore(":memory:");
  const runtime = createRuntime({
    adapters: options.adapters ?? [],
    store,
    dataDir,
    defaults: { retentionDays: 3650, sinceHours: 24 },
  });
  const app = createApp({
    store,
    runtime,
    token: options.token ?? "",
    origins: ["http://localhost:5173"],
    version: "test",
  });
  return { app, store, runtime, dataDir };
}

export const until = async (check: () => boolean) => {
  for (let i = 0; i < 150 && !check(); i++) await Bun.sleep(20);
};
