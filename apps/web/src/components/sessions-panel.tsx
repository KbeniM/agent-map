import { nodeId } from "@agent-map/shared/layout";
import { providerOf } from "@agent-map/shared/providers";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { useMemo } from "react";
import { sessionColour } from "@/components/graph/colour";
import { ProviderIcon } from "@/components/icons";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ago } from "@/lib/time";
import { useVisibleGraph } from "@/lib/visible";
import { useGraph, useGraphs } from "@/stores/graph";
import { usePreferences } from "@/stores/preferences";

function FilterBar({ harnesses }: { harnesses: string[] }) {
  const { filters, setFilters } = usePreferences();
  return (
    <div className="flex flex-col gap-2 px-3.5 pt-3.5 pb-2.5">
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search sessions"
          placeholder="Title, folder or harness"
          value={filters.query}
          onChange={(event) => setFilters({ query: event.target.value })}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <Select value={filters.harness} onValueChange={(harness) => setFilters({ harness })}>
          <SelectTrigger size="sm" aria-label="Harness" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All harnesses</SelectItem>
            {harnesses.map((harness) => (
              <SelectItem key={harness} value={harness}>
                {harness}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="type-caption flex items-center gap-2 rounded-lg px-1.5 py-1 text-muted-foreground">
          Live
          <Switch
            aria-label="Live only"
            checked={filters.liveOnly}
            onCheckedChange={(liveOnly) => setFilters({ liveOnly })}
          />
        </label>
      </div>
    </div>
  );
}

function Empty({ filtered }: { filtered: boolean }) {
  const connections = Object.values(useGraphs((state) => state.connections));
  const bridges = usePreferences((state) => state.bridges).filter((bridge) => bridge.enabled);
  const message = filtered
    ? "No session matches these filters."
    : connections.includes("unauthorized")
      ? "A bridge rejected its token."
      : connections.includes("open")
        ? "No activity yet. Start an agent, or set up a harness in Settings."
        : `Waiting for ${bridges[0]?.url ?? "a bridge"}. Run bun run dev, or add a bridge in Settings.`;
  const setFilters = usePreferences((state) => state.setFilters);
  return (
    <div className="flex flex-col items-start gap-2.5 px-4 pb-4 pt-1">
      <p className="type-body text-muted-foreground">{message}</p>
      {filtered ? (
        <Button size="sm" onClick={() => setFilters({ query: "", harness: "all", liveOnly: false })}>
          Clear filters
        </Button>
      ) : (
        <Button size="sm" asChild>
          <Link to="/settings">Set up a harness</Link>
        </Button>
      )}
    </div>
  );
}

export function SessionsPanel({ selected }: { selected?: string }) {
  const everything = useGraph();
  const { graph, now, liveMs } = useVisibleGraph();
  const harnesses = useMemo(
    () => [...new Set(Object.values(everything.sessions).map((session) => session.harness))].sort(),
    [everything],
  );

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
  const total = Object.keys(everything.sessions).length;

  return (
    <Panel side="left" label="Sessions">
      {total > 0 && <FilterBar harnesses={harnesses} />}
      <h2 className="type-caption border-b border-border/60 px-4 pb-2 pt-1 tabular-nums text-muted-foreground">
        {sessions.length === total ? total : `${sessions.length} of ${total}`} {total === 1 ? "session" : "sessions"}
      </h2>
      {sessions.length === 0 ? (
        <Empty filtered={total > 0} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ul className="flex flex-col gap-0.5 p-2">
            {sessions.map((session) => {
              const id = nodeId.agent(session.id);
              const live = now - Date.parse(session.lastAt) < liveMs;
              return (
                <li key={session.id}>
                  <Link
                    to="/"
                    search={{ node: id }}
                    className={cn(
                      "relative flex flex-col gap-0.5 rounded-xl px-3 py-2 transition-[background-color,box-shadow] duration-150 hover:bg-accent/60",
                      selected === id && "bg-accent/90 shadow-xs ring-1 ring-border",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ProviderIcon provider={session.provider} />
                      <span className="type-body truncate font-medium">{session.title}</span>
                      <span
                        aria-hidden
                        className="ml-auto size-2 shrink-0 rounded-full ring-2 ring-background/60"
                        style={{ background: sessionColour(session.id) }}
                      />
                    </span>
                    <span className="type-caption pl-6 tabular-nums text-muted-foreground">
                      {session.harness} ·{" "}
                      {session.agents > 0 && `${session.agents} ${session.agents === 1 ? "subagent" : "subagents"} · `}
                      {session.tools} {session.tools === 1 ? "tool" : "tools"} ·{" "}
                      {live ? (
                        <span className="inline-flex items-center gap-1 font-medium text-live">
                          <span aria-hidden className="size-1.5 rounded-full bg-live" />
                          now
                        </span>
                      ) : (
                        `${ago(session.lastAt, now)} ago`
                      )}
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
