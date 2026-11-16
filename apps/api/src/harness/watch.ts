import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { AgentEvent } from "@agent-map/shared/events";
import { type Cursor, parseLine, type SubagentMeta, subagentStarted } from "./claude-code";

type File = { offset: number; cursor: Cursor };

const MAIN = /^[^/]+\/([^/]+)\.jsonl$/;
const SUBAGENT = /^[^/]+\/([^/]+)\/subagents\/agent-([^/]+)\.jsonl$/;

function cursorFor(path: string): Cursor | undefined {
  const sub = SUBAGENT.exec(path);
  if (sub) return { sessionId: sub[1], agentId: sub[2], started: false };
  const main = MAIN.exec(path);
  if (main) return { sessionId: main[1], agentId: main[1], started: false };
}

async function readMeta(path: string): Promise<SubagentMeta> {
  const file = Bun.file(path.replace(/\.jsonl$/, ".meta.json"));
  return (await file.exists()) ? file.json() : {};
}

async function readNew(path: string, file: File, emit: (events: AgentEvent[]) => void) {
  const { size, mtime } = await stat(path);
  if (size <= file.offset) return;
  const bytes = new Uint8Array(await Bun.file(path).slice(file.offset, size).arrayBuffer());
  const end = bytes.lastIndexOf(10) + 1;
  if (end === 0) return;
  // why: a line still being written has no trailing newline yet, so it waits for the next poll
  const text = new TextDecoder().decode(bytes.subarray(0, end));
  const events: AgentEvent[] = [];
  if (file.offset === 0 && file.cursor.agentId !== file.cursor.sessionId) {
    file.cursor.started = true;
    events.push(subagentStarted(file.cursor, await readMeta(path), mtime.toISOString()));
  }
  file.offset += end;
  for (const line of text.split("\n")) if (line) events.push(...parseLine(line, file.cursor));
  if (events.length > 0) emit(events);
}

// shortcut: polls every second instead of fs.watch, switch once polling cost shows up with many projects
export function watchClaudeCode(dir: string, sinceHours: number, emit: (events: AgentEvent[]) => void, everyMs = 1000) {
  const files = new Map<string, File>();
  // why: main transcripts scan first, so a subagent's spawning tool call is known before the subagent
  const globs = [new Bun.Glob("*/*.jsonl"), new Bun.Glob("*/*/subagents/agent-*.jsonl")];
  const cutoff = Date.now() - sinceHours * 3_600_000;
  let stopped = false;

  async function tick() {
    const scans = globs.map((glob) => Array.fromAsync(glob.scan({ cwd: dir, onlyFiles: true })).catch(() => []));
    for (const relative of (await Promise.all(scans)).flat()) {
      const path = join(dir, relative);
      let file = files.get(path);
      if (!file) {
        const cursor = cursorFor(relative.replaceAll("\\", "/"));
        const fresh = cursor && (await stat(path).catch(() => undefined))?.mtimeMs;
        if (!cursor || !fresh || fresh < cutoff) continue;
        file = { offset: 0, cursor };
        files.set(path, file);
      }
      await readNew(path, file, emit).catch(() => undefined);
    }
  }

  const loop = async () => {
    while (!stopped) {
      await tick();
      await Bun.sleep(everyMs);
    }
  };
  loop();
  return {
    status: () => ({ dir, sessions: new Set([...files.values()].map((file) => file.cursor.sessionId)).size }),
    stop: () => {
      stopped = true;
    },
  };
}
