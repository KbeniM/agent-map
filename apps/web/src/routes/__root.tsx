import { Layers01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useNavigate, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { MapControls } from "@/components/map-controls";
import { BridgeStreams } from "@/lib/stream";

const AgentGraph = lazy(() =>
  import("@/components/graph/agent-graph").then((module) => ({ default: module.AgentGraph })),
);

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  errorComponent: ({ error }) => (
    <main className="grid h-dvh place-items-center p-6">
      <div className="surface flex max-w-md flex-col gap-2 rounded-2xl p-6">
        <h1 className="type-title">Something broke</h1>
        <p className="type-body text-muted-foreground">{(error as Error).message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => <p className="type-body absolute top-20 left-6 text-muted-foreground">Nothing here.</p>,
});

const tab =
  "relative flex h-8 items-center gap-2 rounded-lg px-2.5 type-body text-muted-foreground transition-[background-color,color,box-shadow] duration-150 ease-[var(--ease-out)] hover:bg-accent/60 hover:text-foreground pointer-coarse:h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center";
const active = { className: "bg-elevated text-foreground font-medium shadow-xs ring-1 ring-border/60" };

const SHEEP_PATH =
  "M12 2.75c1.55 0 2.9.85 3.55 2.15 1.45-.1 2.8.7 3.35 2 .5 1.15.25 2.45-.5 3.35 1.45.25 2.7 1.2 3.05 2.45.3 1.05-.3 2-1.25 2.25-.75.2-1.55-.1-2.1-.7.15.75.05 1.55-.35 2.25-.5.9-1.35 1.5-2.3 1.75v2.05c0 .75-.6 1.35-1.35 1.35s-1.35-.6-1.35-1.35v-1.65h-1.5v1.65c0 .75-.6 1.35-1.35 1.35s-1.35-.6-1.35-1.35v-2.05c-.95-.25-1.8-.85-2.3-1.75-.4-.7-.5-1.5-.35-2.25-.55.6-1.35.9-2.1.7-.95-.25-1.55-1.2-1.25-2.25.35-1.25 1.6-2.2 3.05-2.45-.75-.9-1-2.2-.5-3.35.55-1.3 1.9-2.1 3.35-2C9.1 3.6 10.45 2.75 12 2.75Zm-3.65 7.45c-.3.8-.35 1.75-.05 2.65.55 1.7 2 2.9 3.7 2.9s3.15-1.2 3.7-2.9c.3-.9.25-1.85-.05-2.65-.65.3-1.4.4-2.1.2-.45.4-1 .65-1.55.65s-1.1-.25-1.55-.65c-.7.2-1.45.1-2.1-.2Z";

function SheepIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d={SHEEP_PATH} />
    </svg>
  );
}

function Root() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <BridgeStreams />
      <Suspense fallback={null}>
        <AgentGraph selected={search.node} onSelect={(node) => navigate({ to: "/", search: node ? { node } : {} })} />
      </Suspense>
      <header className="surface absolute top-4 left-4 flex h-11 items-center gap-1.5 rounded-2xl px-1.5 pointer-coarse:h-13">
        <span className="type-title flex items-center gap-2 pl-1.5 pr-1 max-sm:hidden">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <SheepIcon className="size-[22px]" />
          </span>
          <span className="max-sm:sr-only">Rancher</span>
        </span>
        <nav aria-label="Main" className="flex items-center gap-1 sm:border-l sm:border-border/70 sm:pl-1.5">
          <Link to="/" className={tab} activeProps={active}>
            <HugeiconsIcon icon={Layers01Icon} className="size-4" />
            <span className="max-sm:sr-only">Sessions</span>
          </Link>
          <Link to="/settings" className={tab} activeProps={active}>
            <HugeiconsIcon icon={Settings01Icon} className="size-4" />
            <span className="max-sm:sr-only">Settings</span>
          </Link>
        </nav>
      </header>
      <MapControls />
      <Outlet />
    </main>
  );
}
