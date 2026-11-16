import type { Agent, Graph, Message, Tool } from "@agent-map/shared/graph";
import { parentOf } from "@agent-map/shared/graph";
import { providerOf } from "@agent-map/shared/providers";
import { PROVIDER_NAMES } from "./icons";

type TimelineEntry = { at: string; tool?: Tool; message?: Message };

export function resolveNode(graph: Graph, id: string) {
  const [type, key] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (type === "tool") {
    const tool = graph.tools[key];
    return tool && { tool, agent: graph.agents[tool.agentId] };
  }
  const agent = graph.agents[key];
  return agent && { agent };
}

export function nodeSubtitle(graph: Graph, agent: Agent) {
  const session = graph.sessions[agent.sessionId];
  if (agent.id === agent.sessionId) return [session?.harness, agent.model, session?.cwd].filter(Boolean).join(" · ");
  const parent = graph.agents[parentOf(graph, agent) ?? ""];
  const of = parent?.id === parent?.sessionId ? (session?.title ?? "main") : parent?.name;
  return [`Subagent of ${of}`, agent.model].filter(Boolean).join(" · ");
}

export function nodeTitle(graph: Graph, agent: Agent, tool?: Tool) {
  if (tool) return tool.name;
  return agent.id === agent.sessionId ? graph.sessions[agent.sessionId]?.title : agent.name;
}

export function agentDetails(graph: Graph, agent: Agent) {
  const isMain = agent.id === agent.sessionId;
  const entries: TimelineEntry[] = [
    ...agent.toolIds.map((toolId) => ({ at: graph.tools[toolId].startedAt, tool: graph.tools[toolId] })),
    ...agent.messages.map((message) => ({ at: message.at, message })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const children = Object.values(graph.agents).filter(
    (other) => other.id !== agent.id && parentOf(graph, other) === agent.id,
  );
  const session = graph.sessions[agent.sessionId];
  const speaker = isMain ? PROVIDER_NAMES[providerOf(agent.model, session?.harness)] : agent.name;
  return { isMain, entries, children, speaker, session };
}
