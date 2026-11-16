import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { copilotCli, parseCopilotTranscript } from "../../src/harness/copilot-cli";

const ms = Date.parse("2026-11-16T10:00:00.000Z");
const at = "2026-11-16T10:00:00.000Z";
const base = (sessionId: string, hookEvent: string, extra: object = {}) => ({
  sessionId,
  hookEvent,
  timestamp: ms,
  cwd: "/repo",
  ...extra,
});
const hook = (value: unknown) => copilotCli.hook?.(value) ?? [];

describe("copilot-cli hook", () => {
  test("sessionStart carries the initial prompt as title and uses the payload time", () => {
    expect(hook(base("s1", "sessionStart", { source: "new", initialPrompt: "Fix it" }))).toEqual([
      { type: "session.started", sessionId: "s1", at, harness: "copilot-cli", cwd: "/repo", title: "Fix it" },
    ]);
  });

  test("first prompt titles a session without a start prompt", () => {
    expect(hook(base("s2", "userPromptSubmitted", { prompt: "Hello" }))).toEqual([
      { type: "session.started", sessionId: "s2", at, harness: "copilot-cli", cwd: "/repo", title: "Hello" },
      { type: "message", sessionId: "s2", at, agentId: "s2", role: "user", text: "Hello" },
    ]);
    expect(hook(base("s2", "userPromptSubmitted", { prompt: "Again" }))).toEqual([
      { type: "message", sessionId: "s2", at, agentId: "s2", role: "user", text: "Again" },
    ]);
  });

  test("tools pair first-in first-out by name, args as object or JSON string", () => {
    const [a] = hook(base("s3", "preToolUse", { toolName: "bash", toolArgs: { command: "ls\nrm" } }));
    const [b] = hook(base("s3", "preToolUse", { toolName: "bash", toolArgs: '{"command":"pwd"}' }));
    expect(a).toMatchObject({ type: "tool.started", name: "bash", summary: "ls", agentId: "s3" });
    expect(b).toMatchObject({ summary: "pwd" });
    const done = hook(
      base("s3", "postToolUse", {
        toolName: "bash",
        toolArgs: {},
        toolResult: { resultType: "success", textResultForLlm: "x" },
      }),
    );
    expect(done).toEqual([
      { type: "tool.finished", sessionId: "s3", at, toolId: (a as { toolId: string }).toolId, ok: true },
    ]);
  });

  test("a non-success result or a failure hook finishes with ok false", () => {
    hook(base("s4", "preToolUse", { toolName: "edit", toolArgs: "not json" }));
    const denied = hook(
      base("s4", "postToolUse", { toolName: "edit", toolResult: { resultType: "denied", textResultForLlm: "" } }),
    );
    expect(denied[0]).toMatchObject({ type: "tool.finished", ok: false });
    hook(base("s4", "preToolUse", { toolName: "edit", toolArgs: 5 }));
    expect(hook(base("s4", "postToolUseFailure", { toolName: "edit", toolArgs: {}, error: "boom" }))[0]).toMatchObject({
      ok: false,
    });
  });

  test("a finish with no matching start emits nothing", () => {
    expect(hook(base("s5", "postToolUse", { toolName: "x", toolResult: { resultType: "success" } }))).toEqual([]);
  });

  test("subagent start and stop use agentId, falling back to agentName", () => {
    expect(
      hook(
        base("s6", "subagentStart", {
          agentName: "reviewer",
          agentId: "a1",
          parentAgentId: "s6",
          transcriptPath: "/t",
        }),
      ),
    ).toEqual([{ type: "agent.started", sessionId: "s6", at, agentId: "a1", name: "reviewer", parentAgentId: "s6" }]);
    expect(
      hook(
        base("s6", "subagentStop", {
          agentName: "reviewer",
          response: "ok",
          stopReason: "end_turn",
          transcriptPath: "/t",
        }),
      ),
    ).toEqual([
      { type: "message", sessionId: "s6", at, agentId: "reviewer", role: "assistant", text: "ok" },
      { type: "agent.stopped", sessionId: "s6", at, agentId: "reviewer" },
    ]);
  });

  test("sessionEnd stops the main agent, agentStop maps to nothing", () => {
    expect(hook(base("s7", "sessionEnd", { reason: "complete" }))).toEqual([
      { type: "agent.stopped", sessionId: "s7", at, agentId: "s7" },
    ]);
    expect(hook(base("s7", "agentStop", { transcriptPath: "/t", stopReason: "end_turn" }))).toEqual([]);
  });

  test("rejects non-objects, missing session id and wrong types", () => {
    expect(() => hook(null)).toThrow(InvalidPayload);
    expect(() => hook({ hookEvent: "sessionStart" })).toThrow(InvalidPayload);
    expect(() => hook(base("s8", "preToolUse", { toolName: 5 }))).toThrow(InvalidPayload);
  });

  test("unknown events return nothing", () => {
    expect(hook(base("s9", "errorOccurred"))).toEqual([]);
  });
});

