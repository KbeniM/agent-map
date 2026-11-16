import { z } from "zod";
import { InvalidPayload } from "./adapter";

export const text = z.string().max(100_000);

// why: Claude Code, Codex and Gemini CLI hooks open with the same three fields
export const hookShape = {
  session_id: z.string().min(1).max(200),
  hook_event_name: z.string().min(1).max(60),
  cwd: text.optional(),
};

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown, fallback: string): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new InvalidPayload(result.error.issues[0]?.message ?? fallback);
  return result.data;
}

export const handlerFor = <H>(handlers: Record<string, H>, name: string): H | undefined =>
  Object.hasOwn(handlers, name) ? handlers[name] : undefined;

export const isoOf = (value: string | number | undefined) => {
  const date = value === undefined ? undefined : new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : now();
};

// why: harnesses whose hooks carry no tool call id are paired first-in, first-out per session and tool name
export function fifoPairing() {
  const open = new Map<string, string[]>();
  let counter = 0;
  return {
    start(sessionId: string, tool: string) {
      const id = `${sessionId}:${tool}:${++counter}`;
      const key = `${sessionId}\u0000${tool}`;
      open.set(key, [...(open.get(key) ?? []), id]);
      return id;
    },
    finish(sessionId: string, tool: string) {
      const queue = open.get(`${sessionId}\u0000${tool}`);
      return queue?.shift();
    },
  };
}

export const now = () => new Date().toISOString();

export const clip = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

const SUMMARY_KEYS = ["description", "file_path", "pattern", "command", "url", "query", "prompt", "skill"];

// why: only one short field of the tool input leaves the bridge, never the full input or output
export function summarize(input: Record<string, unknown> | undefined) {
  const key = SUMMARY_KEYS.find((name) => typeof input?.[name] === "string");
  const value = key ? String(input?.[key]) : undefined;
  return value?.split("\n")[0].slice(0, 120);
}
