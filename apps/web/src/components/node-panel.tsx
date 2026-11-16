import type { Agent, Graph, Message, Tool } from "@agent-map/shared/graph";
import { nodeId } from "@agent-map/shared/layout";
import { providerOf } from "@agent-map/shared/providers";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { ProviderIcon, ToolIcon } from "@/components/icons";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { client, unwrap } from "@/lib/api";
import { agentDetails, nodeSubtitle, nodeTitle, resolveNode } from "@/lib/inspector";
import { duration, useNow } from "@/lib/time";
import { useGraph, useSessionBridge } from "@/stores/graph";
import { usePreferences } from "@/stores/preferences";

function ToolRow({ tool, now }: { tool: Tool; now: number }) {
  return (
    <li className="flex items-start gap-2.5 px-4 py-1.5">
      <ToolIcon name={tool.name} className={cn("mt-0.5", !tool.finishedAt && "text-live")} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-caption font-mono font-medium">{tool.name}</span>
        {tool.summary && <span className="type-caption break-words text-muted-foreground">{tool.summary}</span>}
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

function MessageRow({ message, from }: { message: Message; from: string }) {
  return (
    <li className="mx-3 my-1.5 rounded-xl border border-border/50 bg-secondary/45 px-3 py-2">
      <span className="type-micro text-muted-foreground">{from}</span>
      <p className="type-body mt-0.5 wrap-anywhere whitespace-pre-line">{message.text}</p>
    </li>
  );
}

function RemoveSession({ sessionId }: { sessionId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string>();
  const bridgeOf = useSessionBridge();
  const bridges = usePreferences((state) => state.bridges);
  const navigate = useNavigate();
  const bridge = bridges.find((candidate) => candidate.id === bridgeOf(sessionId));
  if (!bridge) return null;
  const remove = async () => {
    try {
      await unwrap(client(bridge).v1.sessions[":id"].$delete({ param: { id: sessionId } }));
      void navigate({ to: "/", search: {} });
    } catch (error) {
      setFailure((error as Error).message);
    }
  };
  return (
    <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
      {confirming ? (
        <>
          <span className="type-caption flex-1 text-muted-foreground">
            Remove this session and its history from {bridge.name}? It cannot be restored.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={remove}>
            Remove session
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
          Remove session
        </Button>
      )}
      {failure && <span className="type-caption text-destructive">{failure}</span>}
    </div>
  );
}

function ToolDetail({ tool, agent, now }: { tool: Tool; agent: Agent; now: number }) {
  const outcome = tool.ok === false ? "Failed" : "Finished";
  return (
    <p className="type-body px-4 pb-4 text-muted-foreground">
      {tool.finishedAt
        ? `${outcome} in ${duration(tool.startedAt, tool.finishedAt, now)}`
        : `Running for ${duration(tool.startedAt, undefined, now)}`}{" "}
      in{" "}
      <Link to="/" search={{ node: nodeId.agent(agent.id) }} className="font-medium text-foreground hover:underline">
        {agent.id === agent.sessionId ? "main" : agent.name}
      </Link>
    </p>
  );
}

function AgentDetail({ graph, agent, now }: { graph: Graph; agent: Agent; now: number }) {
  const { isMain, entries, children, speaker, session } = agentDetails(graph, agent);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {children.length > 0 && (
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {children.map((child) => (
            <li key={child.id}>
              <Link
                to="/"
                search={{ node: nodeId.agent(child.id) }}
                className="type-body flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-accent/60"
              >
                <ProviderIcon provider={providerOf(child.model, session?.harness)} className="size-3.5" />
                <span className="flex-1 truncate font-medium">{child.name}</span>
                <span className="type-micro tabular-nums text-muted-foreground">
                  {child.toolIds.length} {child.toolIds.length === 1 ? "tool" : "tools"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <h3 className="type-micro border-t border-border/70 px-4 pt-3 pb-1 text-muted-foreground">Activity</h3>
      <ul className="pb-3">
        {entries
          .slice(0, 80)
          .map((entry) =>
            entry.tool ? (
              <ToolRow key={entry.tool.id} tool={entry.tool} now={now} />
            ) : (
              <MessageRow
                key={`${entry.at}${entry.message?.text.slice(0, 20)}`}
                message={entry.message as Message}
                from={entry.message?.role === "assistant" ? speaker : isMain ? "You" : "Task"}
              />
            ),
          )}
      </ul>
    </div>
  );
}

export function NodePanel({ id }: { id: string }) {
  const graph = useGraph();
  const now = useNow(1000);
  const found = resolveNode(graph, id);
  if (!found?.agent) return null;
  const { agent, tool } = found;
  const provider = providerOf(agent.model, graph.sessions[agent.sessionId]?.harness);

  return (
    <Panel side="right" label="Details">
      <div className="flex items-start gap-2.5 px-4 pt-4 pb-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/75">
          {tool ? (
            <ToolIcon name={tool.name} className="size-4" />
          ) : (
            <ProviderIcon provider={provider} className="size-4.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="type-title break-words text-balance">{nodeTitle(graph, agent, tool)}</h2>
          <p className="type-caption mt-0.5 break-words text-muted-foreground">
            {tool ? (tool.summary ?? agent.name) : nodeSubtitle(graph, agent)}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon-sm" aria-label="Close">
          <Link to="/" search={{}}>
            <HugeiconsIcon icon={Cancel01Icon} />
          </Link>
        </Button>
      </div>
      {tool ? (
        <ToolDetail tool={tool} agent={agent} now={now} />
      ) : (
        <AgentDetail graph={graph} agent={agent} now={now} />
      )}
      {!tool && agent.id === agent.sessionId && <RemoveSession sessionId={agent.sessionId} />}
    </Panel>
  );
}