describe("copilot-cli transcripts", () => {
  test("parses session start, messages, tool runs, subagents and malformed lines", () => {
    const state = { sessionId: "dir1", titled: false };
    expect(
      parseCopilotTranscript(
        JSON.stringify({
          type: "session.start",
          timestamp: at,
          data: { sessionId: "cop1", startTime: at, context: { cwd: "/repo" } },
        }),
        state,
      ),
    ).toEqual([{ type: "session.started", sessionId: "cop1", at, harness: "copilot-cli", cwd: "/repo" }]);

    expect(
      parseCopilotTranscript(
        JSON.stringify({ type: "user.message", timestamp: at, data: { content: "Build it" } }),
        state,
      ),
    ).toEqual([
      { type: "session.started", sessionId: "cop1", at, harness: "copilot-cli", cwd: "/repo", title: "Build it" },
      { type: "message", sessionId: "cop1", at, agentId: "cop1", role: "user", text: "Build it" },
    ]);

    expect(
      parseCopilotTranscript(
        JSON.stringify({
          type: "tool.execution_start",
          timestamp: at,
          data: { toolCallId: "tc1", toolName: "bash", arguments: { command: "bun test" } },
        }),
        state,
      ),
    ).toEqual([
      {
        type: "tool.started",
        sessionId: "cop1",
        at,
        agentId: "cop1",
        toolId: "tc1",
        name: "bash",
        summary: "bun test",
      },
    ]);

    expect(
      parseCopilotTranscript(
        JSON.stringify({
          type: "tool.execution_complete",
          timestamp: at,
          data: { toolCallId: "tc1", model: "gpt-5.3-codex", success: false },
        }),
        state,
      ),
    ).toEqual([{ type: "tool.finished", sessionId: "cop1", at, toolId: "tc1", ok: false }]);

    expect(
      parseCopilotTranscript(
        JSON.stringify({ type: "assistant.message", timestamp: at, data: { content: "Done" } }),
        state,
      ),
    ).toEqual([
      {
        type: "message",
        sessionId: "cop1",
        at,
        agentId: "cop1",
        role: "assistant",
        text: "Done",
        model: "gpt-5.3-codex",
      },
    ]);

    expect(
      parseCopilotTranscript(
        JSON.stringify({
          type: "subagent.started",
          timestamp: at,
          data: { toolCallId: "sa1", agentName: "explore", agentDisplayName: "Explore Agent" },
        }),
        state,
      ),
    ).toEqual([
      { type: "agent.started", sessionId: "cop1", at, agentId: "sa1", name: "Explore Agent", parentToolId: "sa1" },
    ]);
    expect(
      parseCopilotTranscript(
        JSON.stringify({ type: "subagent.completed", timestamp: at, data: { toolCallId: "sa1" } }),
        state,
      ),
    ).toEqual([{ type: "agent.stopped", sessionId: "cop1", at, agentId: "sa1" }]);

    expect(parseCopilotTranscript("{broken", state)).toEqual([]);
    expect(parseCopilotTranscript(JSON.stringify({ timestamp: at }), state)).toEqual([]);
  });
});
