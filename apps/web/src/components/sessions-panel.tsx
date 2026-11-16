import { AlertCircleIcon, Clock01Icon, Plug01Icon, Search01Icon, Wrench01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Session, Tool } from "@rancher/shared/graph";
import { nodeId } from "@rancher/shared/layout";
import { type Provider, providerOf } from "@rancher/shared/providers";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { memo, useMemo } from "react";
import { sessionColour } from "@/components/graph/colour";
import { ProviderIcon } from "@/components/icons";
import { Panel } from "@/components/panel";
import { OptionMenu, SearchCombobox } from "@/components/pickers";
import { SheepLoader } from "@/components/sheep-loader";
import { Button } from "@/components/ui/button";
import { EmptyContent, EmptyDescription, EmptyHeader, Empty as EmptyState } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemGroup } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ago } from "@/lib/time";
import { useVisibleGraph } from "@/lib/visible";
import { useGraph, useGraphs } from "@/stores/graph";
import { type SessionSort, usePreferences } from "@/stores/preferences";

function FilterBar({ harnesses }: { harnesses: string[] }) {
  const { filters, setFilters } = usePreferences();
  const harnessItems = useMemo(
    () => [
      { value: "all", label: "All harnesses", icon: <HugeiconsIcon icon={Plug01Icon} className="size-3.5 shrink-0" /> },
      ...harnesses.map((harness) => ({
        value: harness,
        label: harness,
        icon: <ProviderIcon provider={providerOf(undefined, harness)} className="size-3.5" />,
      })),
    ],
    [harnesses],
  );
  return (
    <div className="flex flex-col gap-2 px-3.5 pt-3.5 pb-2.5">
      <InputGroup>
        <InputGroupAddon>
          <HugeiconsIcon icon={Search01Icon} />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search sessions"
          placeholder="Title, folder or harness"
          value={filters.query}
          onChange={(event) => setFilters({ query: event.target.value })}
        />
      </InputGroup>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <SearchCombobox
          label="Harness"
          placeholder="Filter harnesses…"
          className="min-w-28 flex-1"
          value={filters.harness}
          items={harnessItems}
          onChange={(harness) => setFilters({ harness })}
        />
        <Label className="shrink-0 gap-1.5">
          Live
          <Switch
            size="sm"
            aria-label="Live only"
            checked={filters.liveOnly}
            onCheckedChange={(liveOnly) => setFilters({ liveOnly })}
          />
        </Label>
        <Label className="shrink-0 gap-1.5">
          Errors
          <Switch
            size="sm"
            aria-label="Errors only"
            checked={filters.errorsOnly ?? false}
            onCheckedChange={(errorsOnly) => setFilters({ errorsOnly })}
          />
        </Label>
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
  const connecting = !filtered && connections.includes("connecting");
  return (
    <EmptyState className="gap-3 border-0 p-4">
      {connecting && <SheepLoader className="w-full py-1" />}
      <EmptyHeader>
        <EmptyDescription className={cn(connecting && "shimmer")}>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button
            size="sm"
            onClick={() => setFilters({ query: "", harness: "all", liveOnly: false, errorsOnly: false })}
          >
            Clear filters
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link to="/settings">Set up a harness</Link>
          </Button>
        )}
      </EmptyContent>
    </EmptyState>
  );
}

type SessionSummary = Session & { provider: Provider; agents: number; tools: number; errors: number };

const failures = new WeakMap<object, number>();
// why: a session's tool map keeps its reference until one of its tools changes, so its error count is computed once per change
function errorsOf(tools: Record<string, Tool> | undefined) {
  if (!tools) return 0;
  let count = failures.get(tools);
  if (count === undefined) {
    count = Object.values(tools).filter((tool) => tool.ok === false).length;
    failures.set(tools, count);
  }
  return count;
}

// why: memoised so a streamed frame re-renders only the rows whose session changed
type RowProps = { session: SessionSummary; selected: boolean; live: boolean; since: string };

