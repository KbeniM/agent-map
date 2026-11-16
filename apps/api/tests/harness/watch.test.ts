import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@agent-map/shared/events";
import { watchClaudeCode } from "../../src/harness/watch";

const at = "2026-11-16T10:00:00.000Z";
const jsonl = (...lines: object[]) =>
  `${lines.map((value) => JSON.stringify({ timestamp: at, ...value })).join("\n")}\n`;

const dir = await mkdtemp(join(tmpdir(), "agent-map-watch-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

async function collect(run: (events: AgentEvent[]) => Promise<void>) {
  const events: AgentEvent[] = [];
  const watcher = watchClaudeCode(dir, 24, (batch) => events.push(...batch), 20);
  await run(events);
  watcher.stop();
  return { events, watcher };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await Bun.sleep(20);
};

describe("watchClaudeCode", () => {
  test("reads a session, its subagent and lines appended later", async () => {
    const project = join(dir, "-repo");
    await mkdir(join(project, "s1", "subagents"), { recursive: true });
    await writeFile(
      join(project, "s1.jsonl"),
      jsonl(
        { type: "user", message: { content: "Map the repo" } },
        { type: "assistant", message: { content: [{ type: "tool_use", id: "spawn", name: "Agent", input: {} }] } },
      ),
    );
    await writeFile(
      join(project, "s1", "subagents", "agent-a1.meta.json"),
      JSON.stringify({ agentType: "scout", toolUseId: "spawn" }),
    );
    await writeFile(
      join(project, "s1", "subagents", "agent-a1.jsonl"),
      jsonl({ type: "user", message: { content: "go" } }),
    );

    const { events } = await collect(async (events) => {
      await until(() => events.some((event) => event.type === "agent.started"));
      // why: half a line must wait until its newline arrives
      await writeFile(
        join(project, "s1.jsonl"),
        `${jsonl({ type: "user", message: { content: "Map the repo" } }).trim()}`,
        { flag: "a" },
      );
      await Bun.sleep(80);
      expect(events.filter((event) => event.type === "session.started")).toHaveLength(1);
    });

    expect(events.map((event) => event.type)).toEqual(["session.started", "tool.started", "agent.started"]);
    expect(events[2]).toMatchObject({ agentId: "a1", name: "scout", parentToolId: "spawn" });
  });

  test("skips transcripts older than the replay window", async () => {
    const project = join(dir, "-old");
    await mkdir(project, { recursive: true });
    const path = join(project, "old.jsonl");
    await writeFile(path, jsonl({ type: "user", message: { content: "old" } }));
    const past = new Date(Date.now() - 48 * 3_600_000);
    const { utimes } = await import("node:fs/promises");
    await utimes(path, past, past);
    const { events } = await collect(() => Bun.sleep(80));
    expect(events.some((event) => event.sessionId === "old")).toBe(false);
  });

  test("reports nothing for a missing directory", async () => {
    const events: AgentEvent[] = [];
    const watcher = watchClaudeCode(join(dir, "missing"), 24, (batch) => events.push(...batch), 20);
    await Bun.sleep(60);
    watcher.stop();
    expect(events).toEqual([]);
    expect(watcher.status().sessions).toBe(0);
  });
});
