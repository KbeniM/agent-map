import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { grok } from "../../src/harness/grok";

const at = "2026-11-16T10:00:00.000Z";
const send = (payload: unknown) => grok.hook?.(payload) ?? [];
const base = {
  sessionId: "g1",
  cwd: "/repo",
  workspaceRoot: "/repo",
  timestamp: at,
  permissionMode: "default",
  promptId: "p1",
};
const hook = (hookEventName: string, extra: object = {}) => send({ ...base, hookEventName, ...extra });

describe("grok hooks", () => {
  test("session lifecycle and prompts", () => {
    expect(hook("SessionStart")).toEqual([
      { type: "session.started", sessionId: "g1", at, harness: "grok", cwd: "/repo" },
    ]);
    const first = hook("UserPromptSubmit", { prompt: "Fix it\nplease" });
    expect(first.map((event) => event.type)).toEqual(["session.started", "message"]);
    expect(first[0]).toMatchObject({ title: "Fix it" });
    expect(hook("UserPromptSubmit", { prompt: "again" }).map((event) => event.type)).toEqual(["message"]);
    expect(hook("Stop", { lastAssistantMessage: "Done" })).toEqual([
      { type: "message", sessionId: "g1", at, agentId: "g1", role: "assistant", text: "Done" },
    ]);
    expect(hook("SessionEnd")).toEqual([{ type: "agent.stopped", sessionId: "g1", at, agentId: "g1" }]);
  });

  test("tool start, finish and failure", () => {
    const started = hook("PreToolUse", { toolName: "Bash", toolUseId: "t1", toolInput: { command: "ls\nrm" } });
    expect(started).toEqual([
      { type: "tool.started", sessionId: "g1", at, agentId: "g1", toolId: "t1", name: "Bash", summary: "ls" },
    ]);
    expect(hook("PostToolUse", { toolUseId: "t1", toolResult: "x" })).toEqual([
      { type: "tool.finished", sessionId: "g1", at, toolId: "t1", ok: true },
    ]);
    expect(hook("PostToolUseFailure", { toolUseId: "t1" })).toEqual([
      { type: "tool.finished", sessionId: "g1", at, toolId: "t1", ok: false },
    ]);
  });

  test("subagent start and stop, skipped without an id", () => {
    expect(hook("SubagentStart", { agentId: "a1", agentType: "explore" })).toEqual([
      { type: "agent.started", sessionId: "g1", at, agentId: "a1", name: "explore" },
    ]);
    expect(hook("SubagentStop", { agentId: "a1" })).toEqual([
      { type: "agent.stopped", sessionId: "g1", at, agentId: "a1" },
    ]);
    expect(hook("SubagentStart")).toEqual([]);
  });

  test("rejects malformed payloads and ignores unknown events", () => {
    expect(() => send("nope")).toThrow(InvalidPayload);
    expect(() => send({ hookEventName: "Stop" })).toThrow(InvalidPayload);
    expect(() => send({ sessionId: 5, hookEventName: "Stop" })).toThrow(InvalidPayload);
    expect(hook("StopFailure")).toEqual([]);
    expect(hook("Mystery")).toEqual([]);
  });
});
