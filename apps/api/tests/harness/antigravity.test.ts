import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { antigravity } from "../../src/harness/antigravity";

const send = (payload: unknown) => antigravity.hook?.(payload) ?? [];
const common = {
  conversationId: "c1",
  workspacePaths: ["/repo"],
  transcriptPath: "/t",
  artifactDirectoryPath: "/a",
  modelName: "gemini-3",
};
const hook = (hookEventName: string, extra: object = {}) => send({ ...common, hookEventName, ...extra });

describe("antigravity hooks", () => {
  test("session start emits the session and the main agent", () => {
    const events = hook("SessionStart");
    expect(events).toMatchObject([
      { type: "session.started", sessionId: "c1", harness: "antigravity", cwd: "/repo" },
      { type: "agent.started", sessionId: "c1", agentId: "c1", name: "main", model: "gemini-3" },
    ]);
  });

  test("event name comes from hookEvent first, then the other fields", () => {
    expect(send({ ...common, hookEvent: "SessionStart", event: "Stop" })).toHaveLength(2);
    expect(send({ ...common, hook_event_name: "SessionStart" })).toHaveLength(2);
    expect(send({ ...common, event: "SessionStart" })).toHaveLength(2);
  });

  test("a changed lastUserInput becomes one user message, titled the first time", () => {
    const first = hook("PreInvocation", { invocationNum: 1, initialNumSteps: 0, lastUserInput: "Build it\nnow" });
    expect(first).toMatchObject([
      { type: "session.started", title: "Build it" },
      { type: "message", role: "user", text: "Build it\nnow", agentId: "c1" },
    ]);
    expect(hook("PreInvocation", { lastUserInput: "Build it\nnow" })).toEqual([]);
    expect(hook("PreInvocation", { lastUserInput: "next" })).toMatchObject([{ type: "message", text: "next" }]);
    expect(hook("PostInvocation", { invocationNum: 1, initialNumSteps: 0 })).toEqual([]);
  });

  test("tool ids come from conversation and step, args summarize with PascalCase keys", () => {
    const started = hook("PreToolUse", {
      stepIdx: 3,
      toolCall: { name: "run_command", args: { CommandLine: "ls -la\nx", Cwd: "/repo" } },
    });
    expect(started).toMatchObject([
      { type: "tool.started", toolId: "c1:3", name: "run_command", summary: "ls -la", agentId: "c1" },
    ]);
    expect(hook("PostToolUse", { stepIdx: 3, toolCall: { name: "run_command" } })).toMatchObject([
      { type: "tool.finished", toolId: "c1:3", ok: true },
    ]);
    expect(hook("PostToolUse", { stepIdx: 4, error: "boom" })).toMatchObject([{ toolId: "c1:4", ok: false }]);
    expect(hook("PostToolUse", { stepIdx: 5, error: "" })).toMatchObject([{ ok: true }]);
  });

  test("rejects malformed payloads and ignores unknown events", () => {
    expect(() => send(null)).toThrow(InvalidPayload);
    expect(() => send({ hookEventName: "SessionStart" })).toThrow(InvalidPayload);
    expect(() => send({ conversationId: 7, hookEventName: "SessionStart" })).toThrow(InvalidPayload);
    expect(() => send({ conversationId: "c1" })).toThrow(InvalidPayload);
    expect(hook("Stop", { executionNum: 1, terminationReason: "done", fullyIdle: true })).toEqual([]);
    expect(hook("Mystery")).toEqual([]);
  });
});
