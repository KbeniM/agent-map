import type { Agent, Graph, Tool } from "./graph";
import { parentOf } from "./graph";
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
export type MapLink = { id: string; type: LinkType; source: string; target: string; live: boolean; label?: string };

export const nodeId = { agent: (id: string) => `agent:${id}`, tool: (id: string) => `tool:${id}` };

export type MapOptions = { toolsPerAgent: number; liveMs: number };
const DEFAULTS: MapOptions = { toolsPerAgent: 8, liveMs: 30_000 };

// why: a running subagent's link shows the task it was given, a finished one shows its answer
function spawnLabel(agent: Agent) {
  const prompt = agent.messages.find((message) => message.role === "user");
  const answer = agent.messages.findLast((message) => message.role === "assistant");
  return (agent.stoppedAt ? answer : prompt)?.text ?? prompt?.text;
}

function agentNode(graph: Graph, agent: Agent, now: number, liveMs: number): MapNode {
  const isMain = agent.id === agent.sessionId;
  const session = graph.sessions[agent.sessionId];
  const running = agent.toolIds.some((toolId) => !graph.tools[toolId].finishedAt);
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
        label: spawnLabel(agent),
      });
    }
    const tools = agent.toolIds.map((toolId) => graph.tools[toolId]).filter((tool) => !spawning.has(tool.id));
    for (const tool of toolsPerAgent > 0 ? tools.slice(-toolsPerAgent) : []) {
      const [toolNode, link] = toolEntries(tool, agent, node.harness);
      nodes.push(toolNode);
      links.push(link);
    }
  }
  return { nodes, links };
}
