import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { hookParser } from "../../src/harness/hooks";

const base = { session_id: "s1", cwd: "/repo" };

describe("hookParser (Claude Code and Codex hooks)", () => {
  test("starts a session with its model", () => {
    const parse = hookParser("claude-code");
    const events = parse({ ...base, hook_event_name: "SessionStart", model: "claude-opus-5" });
    expect(events.map((event) => event.type)).toEqual(["session.started", "agent.started"]);
    expect(events[1]).toMatchObject({ agentId: "s1", name: "main", model: "claude-opus-5" });
  });

  test("maps tool calls, failures and their agent", () => {
    const parse = hookParser("claude-code");
    const start = parse({
      ...base,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_use_id: "t1",
      tool_input: { command: "ls" },
      agent_id: "agent-a1",
    });
    expect(start[0]).toMatchObject({ type: "tool.started", agentId: "a1", toolId: "t1", summary: "ls" });
    expect(parse({ ...base, hook_event_name: "PostToolUseFailure", tool_use_id: "t1" })[0]).toMatchObject({
      ok: false,
    });
    expect(parse({ ...base, hook_event_name: "PostToolUse", tool_use_id: "t2" })[0]).toMatchObject({ ok: true });
  });

  test("links a subagent to the oldest open spawn call, once", () => {
    const parse = hookParser("claude-code");
    parse({ ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_use_id: "spawn-1" });
    parse({ ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_use_id: "spawn-2" });
    const first = parse({ ...base, hook_event_name: "SubagentStart", agent_id: "agent-a1", agent_type: "Explore" });
    expect(first[0]).toMatchObject({ type: "agent.started", agentId: "a1", name: "Explore", parentToolId: "spawn-1" });
    expect(parse({ ...base, hook_event_name: "SubagentStart", agent_id: "a1" })).toEqual([]);
  });

  test("turns a subagent stop into its answer and a stop", () => {
    const events = hookParser("claude-code")({
      ...base,
      hook_event_name: "SubagentStop",
      agent_id: "a1",
      last_assistant_message: "3 files",
    });
    expect(events).toMatchObject([
      { type: "message", agentId: "a1", role: "assistant", text: "3 files" },
      { type: "agent.stopped", agentId: "a1" },
    ]);
  });

  test("ignores events it does not map", () => {
    expect(hookParser("codex")({ ...base, hook_event_name: "PreCompact" })).toEqual([]);
  });

  test("rejects a payload without a session id", () => {
    expect(() => hookParser("codex")({ hook_event_name: "Stop" })).toThrow(InvalidPayload);
  });

  test("rejects a payload with wrong types", () => {
    expect(() => hookParser("codex")({ session_id: 5, hook_event_name: "Stop" })).toThrow(InvalidPayload);
  });

  test("rejects a non-object payload", () => {
    expect(() => hookParser("codex")("text")).toThrow(InvalidPayload);
  });
});
