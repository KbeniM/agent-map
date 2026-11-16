import { describe, expect, test } from "bun:test";
import { InvalidPayload } from "../../src/harness/adapter";
import { opencode } from "../../src/harness/opencode";

const send = (payload: unknown) => opencode.hook?.(payload) ?? [];
const t0 = Date.parse("2026-11-16T10:00:00.000Z");
const iso = (offset: number) => new Date(t0 + offset).toISOString();
const sessionInfo = (id: string, extra: object = {}) => ({
  id,
  title: "New session - 2026-11-16T10:00:00.000Z",
  directory: "/repo",
  time: { created: t0, updated: t0 },
  ...extra,
});
const event = (type: string, properties: object) => send({ type, properties });

describe("opencode events", () => {
  test("root session starts with a real title only", () => {
    expect(event("session.created", { info: sessionInfo("o1") })).toEqual([
      { type: "session.started", sessionId: "o1", at: iso(0), harness: "opencode", cwd: "/repo", title: undefined },
    ]);
    expect(event("session.updated", { info: sessionInfo("o1") })).toEqual([]);
    expect(event("session.updated", { info: sessionInfo("o1", { title: "Fix login" }) })).toMatchObject([
      { type: "session.started", title: "Fix login" },
    ]);
    expect(event("session.updated", { info: sessionInfo("o1", { title: "Fix login" }) })).toEqual([]);
  });

  test("user and completed assistant text become messages", () => {
    const user = {
      id: "m1",
      sessionID: "o2",
      role: "user",
      time: { created: t0 },
      agent: "build",
      model: { providerID: "p", modelID: "u" },
    };
    expect(
      event("message.part.updated", {
        part: { id: "p1", sessionID: "o2", messageID: "m1", type: "text", text: "Hello" },
      }),
    ).toEqual([]);
    expect(event("message.updated", { info: user })).toEqual([
      { type: "message", sessionId: "o2", at: iso(0), agentId: "o2", role: "user", text: "Hello", model: undefined },
    ]);
    const assistant = {
      id: "m2",
      sessionID: "o2",
      role: "assistant",
      time: { created: t0 },
      modelID: "claude",
      providerID: "p",
      agent: "build",
    };
    expect(event("message.updated", { info: assistant })).toEqual([]);
    expect(
      event("message.part.updated", { part: { id: "p2", sessionID: "o2", messageID: "m2", type: "text", text: "Hi" } }),
    ).toEqual([]);
    expect(
      event("message.part.updated", {
        part: { id: "p3", sessionID: "o2", messageID: "m2", type: "text", text: "synth", synthetic: true },
      }),
    ).toEqual([]);
    expect(event("message.updated", { info: { ...assistant, time: { created: t0, completed: t0 + 5 } } })).toEqual([
      { type: "message", sessionId: "o2", at: iso(5), agentId: "o2", role: "assistant", text: "Hi", model: "claude" },
    ]);
  });

  test("tool parts start once, finish ok or failed", () => {
    const part = (status: string, extra: object = {}) => ({
      part: {
        id: "x",
        sessionID: "o3",
        messageID: "m",
        type: "tool",
        callID: "call1",
        tool: "bash",
        state: { status, input: { command: "ls\nx" }, time: { start: t0, end: t0 + 9 }, ...extra },
      },
    });
    expect(event("message.part.updated", part("pending"))).toMatchObject([
      { type: "tool.started", toolId: "call1", name: "bash", summary: "ls", agentId: "o3", at: iso(0) },
    ]);
    expect(event("message.part.updated", part("running"))).toEqual([]);
    expect(event("message.part.updated", part("completed"))).toEqual([
      { type: "tool.finished", sessionId: "o3", at: iso(9), toolId: "call1", ok: true },
    ]);
    expect(event("message.part.updated", part("completed"))).toEqual([]);
    const failed = { part: { ...part("error").part, callID: "call2" } };
    expect(event("message.part.updated", failed)).toMatchObject([
      { type: "tool.started" },
      { type: "tool.finished", ok: false },
    ]);
  });

  test("child session links to its parent and the spawning task call", () => {
    event("session.created", { info: sessionInfo("o4") });
    const task = (status: string) => ({
      part: {
        id: "tp",
        sessionID: "o4",
        messageID: "m",
        type: "tool",
        callID: "task1",
        tool: "task",
        state: {
          status,
          input: { description: "look" },
          metadata: { sessionId: "child1" },
          time: { start: t0, end: t0 + 3 },
        },
      },
    });
    const child = sessionInfo("child1", { parentID: "o4", title: "Explore code (@explore subagent)" });
    expect(event("session.created", { info: child })).toEqual([
      {
        type: "agent.started",
        sessionId: "o4",
        at: iso(0),
        agentId: "child1",
        name: "explore",
        parentAgentId: "o4",
        parentToolId: undefined,
      },
    ]);
    expect(event("message.part.updated", task("running"))).toMatchObject([
      { type: "agent.started", agentId: "child1", parentToolId: "task1" },
      { type: "tool.started", toolId: "task1" },
    ]);
    expect(event("message.part.updated", task("completed")).map((e) => e.type)).toEqual([
      "agent.started",
      "tool.finished",
      "agent.stopped",
    ]);
    expect(event("session.created", { info: child })).toEqual([]);
  });

  test("rejects malformed payloads and ignores unknown events", () => {
    expect(() => send("x")).toThrow(InvalidPayload);
    expect(() => send({ properties: {} })).toThrow(InvalidPayload);
    expect(() => event("session.created", { info: { title: "no id" } })).toThrow(InvalidPayload);
    expect(() => event("message.updated", { info: { id: "m", sessionID: "s", role: 4 } })).toThrow(InvalidPayload);
    expect(event("server.connected", {})).toEqual([]);
  });
});
