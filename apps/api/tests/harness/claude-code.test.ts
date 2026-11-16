import { describe, expect, test } from "bun:test";
import { type Cursor, parseLine } from "../../src/harness/claude-code";
import { summarize } from "../../src/harness/pairing";

const at = "2026-11-16T10:00:00.000Z";
const main = (): Cursor => ({ sessionId: "s1", agentId: "s1", started: false });
const line = (value: object) => JSON.stringify({ timestamp: at, cwd: "/repo", ...value });

describe("parseLine", () => {
  test("starts the session from the first real prompt", () => {
    const events = parseLine(line({ type: "user", message: { content: "Fix the login bug\nmore" } }), main());
    expect(events).toEqual([
      {
        type: "session.started",
        sessionId: "s1",
        at,
        harness: "claude-code",
        title: "Fix the login bug",
        cwd: "/repo",
      },
      { type: "message", sessionId: "s1", at, agentId: "s1", role: "user", text: "Fix the login bug\nmore" },
    ]);
  });

  test("turns tool_use and tool_result blocks into tool events", () => {
    const cursor = { ...main(), started: true };
    const use = line({
      type: "assistant",
      message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "ls -la\nrm", env: "x" } }] },
    });
    const result = line({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true }] },
    });
    expect(parseLine(use, cursor)).toEqual([
      { type: "tool.started", sessionId: "s1", at, agentId: "s1", toolId: "t1", name: "Bash", summary: "ls -la" },
    ]);
    expect(parseLine(result, cursor)).toEqual([
      { type: "tool.finished", sessionId: "s1", at, toolId: "t1", ok: false },
    ]);
  });

  test("skips meta and system-reminder prompts when picking the title", () => {
    const cursor = main();
    expect(parseLine(line({ type: "user", isMeta: true, message: { content: "hidden" } }), cursor)).toEqual([]);
    expect(parseLine(line({ type: "user", message: { content: "<system-reminder>x" } }), cursor)).toEqual([]);
    expect(cursor.started).toBe(false);
  });

  test("turns assistant text into a message with its model", () => {
    const cursor = { ...main(), started: true };
    const reply = line({
      type: "assistant",
      message: { model: "claude-haiku-5-5", content: [{ type: "thinking" }, { type: "text", text: "Found it." }] },
    });
    expect(parseLine(reply, cursor)).toEqual([
      {
        type: "message",
        sessionId: "s1",
        at,
        agentId: "s1",
        role: "assistant",
        text: "Found it.",
        model: "claude-haiku-5-5",
      },
    ]);
  });

  test("turns a subagent hand-back into its answer", () => {
    const cursor = { sessionId: "s1", agentId: "a1", started: true };
    const handback = line({
      type: "assistant",
      message: { content: [{ type: "tool_use", id: "h1", name: "SubagentHandback", input: { message: "3 files" } }] },
    });
    expect(parseLine(handback, cursor)[0]).toMatchObject({
      type: "message",
      agentId: "a1",
      role: "assistant",
      text: "3 files",
    });
  });

  test("does not turn tool results or reminders into messages", () => {
    const cursor = { ...main(), started: true };
    const result = line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1" }] } });
    const reminder = line({ type: "user", message: { content: [{ type: "text", text: "<system-reminder>x" }] } });
    expect(parseLine(result, cursor).map((event) => event.type)).toEqual(["tool.finished"]);
    expect(parseLine(reminder, cursor)).toEqual([]);
  });

  test("ignores malformed JSON", () => {
    expect(parseLine("{not json", main())).toEqual([]);
  });

  test("ignores lines without a timestamp", () => {
    expect(parseLine(JSON.stringify({ type: "assistant", message: { content: [] } }), main())).toEqual([]);
  });

  test("ignores other line types", () => {
    expect(parseLine(line({ type: "queue-operation" }), main())).toEqual([]);
  });
});

describe("summarize", () => {
  test("keeps one short field and never the whole input", () => {
    expect(summarize({ file_path: "/a.ts", content: "secret" })).toBe("/a.ts");
    expect(summarize({ content: "secret" })).toBeUndefined();
    expect(summarize({ command: "x".repeat(500) })).toHaveLength(120);
  });
});
