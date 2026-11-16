import type { Agent, Graph, Tool } from "./graph";
import { parentOf, toolOf } from "./graph";
import { type Provider, providerOf } from "./providers";

export type NodeType = "session" | "agent" | "tool";
export type MapNode = {
  id: string;
  type: NodeType;
  label: string;
  sessionId: string;
  live: boolean;
  ok?: boolean;
  provider?: Provider;
  harness: string;
};
export type LinkType = "spawn" | "tool";
export type MapLink = {
  id: string;
  type: LinkType;
  source: string;
  target: string;
  live: boolean;
  label?: string;
  labelAt?: string;
};

export const nodeId = { agent: (id: string) => `agent:${id}`, tool: (id: string) => `tool:${id}` };

export type MapOptions = { toolsPerAgent: number; liveMs: number };
const DEFAULTS: MapOptions = { toolsPerAgent: 8, liveMs: 30_000 };

// why: spawn link labels flash the latest message exchanged with the subagent
function spawnLabel(agent: Agent) {
  const message = agent.messages.at(-1);
  return message ? { label: message.text, labelAt: message.at } : {};
}

function agentNode(graph: Graph, agent: Agent, now: number, liveMs: number): MapNode {
  const isMain = agent.id === agent.sessionId;
  const session = graph.sessions[agent.sessionId];
  const tools = graph.tools[agent.sessionId] ?? {};
  const running = agent.toolIds.some((toolId) => !tools[toolId]?.finishedAt);
  return {
    id: nodeId.agent(agent.id),
    type: isMain ? "session" : "agent",
    label: isMain ? (session?.title ?? agent.name) : agent.name,
    sessionId: agent.sessionId,
    live: !agent.stoppedAt && (running || now - Date.parse(agent.lastAt) < liveMs),
    provider: providerOf(agent.model, session?.harness),
    harness: session?.harness ?? "unknown",
  };
}

function toolEntries(tool: Tool, agent: Agent, harness: string): [MapNode, MapLink] {
  const live = !tool.finishedAt;
  const id = nodeId.tool(tool.id);
  return [
    { id, type: "tool", label: tool.name, sessionId: agent.sessionId, live, ok: tool.ok, harness },
    {
      id: `${agent.id}>${tool.id}`,
      type: "tool",
      source: nodeId.agent(agent.id),
      target: id,
      live,
      label: tool.summary ? `${tool.name} · ${tool.summary}` : tool.name,
    },
  ];
}

// shortcut: only the latest tools per agent are drawn, page through history once someone needs it
export function toMap(
  graph: Graph,
  now: number,
  options: Partial<MapOptions> = {},
): { nodes: MapNode[]; links: MapLink[] } {
  const { toolsPerAgent, liveMs } = { ...DEFAULTS, ...options };
  const nodes: MapNode[] = [];
  const links: MapLink[] = [];
  const spawning = new Set(Object.values(graph.agents).map((agent) => agent.parentToolId));

  for (const agent of Object.values(graph.agents)) {
    const node = agentNode(graph, agent, now, liveMs);
    nodes.push(node);
    const parent = parentOf(graph, agent);
    if (parent) {
      const live = !agent.stoppedAt;
      links.push({
        id: `${parent}>${agent.id}`,
        type: "spawn",
        source: nodeId.agent(parent),
        target: node.id,
        live,
        ...spawnLabel(agent),
      });
    }
    const latest: Tool[] = [];
    for (let i = agent.toolIds.length - 1; i >= 0 && latest.length < toolsPerAgent; i--) {
      const tool = toolOf(graph, agent.sessionId, agent.toolIds[i]);
      if (tool && !spawning.has(tool.id)) latest.unshift(tool);
    }
    for (const tool of latest) {
      const [toolNode, link] = toolEntries(tool, agent, node.harness);
      nodes.push(toolNode);
      links.push(link);
    }
  }
  return { nodes, links };
}
