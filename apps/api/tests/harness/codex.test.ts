import { describe, expect, test } from "bun:test";
import { parseRollout } from "../../src/harness/codex";
import { at } from "../helpers";

const line = (type: string, payload: object) => JSON.stringify({ timestamp: at, type, payload });
const main = () => ({ sessionId: "file", agentId: "file", titled: false });

describe("parseRollout", () => {
  test("starts a session from session_meta and titles it from the first prompt", () => {
    const state = main();
    expect(parseRollout(line("session_meta", { id: "t1", session_id: "t1", cwd: "/repo" }), state)).toEqual([
      { type: "session.started", sessionId: "t1", at, harness: "codex", cwd: "/repo" },
    ]);
    const prompt = parseRollout(line("event_msg", { type: "user_message", message: "Fix the bug\nplease" }), state);
    expect(prompt).toEqual([
      { type: "session.started", sessionId: "t1", at, harness: "codex", title: "Fix the bug" },
      { type: "message", sessionId: "t1", at, agentId: "t1", role: "user", text: "Fix the bug\nplease" },
    ]);
  });

  test("attaches the turn's model to agent replies", () => {
    const state = { ...main(), sessionId: "t1", agentId: "t1" };
    parseRollout(line("turn_context", { model: "gpt-5-codex" }), state);
    expect(parseRollout(line("event_msg", { type: "agent_message", message: "Done." }), state)).toEqual([
      { type: "message", sessionId: "t1", at, agentId: "t1", role: "assistant", text: "Done.", model: "gpt-5-codex" },
    ]);
  });

  test("pairs a function call with its output and reads a nonzero exit as failure", () => {
    const state = { ...main(), sessionId: "t1", agentId: "t1" };
    const call = line("response_item", {
      type: "function_call",
      name: "shell_command",
      arguments: JSON.stringify({ command: "bun test" }),
      call_id: "c1",
    });
    expect(parseRollout(call, state)).toEqual([
      {
        type: "tool.started",
        sessionId: "t1",
        at,
        agentId: "t1",
        toolId: "c1",
        name: "shell_command",
        summary: "bun test",
      },
    ]);
    const failed = line("response_item", {
      type: "function_call_output",
      call_id: "c1",
      output: "Process exited with code 1",
    });
    const passed = line("response_item", {
      type: "function_call_output",
      call_id: "c2",
      output: "Process exited with code 0",
    });
    expect(parseRollout(failed, state)[0]).toMatchObject({ type: "tool.finished", ok: false });
    expect(parseRollout(passed, state)[0]).toMatchObject({ type: "tool.finished", ok: true });
  });

  test("turns a spawned thread into a subagent of its parent", () => {
    const meta = line("session_meta", {
      id: "child",
      session_id: "root",
      source: { subagent: { thread_spawn: { parent_thread_id: "root", depth: 1, agent_role: "explorer" } } },
    });
    expect(parseRollout(meta, main())).toEqual([
      { type: "agent.started", sessionId: "root", at, agentId: "child", name: "explorer", parentAgentId: "root" },
    ]);
  });

  test("reads patch results from patch_apply_end", () => {
    const state = { ...main(), sessionId: "t1", agentId: "t1" };
    expect(parseRollout(line("event_msg", { type: "patch_apply_end", call_id: "p1", success: false }), state)).toEqual([
      { type: "tool.finished", sessionId: "t1", at, toolId: "p1", ok: false },
    ]);
  });

  test("ignores malformed lines, unknown types and calls without ids", () => {
    expect(parseRollout("{oops", main())).toEqual([]);
    expect(parseRollout(line("compacted", {}), main())).toEqual([]);
    expect(parseRollout(line("response_item", { type: "function_call", name: "x" }), main())).toEqual([]);
  });
});
