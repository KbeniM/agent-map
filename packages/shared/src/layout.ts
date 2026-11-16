import type { Agent, Graph } from "./graph";
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
};
export type LinkType = "spawn" | "tool";
export type MapLink = { id: string; type: LinkType; source: string; target: string; live: boolean; label?: string };

export const nodeId = { agent: (id: string) => `agent:${id}`, tool: (id: string) => `tool:${id}` };

const LIVE_MS = 30_000;

// why: a running subagent's link shows the task it was given, a finished one shows its answer
function spawnLabel(agent: Agent) {
  const prompt = agent.messages.find((message) => message.role === "user");
  const answer = agent.messages.findLast((message) => message.role === "assistant");
  return (agent.stoppedAt ? answer : prompt)?.text ?? prompt?.text;
}

// shortcut: only the latest tools per agent are drawn, page through history once someone needs it
export function toMap(graph: Graph, now: number, toolsPerAgent = 8): { nodes: MapNode[]; links: MapLink[] } {
  const nodes: MapNode[] = [];
  const links: MapLink[] = [];
  const spawning = new Set(Object.values(graph.agents).map((agent) => agent.parentToolId));

  for (const agent of Object.values(graph.agents)) {
    const id = nodeId.agent(agent.id);
    const isMain = agent.id === agent.sessionId;
    const session = graph.sessions[agent.sessionId];
    const tools = agent.toolIds.map((toolId) => graph.tools[toolId]);
    const running = tools.some((tool) => !tool.finishedAt);
    nodes.push({
      id,
      type: isMain ? "session" : "agent",
      label: isMain ? (session?.title ?? agent.name) : agent.name,
      sessionId: agent.sessionId,
      live: !agent.stoppedAt && (running || now - Date.parse(agent.lastAt) < LIVE_MS),
      provider: providerOf(agent.model, session?.harness),
    });
    const parent = parentOf(graph, agent);
    if (parent) {
      links.push({
        id: `${parent}>${agent.id}`,
        type: "spawn",
        source: nodeId.agent(parent),
        target: id,
        live: !agent.stoppedAt,
        label: spawnLabel(agent),
      });
    }
    for (const tool of tools.filter((tool) => !spawning.has(tool.id)).slice(-toolsPerAgent)) {
      const live = !tool.finishedAt;
      nodes.push({
        id: nodeId.tool(tool.id),
        type: "tool",
        label: tool.name,
        sessionId: agent.sessionId,
        live,
        ok: tool.ok,
      });
      links.push({
        id: `${agent.id}>${tool.id}`,
        type: "tool",
        source: id,
        target: nodeId.tool(tool.id),
        live,
        label: tool.summary ? `${tool.name} · ${tool.summary}` : tool.name,
      });
    }
  }
  return { nodes, links };
}
