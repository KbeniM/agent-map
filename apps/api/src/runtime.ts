import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type AdapterInfo, type BridgeSettings, bridgeSettingsSchema } from "@agent-map/shared/config";
import type { AgentEvent } from "@agent-map/shared/events";
import { pathFromEnv } from "./env";
import type { Store } from "./events/store";
import type { Adapter } from "./harness/adapter";
import { type FileWatcher, watchFiles } from "./harness/files";

type Options = { adapters: Adapter[]; store: Store; dataDir: string; defaults: Omit<BridgeSettings, "adapters"> };
type HookStats = { sessions: Set<string>; lastEventAt?: string };

const pathOf = (adapter: Adapter, settings: BridgeSettings) =>
  settings.adapters[adapter.id]?.path || pathFromEnv(adapter.id) || adapter.files?.defaultPath;

export function createRuntime({ adapters, store, dataDir, defaults }: Options) {
  mkdirSync(dataDir, { recursive: true });
  const file = Bun.file(join(dataDir, "settings.json"));
  const watchers = new Map<string, FileWatcher>();
  const hooks = new Map<string, HookStats>();
  let settings: BridgeSettings = {
    ...defaults,
    adapters: Object.fromEntries(adapters.map((adapter) => [adapter.id, { enabled: true }])),
  };

  async function load() {
    if (!(await file.exists())) return;
    const parsed = bridgeSettingsSchema.partial().safeParse(await file.json().catch(() => ({})));
    if (parsed.success)
      settings = { ...settings, ...parsed.data, adapters: { ...settings.adapters, ...parsed.data.adapters } };
  }

  function restart() {
    for (const watcher of watchers.values()) watcher.stop();
    watchers.clear();
    for (const adapter of adapters) {
      const path = pathOf(adapter, settings);
      if (!adapter.files || !path || !settings.adapters[adapter.id]?.enabled) continue;
      watchers.set(adapter.id, watchFiles(adapter.files, path, settings.sinceHours, store.publish));
    }
  }

  const hookStats = (id: string) => {
    const stats = hooks.get(id) ?? { sessions: new Set() };
    hooks.set(id, stats);
    return stats;
  };

  return {
    async start() {
      await load();
      store.prune(settings.retentionDays);
      restart();
      // shortcut: prunes hourly in-process, move to a scheduled job once the bridge runs as several replicas
      const timer = setInterval(() => store.prune(settings.retentionDays), 3_600_000);
      return () => {
        clearInterval(timer);
        for (const watcher of watchers.values()) watcher.stop();
      };
    },
    settings: () => settings,
    async update(patch: Partial<BridgeSettings>) {
      settings = { ...settings, ...patch, adapters: { ...settings.adapters, ...patch.adapters } };
      await Bun.write(file, JSON.stringify(settings, null, 2));
      store.prune(settings.retentionDays);
      restart();
      return settings;
    },
    hook(id: string, payload: unknown): AgentEvent[] | undefined {
      const adapter = adapters.find((candidate) => candidate.id === id && candidate.hook);
      if (!adapter?.hook || settings.adapters[id]?.enabled === false) return undefined;
      const events = adapter.hook(payload);
      const stats = hookStats(id);
      for (const event of events) stats.sessions.add(event.sessionId);
      stats.lastEventAt = events.at(-1)?.at ?? stats.lastEventAt;
      return events;
    },
    info(): AdapterInfo[] {
      return adapters.map((adapter) => {
        const files = watchers.get(adapter.id)?.status();
        const hook = hooks.get(adapter.id);
        return {
          id: adapter.id,
          name: adapter.name,
          harness: adapter.harness,
          modes: [...(adapter.files ? (["files"] as const) : []), ...(adapter.hook ? (["hooks"] as const) : [])],
          enabled: settings.adapters[adapter.id]?.enabled ?? true,
          path: adapter.files ? pathOf(adapter, settings) : undefined,
          defaultPath: adapter.files?.defaultPath,
          sessions: (files?.sessions ?? 0) + (hook?.sessions.size ?? 0),
          lastEventAt: [files?.lastEventAt, hook?.lastEventAt].filter(Boolean).sort().at(-1),
          error: files?.error,
          hookPath: adapter.hook ? `/v1/hooks/${adapter.id}` : undefined,
        };
      });
    },
  };
}

export type Runtime = ReturnType<typeof createRuntime>;
