import { ArrowDown02Icon, ArrowRight01Icon, Cancel01Icon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type Agent, type Graph, type Message, type Tool, toolOf } from "@rancher/shared/graph";
import { nodeId } from "@rancher/shared/layout";
import { providerOf } from "@rancher/shared/providers";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { reducedMotion } from "@/components/graph/camera";
import { ProviderIcon, ToolIcon } from "@/components/icons";
import { MarkdownText } from "@/components/markdown";
import { Panel } from "@/components/panel";
import { OptionMenu } from "@/components/pickers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemGroup, ItemMedia } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { client, unwrap } from "@/lib/api";
import { agentDetails, agentTrace, nodeSubtitle, nodeTitle, resolveNode } from "@/lib/inspector";
import { duration, useNow } from "@/lib/time";
import { useGraph, useSessionBridge } from "@/stores/graph";
import { type ToolDisplay, usePreferences } from "@/stores/preferences";

const ToolRow = memo(function ToolRow({ tool, now, detailed }: { tool: Tool; now: number; detailed: boolean }) {
  return (
    <Item size="xs" className="min-w-0 items-start px-4 py-1.5">
      <ItemMedia variant="icon" className="mt-0.5">
        <ToolIcon
          name={tool.name}
          className={cn(!tool.finishedAt && "text-live", tool.ok === false && "text-destructive")}
        />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0">
        <span
          className={cn("type-caption wrap-anywhere font-mono font-medium", tool.ok === false && "text-destructive")}
        >
          {tool.name}
        </span>
        {detailed && tool.summary && (
          <span className="type-caption wrap-anywhere text-muted-foreground">{tool.summary}</span>
        )}
      </ItemContent>
      <span
        className={cn(
          "type-micro shrink-0 tabular-nums text-muted-foreground",
          !tool.finishedAt && "text-live",
          tool.ok === false && "text-destructive",
        )}
      >
        {tool.finishedAt ? duration(tool.startedAt, tool.finishedAt, now) : "running"}
      </span>
    </Item>
  );
});

const MessageRow = memo(function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <Item variant="muted" size="xs" className="mx-3 my-1.5 w-auto min-w-0 flex-col items-stretch">
        <MarkdownText text={message.text} />
      </Item>
    );
  }
  return (
    <div className="min-w-0 px-4 py-1.5">
      <MarkdownText text={message.text} />
    </div>
  );
});

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
    <>
      <Separator />
      <div className="flex shrink-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="type-caption min-w-0 flex-1 text-muted-foreground">
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
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              Remove session
            </Button>
          )}
        </div>
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}

function LiveToolDetail({ tool, agent }: { tool: Tool; agent: Agent }) {
  const now = useNow(1000);
  return <ToolDetail tool={tool} agent={agent} now={now} />;
}

