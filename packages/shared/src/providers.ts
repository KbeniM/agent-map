export type Provider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek"
  | "mistral"
  | "meta"
  | "qwen"
  | "moonshot"
  | "cursor"
  | "unknown";

const BY_MODEL: [RegExp, Provider][] = [
  [/claude|opus|sonnet|haiku|fable/i, "anthropic"],
  [/gpt|^o\d|codex/i, "openai"],
  [/gemini|gemma/i, "google"],
  [/grok/i, "xai"],
  [/deepseek/i, "deepseek"],
  [/mistral|codestral|devstral|magistral/i, "mistral"],
  [/llama/i, "meta"],
  [/qwen/i, "qwen"],
  [/kimi|moonshot/i, "moonshot"],
];

const BY_HARNESS: Record<string, Provider> = {
  "claude-code": "anthropic",
  codex: "openai",
  "gemini-cli": "google",
  cursor: "cursor",
};

export function providerOf(model: string | undefined, harness: string | undefined): Provider {
  const match = model && BY_MODEL.find(([pattern]) => pattern.test(model));
  return match ? match[1] : (BY_HARNESS[harness ?? ""] ?? "unknown");
}
