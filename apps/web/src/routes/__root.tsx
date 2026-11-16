import { HierarchySquare01Icon, Layers01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useNavigate, useSearch } from "@tanstack/react-router";
import { AgentGraph } from "@/components/graph/agent-graph";
import { MapControls } from "@/components/map-controls";
import { BridgeStreams } from "@/lib/stream";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  errorComponent: ({ error }) => (
    <main className="grid h-dvh place-items-center p-6">
      <div className="surface flex max-w-md flex-col gap-2 rounded-xl p-6">
        <h1 className="type-title">Something broke</h1>
        <p className="type-body text-muted-foreground">{(error as Error).message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => <p className="type-body absolute top-20 left-6 text-muted-foreground">Nothing here.</p>,
});

const tab =
  "relative flex h-8 items-center gap-2 rounded-md px-2 type-body text-foreground transition-colors hover:bg-[var(--button-invisible-bgColor-hover)] pointer-coarse:h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center";
const active = { className: "bg-secondary font-semibold" };

function Root() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <BridgeStreams />
      <AgentGraph selected={search.node} onSelect={(node) => navigate({ to: "/", search: node ? { node } : {} })} />
      <header className="surface absolute top-4 left-4 flex h-12 items-center gap-1 rounded-xl px-2">
        <span className="type-title flex items-center gap-2 px-2 max-sm:hidden">
          <HugeiconsIcon icon={HierarchySquare01Icon} className="size-5" />
          <span className="max-sm:sr-only">Agent Map</span>
        </span>
        <nav aria-label="Main" className="flex items-center gap-1 sm:border-l sm:pl-2">
          <Link to="/" className={tab} activeProps={active}>
            <HugeiconsIcon icon={Layers01Icon} className="size-4 text-muted-foreground" />
            <span className="max-sm:sr-only">Sessions</span>
          </Link>
          <Link to="/settings" className={tab} activeProps={active}>
            <HugeiconsIcon icon={Settings01Icon} className="size-4 text-muted-foreground" />
            <span className="max-sm:sr-only">Settings</span>
          </Link>
        </nav>
      </header>
      <MapControls />
      <Outlet />
    </main>
  );
}
