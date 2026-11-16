import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { cursor } from "../../src/harness/cursor";

const base = (conversation_id: string, hook_event_name: string, extra: object = {}) => ({
  conversation_id,
  generation_id: "g1",
  model: "gpt-5",
  hook_event_name,
  cursor_version: "2.4",
  workspace_roots: ["/repo"],
  transcript_path: "/t",
  ...extra,
});
const hook = (value: unknown) => cursor.hook?.(value) ?? [];
const strip = (events: object[]) =>
  events.map((event) => Object.fromEntries(Object.entries(event).filter(([key]) => key !== "at")));

describe("cursor hook", () => {
  test("sessionStart opens the session and the main agent", () => {
    const events = hook(base("c1", "sessionStart", { session_id: "c1", is_background_agent: false }));
    expect(strip(events)).toEqual([
      { type: "session.started", sessionId: "c1", harness: "cursor", cwd: "/repo" },
      { type: "agent.started", sessionId: "c1", agentId: "c1", name: "main", model: "gpt-5" },
    ]);
  });

  test("first prompt titles the session once, later prompts only add messages", () => {
    const first = hook(base("c2", "beforeSubmitPrompt", { prompt: "Fix login", attachments: [] }));
    expect(strip(first)).toEqual([
      { type: "session.started", sessionId: "c2", harness: "cursor", title: "Fix login", cwd: "/repo" },
      { type: "message", sessionId: "c2", agentId: "c2", role: "user", text: "Fix login" },
    ]);
    const second = hook(base("c2", "beforeSubmitPrompt", { prompt: "More", attachments: [] }));
    expect(strip(second)).toEqual([{ type: "message", sessionId: "c2", agentId: "c2", role: "user", text: "More" }]);
  });

  test("afterAgentResponse and sessionEnd", () => {
    expect(strip(hook(base("c3", "afterAgentResponse", { text: "Done" })))).toEqual([
      { type: "message", sessionId: "c3", agentId: "c3", role: "assistant", text: "Done", model: "gpt-5" },
    ]);
    expect(strip(hook(base("c3", "sessionEnd", { session_id: "c3", reason: "completed" })))).toEqual([
      { type: "agent.stopped", sessionId: "c3", agentId: "c3" },
    ]);
  });

  test("tool start, success and failure", () => {
    const tool = { tool_name: "Shell", tool_input: { command: "ls\nrm" }, tool_use_id: "t1", cwd: "/repo" };
    expect(strip(hook(base("c4", "preToolUse", tool)))).toEqual([
      { type: "tool.started", sessionId: "c4", agentId: "c4", toolId: "t1", name: "Shell", summary: "ls" },
    ]);
    expect(strip(hook(base("c4", "postToolUse", { ...tool, tool_output: "{}", duration: 1 })))).toEqual([
      { type: "tool.finished", sessionId: "c4", toolId: "t1", ok: true },
    ]);
    hook(base("c4", "preToolUse", { ...tool, tool_use_id: "t2" }));
    expect(strip(hook(base("c4", "postToolUseFailure", { ...tool, tool_use_id: "t2", error_message: "x" })))).toEqual([
      { type: "tool.finished", sessionId: "c4", toolId: "t2", ok: false },
    ]);
  });

  test("postToolUse for an unseen tool emits tool.started first with the same time", () => {
    const events = hook(
      base("c5", "postToolUse", { tool_name: "Read", tool_input: { file_path: "a.ts" }, tool_use_id: "late" }),
    );
    expect(events.map((event) => event.type)).toEqual(["tool.started", "tool.finished"]);
    expect(events[0].at).toBe(events[1].at);
  });

  test("subagent events map to the root session and the child agent", () => {
    const start = hook(
      base("root", "subagentStart", {
        subagent_id: "kid",
        subagent_type: "explore",
        task: "Look around",
        parent_conversation_id: "root",
        tool_call_id: "tc1",
        subagent_model: "haiku",
      }),
    );
    expect(strip(start)).toEqual([
      {
        type: "agent.started",
        sessionId: "root",
        agentId: "kid",
        name: "explore",
        parentToolId: "tc1",
        model: "haiku",
      },
      { type: "message", sessionId: "root", agentId: "kid", role: "user", text: "Look around" },
    ]);
    const tool = hook(base("kid", "preToolUse", { tool_name: "Read", tool_input: {}, tool_use_id: "k1" }));
    expect(strip(tool)).toEqual([
      { type: "tool.started", sessionId: "root", agentId: "kid", toolId: "k1", name: "Read" },
    ]);
    expect(
      strip(hook(base("kid", "subagentStop", { subagent_type: "explore", summary: "Found it", status: "ok" }))),
    ).toEqual([
      { type: "message", sessionId: "root", agentId: "kid", role: "assistant", text: "Found it" },
      { type: "agent.stopped", sessionId: "root", agentId: "kid" },
    ]);
  });

  test("subagentStop from an unknown conversation is skipped", () => {
    expect(hook(base("stranger", "subagentStop", { summary: "x" }))).toEqual([]);
  });

  test("rejects non-objects, missing conversation id and wrong types", () => {
    expect(() => hook("nope")).toThrow(InvalidPayload);
    expect(() => hook({ hook_event_name: "stop" })).toThrow(InvalidPayload);
    expect(() => hook(base("c6", "preToolUse", { tool_name: 7 }))).toThrow(InvalidPayload);
  });

  test("unknown events return nothing", () => {
    expect(hook(base("c7", "afterFileEdit"))).toEqual([]);
  });
});
