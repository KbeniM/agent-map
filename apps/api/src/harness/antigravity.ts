import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@rancher/shared/events";
import { z } from "zod";
import { type Adapter, type FileSource, InvalidPayload } from "./adapter";
import { clip, handlerFor, isoOf, now, parseOrThrow, summarize, text } from "./pairing";

const name = z.string().min(1).max(60).optional();
const payloadSchema = z.looseObject({
  conversationId: z.string().min(1).max(200),
  hookEvent: name,
  hookEventName: name,
  hook_event_name: name,
  event: name,
  workspacePaths: z.array(text).optional(),
  modelName: z.string().max(120).optional(),
  lastUserInput: text.optional(),
  stepIdx: z.number().optional(),
  error: z.unknown().optional(),
  toolCall: z.looseObject({ name: text.optional(), args: z.record(z.string(), z.unknown()).optional() }).optional(),
});

type Payload = z.infer<typeof payloadSchema>;

const PASCAL_KEYS = ["CommandLine", "AbsolutePath", "TargetFile", "SearchPath", "Query", "Url", "Pattern"];

// why: Antigravity tool args use PascalCase keys that the shared summarize does not know
const summary = (args: Record<string, unknown> | undefined) => {
  const key = PASCAL_KEYS.find((candidate) => typeof args?.[candidate] === "string");
  return (key ? String(args?.[key]).split("\n")[0].slice(0, 120) : undefined) ?? summarize(args);
};

const antigravityParser = () => {
  const lastInput = new Map<string, string>();
  const titled = new Set<string>();

  const toolId = (p: Payload) => (p.stepIdx === undefined ? undefined : `${p.conversationId}:${p.stepIdx}`);

  const handlers: Record<string, (p: Payload, at: string) => AgentEvent[]> = {
    SessionStart: (p, at) => [
      { type: "session.started", sessionId: p.conversationId, at, harness: "antigravity", cwd: p.workspacePaths?.[0] },
      {
        type: "agent.started",
        sessionId: p.conversationId,
        at,
        agentId: p.conversationId,
        name: "main",
        model: p.modelName,
      },
    ],
    PreInvocation: (p, at) => {
      const input = clip(p.lastUserInput, 1000);
      if (!input || lastInput.get(p.conversationId) === input) return [];
      lastInput.set(p.conversationId, input);
      const title = titled.has(p.conversationId) ? undefined : input.split("\n")[0].slice(0, 80);
      titled.add(p.conversationId);
      return [
        ...(title
          ? [
              {
                type: "session.started" as const,
                sessionId: p.conversationId,
                at,
                harness: "antigravity",
                cwd: p.workspacePaths?.[0],
                title,
              },
            ]
          : []),
        { type: "message", sessionId: p.conversationId, at, agentId: p.conversationId, role: "user", text: input },
      ];
    },
    PreToolUse: (p, at) => {
      const id = toolId(p);
      const tool = p.toolCall?.name;
      return id && tool
        ? [
            {
              type: "tool.started",
              sessionId: p.conversationId,
              at,
              agentId: p.conversationId,
              toolId: id,
              name: tool,
              summary: summary(p.toolCall?.args),
            },
          ]
        : [];
    },
    PostToolUse: (p, at) => {
      const id = toolId(p);
      return id ? [{ type: "tool.finished", sessionId: p.conversationId, at, toolId: id, ok: !p.error }] : [];
    },
  };

  return (raw: unknown): AgentEvent[] => {
    const payload = parseOrThrow(payloadSchema, raw, "Invalid hook payload");
    const event = payload.hookEvent ?? payload.hookEventName ?? payload.hook_event_name ?? payload.event;
    if (!event) throw new InvalidPayload("Missing hook event name");
    const handler = handlerFor(handlers, event);
    return handler ? handler(payload, now()) : [];
  };
};

type FileState = { sessionId: string; titled: boolean; pendingTools: string[]; fallbackAt: string };

const stepSchema = z.object({
  step_index: z.number().optional(),
  type: z.string(),
  status: z.string().optional(),
  created_at: z.string().optional(),
  content: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        name: z.string().optional(),
        args: z.record(z.string(), z.unknown()).optional(),
        arguments: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

function cleanPrompt(raw: string | undefined) {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/<t3_code_instructions>[\s\S]*?<\/t3_code_instructions>/gi, "")
    .replace(/<\/?user_request>/gi, "")
    .trim();
  return clip(cleaned, 1000);
}

export function parseAntigravityTranscript(raw: string, state: FileState): AgentEvent[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  const parsed = stepSchema.safeParse(value);
  if (!parsed.success) return [];
  const step = parsed.data;
  const at = step.created_at ? isoOf(step.created_at) : state.fallbackAt;
  const { sessionId } = state;

  if (step.type === "USER_INPUT") {
    const input = cleanPrompt(step.content);
    if (!input) return [];
    const title = state.titled ? undefined : input.split("\n")[0].slice(0, 80);
    state.titled = true;
    return [
      ...(title ? [{ type: "session.started" as const, sessionId, at, harness: "antigravity", title }] : []),
      { type: "message", sessionId, at, agentId: sessionId, role: "user", text: input },
    ];
  }

  if (step.type === "PLANNER_RESPONSE") {
    const events: AgentEvent[] = [];
    if (!state.titled) {
      state.titled = true;
      events.push({ type: "session.started", sessionId, at, harness: "antigravity" });
    }
    const reply = clip(step.content, 1000);
    if (reply) events.push({ type: "message", sessionId, at, agentId: sessionId, role: "assistant", text: reply });
    step.tool_calls?.forEach((call, index) => {
      if (!call.name) return;
      const toolId = `${sessionId}:${step.step_index ?? "s"}:${index}`;
      state.pendingTools.push(toolId);
      events.push({
        type: "tool.started",
        sessionId,
        at,
        agentId: sessionId,
        toolId,
        name: clip(call.name, 120) ?? call.name,
        summary: summary(call.args ?? call.arguments),
      });
    });
    return events;
  }

  const finishedId = state.pendingTools.shift();
  return finishedId && step.status
    ? [{ type: "tool.finished", sessionId, at, toolId: finishedId, ok: step.status !== "ERROR" }]
    : [];
}

const transcripts: FileSource<FileState> = {
  defaultPath: join(homedir(), ".gemini", "antigravity", "brain"),
  globs: ["*/.system_generated/logs/transcript.jsonl"],
  mode: "append",
  open(relative, _absolute, mtime) {
    const sessionId = relative.split("/")[0] || relative;
    return { state: { sessionId, titled: false, pendingTools: [], fallbackAt: mtime.toISOString() } };
  },
  parse: (chunk, state) => chunk.split("\n").flatMap((line) => (line ? parseAntigravityTranscript(line, state) : [])),
};

export const antigravity: Adapter = {
  id: "antigravity",
  name: "Antigravity",
  harness: "antigravity",
  files: transcripts,
  hook: antigravityParser(),
};
