import { z } from "zod";

const id = z.string().min(1).max(200);
const base = { sessionId: id, at: z.iso.datetime({ offset: true }) };

export const agentEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.started"),
    ...base,
    harness: z.string().min(1).max(60),
    title: z.string().max(200).optional(),
    cwd: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal("agent.started"),
    ...base,
    agentId: id,
    name: z.string().min(1).max(120),
    parentToolId: id.optional(),
    parentAgentId: id.optional(),
    model: z.string().max(120).optional(),
  }),
  z.object({ type: z.literal("agent.stopped"), ...base, agentId: id }),
  z.object({
    type: z.literal("tool.started"),
    ...base,
    agentId: id,
    toolId: id,
    name: z.string().min(1).max(120),
    summary: z.string().max(200).optional(),
  }),
  z.object({ type: z.literal("tool.finished"), ...base, toolId: id, ok: z.boolean() }),
  z.object({
    type: z.literal("message"),
    ...base,
    agentId: id,
    role: z.enum(["user", "assistant"]),
    text: z.string().min(1).max(1000),
    model: z.string().max(120).optional(),
  }),
]);

export const ingestSchema = z.union([agentEventSchema, z.array(agentEventSchema).min(1).max(1000)]);

export type AgentEvent = z.infer<typeof agentEventSchema>;
