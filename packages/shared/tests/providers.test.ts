import { describe, expect, test } from "bun:test";
import { providerOf } from "../src/providers";

describe("providerOf", () => {
  test("reads the provider from the model", () => {
    expect(providerOf("claude-haiku-5-5", "custom")).toBe("anthropic");
    expect(providerOf("gpt-5.1-codex", undefined)).toBe("openai");
    expect(providerOf("o4-mini", undefined)).toBe("openai");
    expect(providerOf("gemini-3-pro", "claude-code")).toBe("google");
  });

  test("falls back to the harness when the model is unknown or missing", () => {
    expect(providerOf(undefined, "codex")).toBe("openai");
    expect(providerOf("my-finetune", "claude-code")).toBe("anthropic");
  });

  test("is unknown when neither says", () => {
    expect(providerOf(undefined, "custom")).toBe("unknown");
    expect(providerOf("", undefined)).toBe("unknown");
  });
});
