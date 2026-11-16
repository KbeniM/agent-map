import type { Agent, Graph, Tool } from "@agent-map/shared/graph";
import { parentOf } from "@agent-map/shared/graph";
import { nodeId } from "@agent-map/shared/layout";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { X } from "lucide-react";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { duration, useNow } from "@/lib/time";
import { useGraph } from "@/stores/graph";

function resolve(graph: Graph, id: string) {
  const [type, key] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (type === "tool") {
    const tool = graph.tools[key];
    return tool && { tool, agent: graph.agents[tool.agentId] };
  }
  const agent = graph.agents[key];
  return agent && { agent };
}

function ToolRow({ tool, now }: { tool: Tool; now: number }) {
  return (
    <li className="flex items-baseline gap-3 px-5 py-1.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-caption font-mono">{tool.name}</span>
        {tool.summary && <span className="type-micro truncate text-muted-foreground">{tool.summary}</span>}
      </span>
      <span
        className={cn(
          "type-micro shrink-0 tabular-nums text-muted-foreground",
          !tool.finishedAt && "text-live",
          tool.ok === false && "text-destructive",
        )}
      >
        {tool.finishedAt ? duration(tool.startedAt, tool.finishedAt, now) : "running"}
      </span>
    </li>
  );
}

function subtitle(graph: Graph, agent: Agent) {
  const session = graph.sessions[agent.sessionId];
  if (agent.id === agent.sessionId) return [session?.harness, session?.cwd].filter(Boolean).join(" · ");
  const parent = graph.agents[parentOf(graph, agent) ?? ""];
  return `Subagent of ${parent?.id === parent?.sessionId ? (session?.title ?? "main") : parent?.name}`;
}

function titleOf(graph: Graph, agent: Agent, tool?: Tool) {
  if (tool) return tool.name;
  return agent.id === agent.sessionId ? graph.sessions[agent.sessionId]?.title : agent.name;
}

function ToolDetail({ tool, agent, now }: { tool: Tool; agent: Agent; now: number }) {
  const outcome = tool.ok === false ? "Failed" : "Finished";
  return (
    <p className="type-body px-5 pb-4 text-muted-foreground">
      {tool.finishedAt
        ? `${outcome} in ${duration(tool.startedAt, tool.finishedAt, now)}`
        : `Running for ${duration(tool.startedAt, undefined, now)}`}{" "}
      in{" "}
      <Link to="/" search={{ node: nodeId.agent(agent.id) }} className="text-foreground">
        {agent.id === agent.sessionId ? "main" : agent.name}
      </Link>
    </p>
  );
}

function AgentDetail({ graph, agent, now }: { graph: Graph; agent: Agent; now: number }) {
  const tools = agent.toolIds.map((toolId) => graph.tools[toolId]).reverse();
  const children = Object.values(graph.agents).filter(
    (other) => other.id !== agent.id && parentOf(graph, other) === agent.id,
  );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {children.length > 0 && (
        <ul className="pb-2">
          {children.map((child) => (
            <li key={child.id}>
              <Link
                to="/"
                search={{ node: nodeId.agent(child.id) }}
                className="type-body flex justify-between px-5 py-1.5 hover:bg-secondary/60"
              >
                <span>{child.name}</span>
                <span className="type-micro text-muted-foreground">{child.toolIds.length} tools</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <h3 className="type-micro px-5 pt-2 pb-1 text-muted-foreground uppercase">Tool calls</h3>
      <ul className="pb-3">
        {tools.slice(0, 50).map((call) => (
          <ToolRow key={call.id} tool={call} now={now} />
        ))}
      </ul>
    </div>
  );
}

export function NodePanel({ id }: { id: string }) {
  const graph = useGraph((state) => state.graph);
  const now = useNow(1000);
  const found = resolve(graph, id);
  if (!found?.agent) return null;
  const { agent, tool } = found;

  return (
    <Panel side="right" label="Details">
      <div className="flex items-start gap-2 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="type-title truncate">{titleOf(graph, agent, tool)}</h2>
          <p className="type-caption truncate text-muted-foreground">
            {tool ? (tool.summary ?? agent.name) : subtitle(graph, agent)}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon-sm" aria-label="Close">
          <Link to="/" search={{}}>
            <X />
          </Link>
        </Button>
      </div>
      {tool ? (
        <ToolDetail tool={tool} agent={agent} now={now} />
      ) : (
        <AgentDetail graph={graph} agent={agent} now={now} />
      )}
    </Panel>
  );
}
