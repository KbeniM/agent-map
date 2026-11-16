import type { Agent, Graph, Message, Tool } from "@rancher/shared/graph";
import { parentOf, toolOf } from "@rancher/shared/graph";
import { providerOf } from "@rancher/shared/providers";
import { PROVIDER_NAMES } from "./icons";

const agentTools = (graph: Graph, agent: Agent) =>
  agent.toolIds.map((id) => toolOf(graph, agent.sessionId, id)).filter((tool): tool is Tool => Boolean(tool));

type TimelineEntry = { at: string; tool?: Tool; message?: Message };
export type ToolSummary = { name: string; total: number; running: number; failed: number };

export function resolveNode(graph: Graph, id: string) {
  const [type, key] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (type === "tool") {
    const tool = Object.values(graph.tools).find((tools) => tools[key])?.[key];
    return tool && { tool, agent: graph.agents[tool.agentId] };
  }
  const agent = graph.agents[key];
  return agent && { agent };
}

export function nodeSubtitle(graph: Graph, agent: Agent): string[] {
  const session = graph.sessions[agent.sessionId];
  if (agent.id === agent.sessionId) {
    return [session?.harness, agent.model, session?.cwd].filter((value): value is string => Boolean(value));
  }
  const parent = graph.agents[parentOf(graph, agent) ?? ""];
  const of = parent?.id === parent?.sessionId ? (session?.title ?? "main") : parent?.name;
  return [`Subagent of ${of}`, agent.model].filter((value): value is string => Boolean(value));
}

export function nodeTitle(graph: Graph, agent: Agent, tool?: Tool) {
  if (tool) return tool.name;
  return agent.id === agent.sessionId ? graph.sessions[agent.sessionId]?.title : agent.name;
}

export function agentDetails(graph: Graph, agent: Agent) {
  const isMain = agent.id === agent.sessionId;
  const entries: TimelineEntry[] = [
    ...agentTools(graph, agent).map((tool) => ({ at: tool.startedAt, tool })),
    ...agent.messages.map((message) => ({ at: message.at, message })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const counts = new Map<string, ToolSummary>();
  let errorCount = 0;
  for (const toolId of agent.toolIds) {
    const tool = toolOf(graph, agent.sessionId, toolId);
    if (!tool) continue;
    const item = counts.get(tool.name) ?? { name: tool.name, total: 0, running: 0, failed: 0 };
    item.total += 1;
    if (!tool.finishedAt) item.running += 1;
    if (tool.ok === false) {
      item.failed += 1;
      errorCount += 1;
    }
    counts.set(tool.name, item);
  }
  const toolSummary = [...counts.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const children = Object.values(graph.agents).filter(
    (other) => other.id !== agent.id && parentOf(graph, other) === agent.id,
  );
  const parentId = parentOf(graph, agent);
  const parent = parentId ? graph.agents[parentId] : undefined;
  const session = graph.sessions[agent.sessionId];
  const speaker = isMain ? PROVIDER_NAMES[providerOf(agent.model, session?.harness)] : agent.name;
  return { isMain, entries, children, speaker, session, parent, errorCount, toolSummary };
}

export function agentTrace(graph: Graph, agent: Agent) {
  const session = graph.sessions[agent.sessionId];
  const tools = agentTools(graph, agent);
  return { session, agent, tools };
}
