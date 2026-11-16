import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { geminiCli } from "../../src/harness/gemini-cli";

const at = "2026-11-16T10:00:00.000Z";
const send = (payload: unknown) => geminiCli.hook?.(payload) ?? [];
const hook = (session_id: string, hook_event_name: string, extra: object = {}) =>
  send({ session_id, transcript_path: "/t", cwd: "/repo", hook_event_name, timestamp: at, ...extra });

describe("gemini-cli hooks", () => {
  test("session, prompt, model and answer", () => {
    expect(hook("m1", "SessionStart", { source: "startup" })).toEqual([
      { type: "session.started", sessionId: "m1", at, harness: "gemini-cli", cwd: "/repo" },
    ]);
    expect(hook("m1", "BeforeModel", { llm_request: { model: "gemini-2.5-pro" } })).toEqual([
      { type: "agent.started", sessionId: "m1", at, agentId: "m1", name: "main", model: "gemini-2.5-pro" },
    ]);
    expect(hook("m1", "BeforeModel", { llm_request: { model: "gemini-2.5-pro" } })).toEqual([]);
    const first = hook("m1", "BeforeAgent", { prompt: "Hello\nthere" });
    expect(first[0]).toMatchObject({ type: "session.started", title: "Hello" });
    expect(first[1]).toMatchObject({ type: "message", role: "user", text: "Hello\nthere" });
    expect(hook("m1", "BeforeAgent", { prompt: "more" }).map((event) => event.type)).toEqual(["message"]);
    expect(hook("m1", "AfterAgent", { prompt: "more", prompt_response: "Hi", stop_hook_active: false })).toEqual([
      { type: "message", sessionId: "m1", at, agentId: "m1", role: "assistant", text: "Hi", model: "gemini-2.5-pro" },
    ]);
    expect(hook("m1", "SessionEnd", { reason: "exit" })).toEqual([
      { type: "agent.stopped", sessionId: "m1", at, agentId: "m1" },
    ]);
  });

  test("tools pair first-in first-out and failure is not ok", () => {
    const start = hook("m2", "BeforeTool", {
      tool_name: "run_shell_command",
      tool_input: { command: "ls" },
      original_request_name: "x",
    })[0];
    expect(start).toMatchObject({ type: "tool.started", name: "run_shell_command", summary: "ls" });
    const toolId = start.type === "tool.started" ? start.toolId : "";
    expect(
      hook("m2", "AfterTool", { tool_name: "run_shell_command", tool_response: { llmContent: "", returnDisplay: "" } }),
    ).toEqual([{ type: "tool.finished", sessionId: "m2", at, toolId, ok: true }]);
    hook("m2", "BeforeTool", { tool_name: "read_file", tool_input: {} });
    expect(hook("m2", "AfterTool", { tool_name: "read_file", tool_response: { error: "denied" } })[0]).toMatchObject({
      ok: false,
    });
    expect(hook("m2", "AfterTool", { tool_name: "read_file", tool_response: {} })).toEqual([]);
  });

  test("rejects malformed payloads and ignores unknown events", () => {
    expect(() => send(42)).toThrow(InvalidPayload);
    expect(() => send({ hook_event_name: "SessionStart" })).toThrow(InvalidPayload);
    expect(() => send({ session_id: 1, hook_event_name: "SessionStart" })).toThrow(InvalidPayload);
    expect(hook("m3", "Notification")).toEqual([]);
    expect(hook("m3", "PreCompress")).toEqual([]);
  });
});
