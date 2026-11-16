import { nodeId } from "@agent-map/shared/layout";
import { providerOf } from "@agent-map/shared/providers";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { useMemo } from "react";
import { sessionColour } from "@/components/graph/colour";
import { ProviderIcon } from "@/components/icons";
import { Panel } from "@/components/panel";
import { ago, useNow } from "@/lib/time";
import { useGraph } from "@/stores/graph";
import { usePreferences } from "@/stores/preferences";

const LIVE_MS = 30_000;

export function SessionsPanel({ selected }: { selected?: string }) {
  const graph = useGraph((state) => state.graph);
  const connection = useGraph((state) => state.connection);
  const url = usePreferences((state) => state.url);
  const now = useNow(5000);

  const sessions = useMemo(() => {
    const agents = Object.values(graph.agents);
    return Object.values(graph.sessions)
      .map((session) => {
        const own = agents.filter((agent) => agent.sessionId === session.id);
        return {
          ...session,
          provider: providerOf(graph.agents[session.id]?.model, session.harness),
          agents: own.length - 1,
          tools: own.reduce((sum, agent) => sum + agent.toolIds.length, 0),
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [graph]);

  return (
    <Panel side="left" label="Sessions">
      <h2 className="type-caption px-5 pt-4 pb-2 text-muted-foreground">
        {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
      </h2>
      {sessions.length === 0 ? (
        <p className="type-body px-5 text-muted-foreground">
          {connection === "open" ? (
            <>
              No activity yet. Start Claude Code, or send events from any harness.{" "}
              <Link to="/connect" className="text-foreground underline underline-offset-4">
                Connect
              </Link>
            </>
          ) : (
            <>
              Waiting for the bridge at <span className="font-mono text-foreground">{url}</span>. Run{" "}
              <span className="font-mono text-foreground">bun run dev</span>.
            </>
          )}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ul className="px-2 pb-2">
            {sessions.map((session) => {
              const id = nodeId.agent(session.id);
              const live = now - Date.parse(session.lastAt) < LIVE_MS;
              return (
                <li key={session.id}>
                  <Link
                    to="/"
                    search={{ node: id }}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-2xl px-3 py-2.5 transition-colors hover:bg-secondary/60 active:scale-[0.99]",
                      selected === id && "bg-secondary",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ProviderIcon provider={session.provider} />
                      <span className="type-body truncate font-medium">{session.title}</span>
                      <span
                        aria-hidden
                        className="ml-auto size-1.5 shrink-0 rounded-full"
                        style={{ background: sessionColour(session.id) }}
                      />
                    </span>
                    <span className="type-caption pl-6 text-muted-foreground">
                      {session.agents > 0 && `${session.agents} ${session.agents === 1 ? "subagent" : "subagents"} · `}
                      {session.tools} tools ·{" "}
                      {live ? <span className="text-live">now</span> : `${ago(session.lastAt, now)} ago`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}
