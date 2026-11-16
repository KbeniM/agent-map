import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { AgentEvent } from "@agent-map/shared/events";
import type { Emit, FileSource } from "./adapter";

type Tracked = { state: unknown; offset: number; mtime: number };

export type FileWatcher = {
  status: () => { sessions: number; lastEventAt?: string; error?: string };
  stop: () => void;
};

// shortcut: polls every second instead of fs.watch, switch once polling cost shows up with many projects
export function watchFiles(
  source: FileSource<unknown>,
  root: string,
  sinceHours: number,
  emit: Emit,
  everyMs = 1000,
): FileWatcher {
  const files = new Map<string, Tracked>();
  const sessions = new Set<string>();
  const globs = source.globs.map((pattern) => new Bun.Glob(pattern));
  const cutoff = Date.now() - sinceHours * 3_600_000;
  let lastEventAt: string | undefined;
  let error: string | undefined;
  let stopped = false;

  const send = (events: AgentEvent[]) => {
    if (events.length === 0) return;
    for (const event of events) sessions.add(event.sessionId);
    lastEventAt = events[events.length - 1].at;
    emit(events);
  };

  async function read(relative: string) {
    const path = join(root, relative);
    const info = await stat(path);
    let file = files.get(path);
    if (!file) {
      if (info.mtimeMs < cutoff) return;
      const opened = await source.open(relative.replaceAll("\\", "/"), path, info.mtime);
      if (!opened) return;
      file = { state: opened.state, offset: 0, mtime: 0 };
      files.set(path, file);
      send(opened.events ?? []);
    }
    if (source.mode === "snapshot") {
      if (info.mtimeMs === file.mtime) return;
      file.mtime = info.mtimeMs;
      send(source.parse(await Bun.file(path).text(), file.state));
      return;
    }
    if (info.size <= file.offset) return;
    const bytes = new Uint8Array(await Bun.file(path).slice(file.offset, info.size).arrayBuffer());
    const end = bytes.lastIndexOf(10) + 1;
    // why: a line still being written has no trailing newline yet, so it waits for the next poll
    if (end === 0) return;
    file.offset += end;
    send(source.parse(new TextDecoder().decode(bytes.subarray(0, end)), file.state));
  }

  async function tick() {
    const scans = globs.map((glob) => Array.fromAsync(glob.scan({ cwd: root, onlyFiles: true })).catch(() => []));
    error = undefined;
    for (const relative of (await Promise.all(scans)).flat()) {
      await read(relative).catch((cause: Error) => {
        error = `${relative}: ${cause.message}`;
      });
    }
  }

  (async () => {
    while (!stopped) {
      await tick();
      await Bun.sleep(everyMs);
    }
  })();

  return {
    status: () => ({ sessions: sessions.size, lastEventAt, error }),
    stop: () => {
      stopped = true;
    },
  };
}
