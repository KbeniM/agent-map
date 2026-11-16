import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { windsurf } from "../../src/harness/windsurf";

const at = "2026-11-16T10:00:00.000Z";
const base = (trajectory_id: string, agent_action_name: string, tool_info: object = {}) => ({
  agent_action_name,
  trajectory_id,
  execution_id: "e1",
  timestamp: at,
  model_name: "swe-1",
  tool_info,
});
const hook = (value: unknown) => windsurf.hook?.(value) ?? [];

describe("windsurf hook", () => {
  test("pre_user_prompt titles the session once", () => {
    expect(hook(base("w1", "pre_user_prompt", { user_prompt: "Add tests" }))).toEqual([
      { type: "session.started", sessionId: "w1", at, harness: "windsurf", title: "Add tests" },
      { type: "message", sessionId: "w1", at, agentId: "w1", role: "user", text: "Add tests" },
    ]);
    expect(hook(base("w1", "pre_user_prompt", { user_prompt: "More" }))).toHaveLength(1);
  });

  test("post_cascade_response becomes an assistant message with the model", () => {
    expect(hook(base("w2", "post_cascade_response", { response: "Done" }))).toEqual([
      { type: "message", sessionId: "w2", at, agentId: "w2", role: "assistant", text: "Done", model: "swe-1" },
    ]);
  });

  test("code and command tools pair by action", () => {
    const read = hook(base("w3", "pre_read_code", { file_path: "/a.ts" }));
    const run = hook(base("w3", "pre_run_command", { command_line: "ls\nrm", cwd: "/" }));
    const write = hook(base("w3", "pre_write_code", { file_path: "/b.ts", edits: [] }));
    expect(read[0]).toMatchObject({ type: "tool.started", name: "Read", summary: "/a.ts", agentId: "w3" });
    expect(run[0]).toMatchObject({ name: "Bash", summary: "ls" });
    expect(write[0]).toMatchObject({ name: "Edit", summary: "/b.ts" });
    const done = hook(base("w3", "post_run_command", { command_line: "ls", cwd: "/" }));
    expect(done).toEqual([
      { type: "tool.finished", sessionId: "w3", at, toolId: (run[0] as { toolId: string }).toolId, ok: true },
    ]);
  });

  test("mcp tools use the mcp tool name", () => {
    const started = hook(
      base("w4", "pre_mcp_tool_use", { mcp_server_name: "s", mcp_tool_name: "search", mcp_tool_arguments: {} }),
    );
    expect(started[0]).toMatchObject({ type: "tool.started", name: "search" });
    expect(hook(base("w4", "post_mcp_tool_use", { mcp_tool_name: "search", mcp_result: "x" }))[0]).toMatchObject({
      type: "tool.finished",
      ok: true,
    });
  });

  test("a post without a pre emits nothing", () => {
    expect(hook(base("w5", "post_read_code", { file_path: "/a" }))).toEqual([]);
  });

  test("rejects non-objects, missing trajectory and wrong types", () => {
    expect(() => hook([])).toThrow(InvalidPayload);
    expect(() => hook({ agent_action_name: "pre_user_prompt" })).toThrow(InvalidPayload);
    expect(() => hook(base("w6", "pre_read_code", { file_path: 4 }))).toThrow(InvalidPayload);
  });

  test("unknown events return nothing", () => {
    expect(hook(base("w7", "post_setup_worktree"))).toEqual([]);
  });
});
