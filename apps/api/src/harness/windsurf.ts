import type { AgentEvent } from "@agent-map/shared/events";
import { z } from "zod";
import type { Adapter } from "./adapter";
import { clip, fifoPairing, isoOf, parseOrThrow, text } from "./pairing";

const payloadSchema = z.looseObject({
  agent_action_name: z.string().min(1).max(60),
  trajectory_id: z.string().min(1).max(200),
  timestamp: z.string().max(60).optional(),
  model_name: text.optional(),
  tool_info: z
    .looseObject({
      file_path: text.optional(),
      command_line: text.optional(),
      mcp_tool_name: text.optional(),
      user_prompt: text.optional(),
      response: text.optional(),
    })
    .optional(),
});

type Info = NonNullable<z.infer<typeof payloadSchema>["tool_info"]>;
type Tool = { name: string; summary: (info: Info) => string | undefined };

const TOOLS: Record<string, Tool> = {
  read_code: { name: "Read", summary: (info) => info.file_path },
  write_code: { name: "Edit", summary: (info) => info.file_path },
  run_command: { name: "Bash", summary: (info) => info.command_line?.split("\n")[0] },
  mcp_tool_use: { name: "mcp", summary: () => undefined },
};

type Ctx = { sessionId: string; at: string; info: Info; model: string | undefined };

// shortcut: the titled set grows with every trajectory until restart, evict when memory matters
const titled = new Set<string>();
const pairing = fifoPairing();

const onPrompt = ({ sessionId, at, info }: Ctx): AgentEvent[] => {
  const body = clip(info.user_prompt, 1000);
  if (!body) return [];
  const first: AgentEvent[] = titled.has(sessionId)
    ? []
    : [{ type: "session.started", sessionId, at, harness: "windsurf", title: body.slice(0, 80) }];
  titled.add(sessionId);
  return [...first, { type: "message", sessionId, at, agentId: sessionId, role: "user", text: body }];
};

const onResponse = ({ sessionId, at, info, model }: Ctx): AgentEvent[] => {
  const body = clip(info.response, 1000);
  return body ? [{ type: "message", sessionId, at, agentId: sessionId, role: "assistant", text: body, model }] : [];
};

const onTool = (action: string, { sessionId, at, info }: Ctx): AgentEvent[] => {
  const phase = /^(pre|post)_(.+)$/.exec(action);
  const tool = phase && TOOLS[phase[2]];
  if (!phase || !tool) return [];
  if (phase[1] === "post") {
    const toolId = pairing.finish(sessionId, phase[2]);
    return toolId ? [{ type: "tool.finished", sessionId, at, toolId, ok: true }] : [];
  }
  const name = phase[2] === "mcp_tool_use" ? (clip(info.mcp_tool_name, 120) ?? tool.name) : tool.name;
  const toolId = pairing.start(sessionId, phase[2]);
  return [
    {
      type: "tool.started",
      sessionId,
      at,
      agentId: sessionId,
      toolId,
      name,
      summary: tool.summary(info)?.slice(0, 120),
    },
  ];
};

export const windsurf: Adapter = {
  id: "windsurf",
  name: "Windsurf",
  harness: "windsurf",
  hook(raw) {
    const data = parseOrThrow(payloadSchema, raw, "Invalid Windsurf hook payload");
    const ctx = {
      sessionId: data.trajectory_id,
      at: isoOf(data.timestamp),
      info: data.tool_info ?? {},
      model: data.model_name,
    };
    const action = data.agent_action_name;
    if (action === "pre_user_prompt") return onPrompt(ctx);
    if (action === "post_cascade_response") return onResponse(ctx);
    return onTool(action, ctx);
  },
};