const SessionRow = memo(function SessionRow({ session, selected, live, since }: RowProps) {
  return (
    <Item
      asChild
      size="xs"
      variant={selected ? "muted" : "default"}
      className="min-w-0 flex-col flex-nowrap items-stretch gap-0.5 overflow-hidden"
    >
      <Link to="/" search={{ node: nodeId.agent(session.id) }} className="min-w-0 max-w-full">
        <span className="flex min-w-0 items-center gap-2">
          <ProviderIcon provider={session.provider} />
          <span className="type-body min-w-0 flex-1 truncate font-medium">{session.title}</span>
          <span
            aria-hidden
            className="ml-auto size-2 shrink-0 rounded-full"
            style={{ background: sessionColour(session.id) }}
          />
        </span>
        <span className="type-caption min-w-0 wrap-anywhere pl-6 tabular-nums text-muted-foreground">
          {session.harness} ·{" "}
          {session.agents > 0 && `${session.agents} ${session.agents === 1 ? "subagent" : "subagents"} · `}
          {session.tools} {session.tools === 1 ? "tool" : "tools"}
          {session.errors > 0 && (
            <span className="text-destructive">
              {" "}
              · {session.errors} {session.errors === 1 ? "error" : "errors"}
            </span>
          )}{" "}
          ·{" "}
          {live ? (
            <span className="inline-flex items-center gap-1 font-medium text-live">
              <span aria-hidden className="size-1.5 rounded-full bg-live" />
              now
            </span>
          ) : (
            `${since} ago`
          )}
        </span>
      </Link>
    </Item>
  );
}, sameRow);

function sameRow(a: RowProps, b: RowProps) {
  const [x, y] = [a.session, b.session];
  return (
    a.selected === b.selected &&
    a.live === b.live &&
    a.since === b.since &&
    x.title === y.title &&
    x.harness === y.harness &&
    x.provider === y.provider &&
    x.agents === y.agents &&
    x.tools === y.tools &&
    x.errors === y.errors
  );
}

export function SessionsPanel({ selected }: { selected?: string }) {
  const everything = useGraph();
  const { graph, now, liveMs } = useVisibleGraph();
  const sort = usePreferences((state) => state.filters.sort) ?? "recent";
  const setFilters = usePreferences((state) => state.setFilters);
  const harnesses = useMemo(
    () => [...new Set(Object.values(everything.sessions).map((session) => session.harness))].sort(),
    [everything],
  );

  const sessions = useMemo(() => {
    const counts = new Map<string, { agents: number; tools: number }>();
    for (const agent of Object.values(graph.agents)) {
      const entry = counts.get(agent.sessionId) ?? { agents: -1, tools: 0 };
      entry.agents += 1;
      entry.tools += agent.toolIds.length;
      counts.set(agent.sessionId, entry);
    }
    return Object.values(graph.sessions)
      .map((session) => {
        const own = counts.get(session.id);
        return {
          ...session,
          provider: providerOf(graph.agents[session.id]?.model, session.harness),
          agents: Math.max(0, own?.agents ?? 0),
          tools: own?.tools ?? 0,
          errors: errorsOf(graph.tools[session.id]),
        };
      })
      .sort((a, b) => {
        if (sort === "tools" && b.tools !== a.tools) return b.tools - a.tools;
        if (sort === "errors" && b.errors !== a.errors) return b.errors - a.errors;
        return b.lastAt.localeCompare(a.lastAt);
      });
  }, [graph, sort]);
  const total = Object.keys(everything.sessions).length;

  return (
    <Panel side="left" label="Sessions">
      {total > 0 && <FilterBar harnesses={harnesses} />}
      <div className="flex items-center justify-between gap-2 px-4 pb-1.5 pt-0.5">
        <h2 className="type-caption tabular-nums text-muted-foreground">
          {sessions.length === total ? total : `${sessions.length} of ${total}`} {total === 1 ? "session" : "sessions"}
        </h2>
        {total > 1 && (
          <OptionMenu<SessionSort>
            label="Sort sessions"
            variant="ghost"
            size="xs"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            value={sort}
            onChange={(next) => setFilters({ sort: next })}
            options={{ recent: "Recent", tools: "Most tools", errors: "Most errors" }}
            icons={{ recent: Clock01Icon, tools: Wrench01Icon, errors: AlertCircleIcon }}
          />
        )}
      </div>
      <Separator />
      {sessions.length === 0 ? (
        <Empty filtered={total > 0} />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ItemGroup className="gap-0.5 p-2">
            {sessions.map((session) => {
              const id = nodeId.agent(session.id);
              const live = now - Date.parse(session.lastAt) < liveMs;
              return (
                <SessionRow
                  key={session.id}
                  session={session}
                  selected={selected === id}
                  live={live}
                  since={live ? "" : ago(session.lastAt, now)}
                />
              );
            })}
          </ItemGroup>
        </ScrollArea>
      )}
    </Panel>
  );
}