function ToolDetail({ tool, agent, now }: { tool: Tool; agent: Agent; now: number }) {
  const outcome = tool.ok === false ? "Failed" : "Finished";
  return (
    <p className="type-body wrap-anywhere px-4 pb-4 text-muted-foreground">
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

const SECTION_TRIGGER =
  "group flex min-h-8 w-full cursor-pointer items-center gap-1.5 px-4 py-2 text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring pointer-coarse:min-h-11";

const AWAY_THRESHOLD_PX = 36;
const PIN_THRESHOLD_PX = 24;
const SCROLLABLE_SLOP_PX = 8;

function AgentDetail({ graph, agent }: { graph: Graph; agent: Agent }) {
  const { entries, children, session, errorCount, toolSummary } = agentDetails(graph, agent);
  const toolDisplay = usePreferences((state) => state.display.toolDisplay) ?? "detailed";
  const setDisplay = usePreferences((state) => state.setDisplay);
  const [toolFilter, setToolFilter] = useState<string>();
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);
  const [awayFromEnd, setAwayFromEnd] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const autoScrollingRef = useRef(false);
  const prevAgentIdRef = useRef<string | undefined>(undefined);

  const visibleEntries = entries
    .filter((entry) => {
      if (toolDisplay === "off" && entry.tool) return false;
      if (errorsOnly) return entry.tool?.ok === false;
      if (toolFilter) return entry.tool?.name === toolFilter;
      return true;
    })
    .slice(-80);
  const lastEntry = visibleEntries.at(-1);
  const tailKey = `${visibleEntries.length}:${lastEntry?.at ?? ""}:${lastEntry?.tool?.id ?? lastEntry?.message?.text ?? ""}:${lastEntry?.tool?.finishedAt ?? ""}`;
  const seenKeys = new Map<string, number>();

  useEffect(() => {
    const viewport = hostRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;

    const updateAway = () => {
      const dist = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const scrollable = viewport.scrollHeight > viewport.clientHeight + SCROLLABLE_SLOP_PX;
      if (dist <= PIN_THRESHOLD_PX) {
        autoScrollingRef.current = false;
        pinnedRef.current = true;
        setAwayFromEnd(false);
      } else {
        if (!autoScrollingRef.current) pinnedRef.current = false;
        setAwayFromEnd(scrollable && dist > AWAY_THRESHOLD_PX);
      }
    };

    const cancelAutoScroll = () => {
      autoScrollingRef.current = false;
    };

    const onResize = () => {
      if (pinnedRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
        setAwayFromEnd(false);
        return;
      }
      updateAway();
    };

    viewport.addEventListener("scroll", updateAway, { passive: true });
    viewport.addEventListener("wheel", cancelAutoScroll, { passive: true });
    viewport.addEventListener("pointerdown", cancelAutoScroll, { passive: true });
    viewport.addEventListener("touchstart", cancelAutoScroll, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : undefined;
    if (observer) {
      observer.observe(viewport);
      if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    }

    return () => {
      observer?.disconnect();
      viewport.removeEventListener("scroll", updateAway);
      viewport.removeEventListener("wheel", cancelAutoScroll);
      viewport.removeEventListener("pointerdown", cancelAutoScroll);
      viewport.removeEventListener("touchstart", cancelAutoScroll);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll anchoring responds to tailKey and filter changes
  useLayoutEffect(() => {
    const viewport = hostRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    if (prevAgentIdRef.current !== agent.id) {
      prevAgentIdRef.current = agent.id;
      pinnedRef.current = true;
      autoScrollingRef.current = false;
    }
    if (pinnedRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      setAwayFromEnd(false);
    } else {
      const dist = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const scrollable = viewport.scrollHeight > viewport.clientHeight + SCROLLABLE_SLOP_PX;
      setAwayFromEnd(scrollable && dist > AWAY_THRESHOLD_PX);
    }
  }, [agent.id, tailKey, toolDisplay, toolFilter, errorsOnly, activityOpen]);

  const scrollToEnd = () => {
    const viewport = hostRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    pinnedRef.current = true;
    const targetTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (reducedMotion() || targetTop - viewport.scrollTop <= PIN_THRESHOLD_PX) {
      autoScrollingRef.current = false;
      viewport.scrollTop = targetTop;
      setAwayFromEnd(false);
      return;
    }
    autoScrollingRef.current = true;
    viewport.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  return (
    <div ref={hostRef} className="relative flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        {children.length > 0 && (
          <>
            <Separator />
            <Collapsible defaultOpen>
              <h3>
                <CollapsibleTrigger className={SECTION_TRIGGER}>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    aria-hidden
                    className="size-3.5 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-90 motion-reduce:transition-none"
                  />
                  <span className="type-micro">Subagents</span>
                  <span className="type-caption ml-auto tabular-nums text-muted-foreground">{children.length}</span>
                </CollapsibleTrigger>
              </h3>
              <CollapsibleContent>
                <ItemGroup className="gap-0.5 px-2 pb-2">
                  {children.map((child) => {
                    const childErrors = child.toolIds.filter(
                      (tid) => toolOf(graph, child.sessionId, tid)?.ok === false,
                    ).length;
                    return (
                      <Item key={child.id} asChild size="xs" className="min-w-0">
                        <Link to="/" search={{ node: nodeId.agent(child.id) }} className="min-w-0">
                          <ProviderIcon provider={providerOf(child.model, session?.harness)} className="size-3.5" />
                          <span className="min-w-0 flex-1 truncate font-medium">{child.name}</span>
                          <span className="type-micro shrink-0 tabular-nums text-muted-foreground">
                            {childErrors > 0 && <span className="text-destructive">{childErrors} err · </span>}
                            {child.toolIds.length} {child.toolIds.length === 1 ? "tool" : "tools"}
                          </span>
                        </Link>
                      </Item>
                    );
                  })}
                </ItemGroup>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
        {toolSummary.length > 0 && (
          <>
            <Separator />
            <Collapsible>
              <h3>
                <CollapsibleTrigger className={SECTION_TRIGGER}>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    aria-hidden
                    className="size-3.5 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-90 motion-reduce:transition-none"
                  />
                  <span className="type-micro">Tools</span>
                  <span className="type-caption ml-auto tabular-nums text-muted-foreground">
                    {agent.toolIds.length}
                    {errorCount > 0 && <span className="text-destructive"> · {errorCount} failed</span>}
                  </span>
                </CollapsibleTrigger>
              </h3>
              <CollapsibleContent>
                <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-0.5">
                  {toolSummary.map((item) => {
                    const active = toolFilter === item.name && !errorsOnly;
                    return (
                      <Button
                        key={item.name}
                        variant={active ? "secondary" : "outline"}
                        size="xs"
                        aria-pressed={active}
                        onClick={() => {
                          setErrorsOnly(false);
                          setToolFilter((prev) => (prev === item.name ? undefined : item.name));
                        }}
                        className="type-caption h-7 gap-1.5 px-2 font-mono font-normal normal-case tracking-normal"
                      >
                        <ToolIcon name={item.name} className={cn(item.failed > 0 && "text-destructive")} />
                        <span>{item.name}</span>
                        <span className="tabular-nums text-muted-foreground">×{item.total}</span>
                        {item.failed > 0 && <span className="tabular-nums text-destructive">({item.failed})</span>}
                      </Button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
        <Separator />
        <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
          <div className="flex items-center gap-1 pr-2">
            <h3 className="min-w-0 flex-1">
              <CollapsibleTrigger className={SECTION_TRIGGER}>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  aria-hidden
                  className="size-3.5 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-90 motion-reduce:transition-none"
                />
                <span className="type-micro">Activity</span>
              </CollapsibleTrigger>
            </h3>
            {errorCount > 0 && (
              <Toggle
                size="sm"
                aria-label="Filter failed tools"
                pressed={errorsOnly}
                onPressedChange={(pressed) => {
                  setErrorsOnly(pressed);
                  if (pressed) setToolFilter(undefined);
                }}
                className="type-caption h-7 px-2 font-normal normal-case tracking-normal text-destructive data-[state=on]:bg-destructive/15"
              >
                Errors ({errorCount})
              </Toggle>
            )}
            <OptionMenu<ToolDisplay>
              label="Tool calls display"
              variant="ghost"
              size="xs"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              value={toolDisplay}
              onChange={(next) => setDisplay({ toolDisplay: next })}
              options={{ detailed: "Tools: Detailed", simple: "Tools: Simple", off: "Tools: Off" }}
            />
          </div>
          <CollapsibleContent>
            <ItemGroup className="gap-0 pb-3">
              {visibleEntries.map((entry) => {
                if (entry.tool) {
                  return (
                    <ToolRow key={entry.tool.id} tool={entry.tool} now={0} detailed={toolDisplay === "detailed"} />
                  );
                }
                const base = `${entry.at}:${entry.message?.role}:${entry.message?.text}`;
                const count = seenKeys.get(base) ?? 0;
                seenKeys.set(base, count + 1);
                return <MessageRow key={count ? `${base}#${count}` : base} message={entry.message as Message} />;
              })}
            </ItemGroup>
          </CollapsibleContent>
        </Collapsible>
      </ScrollArea>
      {activityOpen && awayFromEnd && (
        <Button
          type="button"
          variant="secondary"
          size="xs"
          aria-label="Scroll to end"
          onClick={scrollToEnd}
          className="surface animate-in fade-in slide-in-from-bottom-2 absolute bottom-3 left-1/2 z-10 -translate-x-1/2 duration-150"
        >
          <HugeiconsIcon icon={ArrowDown02Icon} strokeWidth={2} />
          <span>Scroll to end</span>
        </Button>
      )}
    </div>
  );
}

export function NodePanel({ id }: { id: string }) {
  const graph = useGraph();
  const [copied, setCopied] = useState(false);
  const found = resolveNode(graph, id);
  if (!found?.agent) return null;
  const { agent, tool } = found;
  const provider = providerOf(agent.model, graph.sessions[agent.sessionId]?.harness);
  const { parent, errorCount } = agentDetails(graph, agent);

  const copyTrace = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(agentTrace(graph, agent), null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Panel side="right" label="Details">
      <div className="flex min-w-0 shrink-0 items-start gap-3 px-4 pt-4 pb-3">
        {tool ? (
          <ToolIcon name={tool.name} className="mt-0.5 size-7" />
        ) : (
          <ProviderIcon provider={provider} className="mt-0.5 size-7" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="type-title wrap-anywhere text-balance">{nodeTitle(graph, agent, tool)}</h2>
          {tool ? (
            <p className="type-caption mt-0.5 wrap-anywhere text-muted-foreground">{tool.summary ?? agent.name}</p>
          ) : (
            <div className="type-caption mt-1 flex flex-col gap-0.5 text-muted-foreground">
              {parent ? (
                <p className="wrap-anywhere">
                  Subagent of{" "}
                  <Link
                    to="/"
                    search={{ node: nodeId.agent(parent.id) }}
                    className="font-medium text-foreground hover:underline"
                  >
                    {parent.id === parent.sessionId ? (graph.sessions[agent.sessionId]?.title ?? "main") : parent.name}
                  </Link>
                </p>
              ) : null}
              {(parent ? nodeSubtitle(graph, agent).slice(1) : nodeSubtitle(graph, agent)).map((line) => (
                <p key={line} className="wrap-anywhere">
                  {line}
                </p>
              ))}
              <p className="tabular-nums">
                {duration(agent.startedAt, agent.stoppedAt ?? agent.lastAt, Date.now())}
                {agent.toolIds.length > 0 && ` · ${agent.toolIds.length} tools`}
                {errorCount > 0 && <span className="text-destructive"> · {errorCount} failed</span>}
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!tool && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Copy trace JSON" onClick={copyTrace}>
                  <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className={cn(copied && "text-live")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied trace JSON" : "Copy trace JSON"}</TooltipContent>
            </Tooltip>
          )}
          <Button asChild variant="ghost" size="icon-sm" aria-label="Close" className="shrink-0">
            <Link to="/" search={{}}>
              <HugeiconsIcon icon={Cancel01Icon} />
            </Link>
          </Button>
        </div>
      </div>
      {tool ? (
        tool.finishedAt ? (
          <ToolDetail tool={tool} agent={agent} now={0} />
        ) : (
          <LiveToolDetail tool={tool} agent={agent} />
        )
      ) : (
        <AgentDetail graph={graph} agent={agent} />
      )}
      {!tool && agent.id === agent.sessionId && <RemoveSession sessionId={agent.sessionId} />}
    </Panel>
  );
}
