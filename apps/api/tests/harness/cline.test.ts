import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { cline } from "../../src/harness/cline";

const ms = Date.parse("2026-11-16T10:00:00.000Z");
const at = "2026-11-16T10:00:00.000Z";
const hook = (value: unknown) => cline.hook?.(value) ?? [];
const snake = (task_id: string, hook_name: string, data: object = {}) => ({
  cline_version: "3",
  hook_name,
  timestamp: String(ms),
  task_id,
  workspace_roots: ["/repo"],
  user_id: "u",
  ...data,
});
const camel = (taskId: string, hookName: string, data: object = {}) => ({
  clineVersion: "3",
  hookName,
  timestamp: String(ms),
  taskId,
  workspaceRoots: ["/repo"],
  userId: "u",
  ...data,
});

describe("cline hook", () => {
  test("task_start opens the session in both casings", () => {
    const expected = (id: string) => [
      { type: "session.started" as const, sessionId: id, at, harness: "cline", cwd: "/repo" },
    ];
    expect(hook(snake("t1", "task_start", { task_start: { task_metadata: {} } }))).toEqual(expected("t1"));
    expect(hook(camel("t2", "taskStart", { taskStart: { taskMetadata: {} } }))).toEqual(expected("t2"));
    expect(hook(camel("t9", "task_start"))).toEqual(expected("t9"));
  });

  test("user_prompt_submit titles once, in both casings", () => {
    expect(hook(snake("t3", "user_prompt_submit", { user_prompt_submit: { prompt: "Hi", attachments: [] } }))).toEqual([
      { type: "session.started", sessionId: "t3", at, harness: "cline", title: "Hi", cwd: "/repo" },
      { type: "message", sessionId: "t3", at, agentId: "t3", role: "user", text: "Hi" },
    ]);
    expect(hook(camel("t3", "user_prompt_submit", { userPromptSubmit: { prompt: "Again", attachments: [] } }))).toEqual(
      [{ type: "message", sessionId: "t3", at, agentId: "t3", role: "user", text: "Again" }],
    );
  });

  test("tools pair by name, snake and camel, with failure", () => {
    const start = hook(
      snake("t4", "pre_tool_use", { pre_tool_use: { tool_name: "read_file", parameters: { path: "a" } } }),
    );
    expect(start[0]).toMatchObject({ type: "tool.started", name: "read_file", agentId: "t4" });
    const done = hook(
      snake("t4", "post_tool_use", {
        post_tool_use: { tool_name: "read_file", parameters: {}, result: "x", success: true, execution_time_ms: 3 },
      }),
    );
    expect(done).toEqual([
      { type: "tool.finished", sessionId: "t4", at, toolId: (start[0] as { toolId: string }).toolId, ok: true },
    ]);
    hook(
      camel("t4", "pre_tool_use", { preToolUse: { toolName: "execute_command", parameters: { command: "ls\nx" } } }),
    );
    const failed = hook(
      camel("t4", "post_tool_use", {
        postToolUse: { toolName: "execute_command", parameters: {}, success: false, executionTimeMs: 1 },
      }),
    );
    expect(failed[0]).toMatchObject({ type: "tool.finished", ok: false });
  });

  test("a parameter key is not folded", () => {
    const start = hook(
      snake("t5", "pre_tool_use", { pre_tool_use: { tool_name: "x", parameters: { filePath: "a" } } }),
    );
    expect(start[0]).toMatchObject({ type: "tool.started", name: "x" });
    expect((start[0] as { summary?: string }).summary).toBeUndefined();
  });

  test("task_complete and task_cancel stop the main agent", () => {
    for (const name of ["task_complete", "task_cancel"]) {
      expect(hook(snake("t6", name))).toEqual([{ type: "agent.stopped", sessionId: "t6", at, agentId: "t6" }]);
    }
  });

  test("rejects non-objects, missing task id and wrong types", () => {
    expect(() => hook("x")).toThrow(InvalidPayload);
    expect(() => hook({ hook_name: "task_start" })).toThrow(InvalidPayload);
    expect(() => hook(snake("t7", "pre_tool_use", { pre_tool_use: { tool_name: 3 } }))).toThrow(InvalidPayload);
  });

  test("unknown events return nothing", () => {
    expect(hook(snake("t8", "task_resume"))).toEqual([]);
  });
});
