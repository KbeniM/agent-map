import type { AgentEvent } from "./events";

export type Session = { id: string; harness: string; title: string; cwd?: string; startedAt: string; lastAt: string };
export type Message = { role: "user" | "assistant"; text: string; at: string };
export type Agent = {
  id: string;
  sessionId: string;
  name: string;
  model?: string;
  messages: Message[];
  parentToolId?: string;
  parentAgentId?: string;
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
  // why: keyed by session first, so a live event copies one session's tools instead of every tool ever seen
  tools: Record<string, Record<string, Tool>>;
};

export const emptyGraph = (): Graph => ({ sessions: {}, agents: {}, tools: {} });

export const toolOf = (graph: Graph, sessionId: string, toolId: string): Tool | undefined =>
  graph.tools[sessionId]?.[toolId];

const later = (a: string, b: string) => (a > b ? a : b);
const MESSAGES = 30;

// why: a batch owns the maps it copied, so later events of the same batch write them in place
type Batch = { graph: Graph; owned: Set<object>; spawned?: Map<string, string[]> };

function sessionTools(batch: Batch, sessionId: string) {
  const current = batch.graph.tools[sessionId];
  if (current && batch.owned.has(current)) return current;
  const copy = { ...current };
  batch.owned.add(copy);
  batch.graph.tools[sessionId] = copy;
  return copy;
}

function indexSpawn(spawned: Map<string, string[]>, agent: Agent) {
  if (!agent.parentToolId) return;
  const ids = spawned.get(agent.parentToolId) ?? [];
  if (!ids.includes(agent.id)) spawned.set(agent.parentToolId, [...ids, agent.id]);
}

// why: built once per batch on the first finish, so a replay does not scan every agent per finished tool
function spawnedBy(batch: Batch, toolId: string) {
  if (!batch.spawned) {
    batch.spawned = new Map();
    for (const agent of Object.values(batch.graph.agents)) indexSpawn(batch.spawned, agent);
  }
  return batch.spawned.get(toolId) ?? [];
}

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
    : { id: agentId, sessionId, name: "main", messages: [], startedAt: at, lastAt: at, toolIds: [] };
}

type Handlers = { [T in AgentEvent["type"]]: (batch: Batch, event: Extract<AgentEvent, { type: T }>) => void };

const keepMessages = (messages: Message[]) =>
  messages.length > MESSAGES ? [messages[0], ...messages.slice(-(MESSAGES - 1))] : messages;

const HANDLERS: Handlers = {
  "session.started": ({ graph: next }, event) => {
    const session = next.sessions[event.sessionId];
    next.sessions[event.sessionId] = {
      ...session,
      harness: event.harness,
      title: event.title ?? session.title,
      cwd: event.cwd ?? session.cwd,
      startedAt: [event.at, session.startedAt].sort()[0],
    };
  },
  "agent.started": (batch, event) => {
    const next = batch.graph;
    touchAgent(next, event.sessionId, event.agentId, event.at);
    const agent = next.agents[event.agentId];
    next.agents[event.agentId] = {
      ...agent,
      name: event.name,
      parentToolId: event.parentToolId ?? agent.parentToolId,
      parentAgentId: event.parentAgentId ?? agent.parentAgentId,
      model: event.model ?? agent.model,
    };
    if (batch.spawned) indexSpawn(batch.spawned, next.agents[event.agentId]);
  },
  "agent.stopped": ({ graph: next }, event) => {
    touchAgent(next, event.sessionId, event.agentId, event.at);
    next.agents[event.agentId] = { ...next.agents[event.agentId], stoppedAt: event.at };
  },
  "tool.started": (batch, event) => {
    const next = batch.graph;
    touchAgent(next, event.sessionId, event.agentId, event.at);
    const agent = next.agents[event.agentId];
    const tools = sessionTools(batch, event.sessionId);
    if (!tools[event.toolId]) next.agents[event.agentId] = { ...agent, toolIds: [...agent.toolIds, event.toolId] };
    tools[event.toolId] = {
      ...tools[event.toolId],
      id: event.toolId,
      agentId: event.agentId,
      name: event.name,
      summary: event.summary,
      startedAt: event.at,
    };
  },
  message: ({ graph: next }, event) => {
    touchAgent(next, event.sessionId, event.agentId, event.at);
    const agent = next.agents[event.agentId];
    // shortcut: keeps the first and the latest messages per agent, page through history once someone needs it
    const messages = keepMessages([...agent.messages, { role: event.role, text: event.text, at: event.at }]);
    next.agents[event.agentId] = { ...agent, model: event.model ?? agent.model, messages };
  },
  "tool.finished": (batch, event) => {
    const next = batch.graph;
    const tool = toolOf(next, event.sessionId, event.toolId);
    if (!tool) return;
    sessionTools(batch, event.sessionId)[event.toolId] = { ...tool, finishedAt: event.at, ok: event.ok };
    touchAgent(next, event.sessionId, tool.agentId, event.at);
    for (const id of spawnedBy(batch, event.toolId)) {
      const agent = next.agents[id];
      if (agent?.parentToolId === event.toolId && !agent.stoppedAt) next.agents[id] = { ...agent, stoppedAt: event.at };
    }
  },
};

// why: history replays thousands of events per frame; cloning top-level maps once per batch avoids O(events * nodes) copies
export function applyAll(graph: Graph, events: AgentEvent[]): Graph {
  if (events.length === 0) return graph;
  const batch: Batch = {
    graph: { sessions: { ...graph.sessions }, agents: { ...graph.agents }, tools: { ...graph.tools } },
    owned: new Set(),
  };
  for (const event of events) {
    // why: the main agent of a session shares the session's id, so a harness that only reports tools still draws a tree
    touchSession(batch.graph, event.sessionId, event.at);
    (HANDLERS[event.type] as (batch: Batch, event: AgentEvent) => void)(batch, event);
  }
  return batch.graph;
}

export const apply = (graph: Graph, event: AgentEvent): Graph => applyAll(graph, [event]);

// why: a spawning tool call is the precise parent; harnesses that only know the parent agent name it directly
export const parentOf = (graph: Graph, agent: Agent) =>
  agent.id === agent.sessionId
    ? undefined
    : (toolOf(graph, agent.sessionId, agent.parentToolId ?? "")?.agentId ??
      (agent.parentAgentId && graph.agents[agent.parentAgentId] ? agent.parentAgentId : agent.sessionId));

export function forgetSession(graph: Graph, sessionId: string): Graph {
  const agents = Object.fromEntries(Object.entries(graph.agents).filter(([, agent]) => agent.sessionId !== sessionId));
  const { [sessionId]: _session, ...sessions } = graph.sessions;
  const { [sessionId]: _tools, ...tools } = graph.tools;
  return { sessions, agents, tools };
}

// why: one bridge is the common case, and returning its graph keeps reference equality for memoised readers
export const mergeGraphs = (graphs: Graph[]): Graph =>
  graphs.length === 1
    ? graphs[0]
    : graphs.reduce(
        (merged, graph) => ({
          sessions: { ...merged.sessions, ...graph.sessions },
          agents: { ...merged.agents, ...graph.agents },
          tools: { ...merged.tools, ...graph.tools },
        }),
        emptyGraph(),
      );
