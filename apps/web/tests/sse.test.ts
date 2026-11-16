import { describe, expect, test } from "bun:test";
import { backoff, parseBlocks } from "../src/lib/sse";

describe("parseBlocks", () => {
  test("splits complete messages and keeps the partial rest", () => {
    const { messages, rest } = parseBlocks('id: a:1\ndata: {"x":1}\n\nevent: reset\ndata: abc\n\nid: a:2\ndata: {');
    expect(messages).toEqual([
      { id: "a:1", event: "message", data: '{"x":1}' },
      { event: "reset", data: "abc" },
    ]);
    expect(rest).toBe("id: a:2\ndata: {");
  });

  test("joins multi-line data and skips comments", () => {
    expect(parseBlocks(": keepalive\ndata: one\ndata: two\n\n").messages).toEqual([
      { event: "message", data: "one\ntwo" },
    ]);
  });

  test("keeps named events without data", () => {
    expect(parseBlocks("event: ping\ndata:\n\n").messages).toEqual([{ event: "ping", data: "" }]);
  });

  test("ignores empty blocks", () => {
    expect(parseBlocks("\n\n\n\n").messages).toEqual([]);
  });
});

describe("backoff", () => {
  test("doubles up to thirty seconds", () => {
    expect([0, 1, 2, 10].map(backoff)).toEqual([1000, 2000, 4000, 30_000]);
  });
});
