import { describe, expect, test } from "bun:test";
import { agentEventSchema, ingestSchema } from "../src/events";

const at = "2026-11-16T10:00:00.000Z";

describe("agentEventSchema", () => {
  test("accepts a tool call", () => {
    const event = { type: "tool.started", sessionId: "s", agentId: "s", toolId: "t", name: "Bash", at } as const;
    expect(agentEventSchema.parse(event)).toEqual(event);
  });

  test("rejects an unknown type", () => {
    expect(agentEventSchema.safeParse({ type: "tool.paused", sessionId: "s", at }).success).toBe(false);
  });

  test("rejects a timestamp that is not ISO 8601", () => {
    const event = { type: "agent.stopped", sessionId: "s", agentId: "a", at: "yesterday" };
    expect(agentEventSchema.safeParse(event).success).toBe(false);
  });

  test("rejects an empty session id", () => {
    expect(agentEventSchema.safeParse({ type: "agent.stopped", sessionId: "", agentId: "a", at }).success).toBe(false);
  });

  test("ingest rejects an empty batch", () => {
    expect(ingestSchema.safeParse([]).success).toBe(false);
  });
});
