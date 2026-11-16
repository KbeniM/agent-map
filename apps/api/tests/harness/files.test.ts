import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@rancher/shared/events";
import { claudeCode } from "../../src/harness/claude-code";
import { watchFiles } from "../../src/harness/files";
import { at, until } from "../helpers";

const jsonl = (...lines: object[]) =>
  `${lines.map((value) => JSON.stringify({ timestamp: at, ...value })).join("\n")}\n`;
const dir = await mkdtemp(join(tmpdir(), "rancher-files-"));
afterAll(() => rm(dir, { recursive: true, force: true }));
const source = claudeCode.files as NonNullable<typeof claudeCode.files>;

describe("watchFiles with Claude Code transcripts", () => {
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

    const events: AgentEvent[] = [];
    const watcher = watchFiles(source, dir, 24, (batch) => events.push(...batch), 20);
    await until(() => events.some((event) => event.type === "agent.started"));
    // why: half a line must wait until its newline arrives
    await writeFile(join(project, "s1.jsonl"), jsonl({ type: "user", message: { content: "next" } }).trim(), {
      flag: "a",
    });
    await Bun.sleep(80);
    expect(events.filter((event) => event.type === "message")).toHaveLength(2);
    await writeFile(join(project, "s1.jsonl"), "\n", { flag: "a" });
    await until(() => events.filter((event) => event.type === "message").length === 3);
    watcher.stop();

    expect(events.map((event) => event.type)).toEqual([
      "session.started",
      "message",
      "tool.started",
      "agent.started",
      "message",
      "message",
    ]);
    expect(events[3]).toMatchObject({ agentId: "a1", name: "scout", parentToolId: "spawn" });
    expect(watcher.status()).toMatchObject({ sessions: 1, lastEventAt: at });
  });

  test("skips transcripts older than the replay window", async () => {
    const project = join(dir, "-old");
    await mkdir(project, { recursive: true });
    const path = join(project, "old.jsonl");
    await writeFile(path, jsonl({ type: "user", message: { content: "old" } }));
    const past = new Date(Date.now() - 48 * 3_600_000);
    await utimes(path, past, past);
    const events: AgentEvent[] = [];
    const watcher = watchFiles(source, dir, 24, (batch) => events.push(...batch), 20);
    await Bun.sleep(80);
    watcher.stop();
    expect(events.some((event) => event.sessionId === "old")).toBe(false);
  });

  test("reports nothing for a missing directory", async () => {
    const events: AgentEvent[] = [];
    const watcher = watchFiles(source, join(dir, "missing"), 24, (batch) => events.push(...batch), 20);
    await Bun.sleep(60);
    watcher.stop();
    expect(events).toEqual([]);
    expect(watcher.status().sessions).toBe(0);
  });
});
