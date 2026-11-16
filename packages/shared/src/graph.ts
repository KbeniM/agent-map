import type { AgentEvent } from "./events";

export type Session = { id: string; harness: string; title: string; cwd?: string; startedAt: string; lastAt: string };
export type Agent = {
  id: string;
  sessionId: string;
  name: string;
  parentToolId?: string;
  startedAt: string;
  lastAt: string;
  stoppedAt?: string;
  toolIds: string[];
};
export type Tool = {
  id: string;
  agentId: string;
  name: string;
  summary?: string;
  startedAt: string;
  finishedAt?: string;
  ok?: boolean;
};
export type Graph = {
  sessions: Record<string, Session>;
  agents: Record<string, Agent>;
  tools: Record<string, Tool>;
};

export const emptyGraph = (): Graph => ({ sessions: {}, agents: {}, tools: {} });

const later = (a: string, b: string) => (a > b ? a : b);

function touchSession(graph: Graph, sessionId: string, at: string) {
  const session = graph.sessions[sessionId];
  graph.sessions[sessionId] = session
    ? { ...session, lastAt: later(session.lastAt, at) }
    : { id: sessionId, harness: "unknown", title: sessionId.slice(0, 8), startedAt: at, lastAt: at };
  touchAgent(graph, sessionId, sessionId, at);
}

function touchAgent(graph: Graph, sessionId: string, agentId: string, at: string) {
  const agent = graph.agents[agentId];
  graph.agents[agentId] = agent
    ? { ...agent, lastAt: later(agent.lastAt, at) }
    : { id: agentId, sessionId, name: "main", startedAt: at, lastAt: at, toolIds: [] };
}

// why: the main agent of a session shares the session's id, so a harness that only reports tools still draws a tree
export function apply(graph: Graph, event: AgentEvent): Graph {
  const next: Graph = { sessions: { ...graph.sessions }, agents: { ...graph.agents }, tools: { ...graph.tools } };
  touchSession(next, event.sessionId, event.at);
  switch (event.type) {
    case "session.started": {
      const session = next.sessions[event.sessionId];
      next.sessions[event.sessionId] = {
        ...session,
        harness: event.harness,
        title: event.title ?? session.title,
        cwd: event.cwd ?? session.cwd,
        startedAt: [event.at, session.startedAt].sort()[0],
      };
      break;
    }
    case "agent.started":
      touchAgent(next, event.sessionId, event.agentId, event.at);
      next.agents[event.agentId] = {
        ...next.agents[event.agentId],
        name: event.name,
        parentToolId: event.parentToolId,
      };
      break;
    case "agent.stopped":
      touchAgent(next, event.sessionId, event.agentId, event.at);
      next.agents[event.agentId] = { ...next.agents[event.agentId], stoppedAt: event.at };
      break;
    case "tool.started": {
      touchAgent(next, event.sessionId, event.agentId, event.at);
      const agent = next.agents[event.agentId];
      if (!next.tools[event.toolId])
        next.agents[event.agentId] = { ...agent, toolIds: [...agent.toolIds, event.toolId] };
      next.tools[event.toolId] = {
        ...next.tools[event.toolId],
        id: event.toolId,
        agentId: event.agentId,
        name: event.name,
        summary: event.summary,
        startedAt: event.at,
      };
      break;
    }
    case "tool.finished": {
      const tool = next.tools[event.toolId];
      if (!tool) break;
      next.tools[event.toolId] = { ...tool, finishedAt: event.at, ok: event.ok };
      touchAgent(next, event.sessionId, tool.agentId, event.at);
      for (const agent of Object.values(next.agents)) {
        if (agent.parentToolId === event.toolId && !agent.stoppedAt) {
          next.agents[agent.id] = { ...agent, stoppedAt: event.at };
        }
      }
      break;
    }
  }
  return next;
}

export const applyAll = (graph: Graph, events: AgentEvent[]) => events.reduce(apply, graph);

export const parentOf = (graph: Graph, agent: Agent) =>
  agent.id === agent.sessionId ? undefined : (graph.tools[agent.parentToolId ?? ""]?.agentId ?? agent.sessionId);
