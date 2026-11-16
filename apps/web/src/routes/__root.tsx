import { HierarchySquare01Icon, Layers01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
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
  "relative flex h-8 items-center gap-2 rounded-lg px-2.5 type-body text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-accent/60 hover:text-foreground pointer-coarse:h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center";
const active = { className: "bg-background/90 text-foreground font-medium shadow-xs ring-1 ring-border/70" };

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
            <HugeiconsIcon icon={HierarchySquare01Icon} className="size-4" />
          </span>
          <span className="max-sm:sr-only">Agent Map</span>
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
