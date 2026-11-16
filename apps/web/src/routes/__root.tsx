import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useNavigate, useSearch } from "@tanstack/react-router";
import { AgentGraph } from "@/components/graph/agent-graph";
import { MapControls } from "@/components/map-controls";
import { BridgeStreams } from "@/lib/stream";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  errorComponent: ({ error }) => (
    <main className="grid h-dvh place-items-center p-6">
      <div className="glass flex max-w-md flex-col gap-2 rounded-3xl p-6">
        <h1 className="type-title">Something broke</h1>
        <p className="type-body text-muted-foreground">{(error as Error).message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => <p className="type-body absolute top-20 left-6 text-muted-foreground">Nothing here.</p>,
});

const tab = "rounded-full px-3 py-1 type-caption text-muted-foreground transition-colors hover:text-foreground";

function Root() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <BridgeStreams />
      <AgentGraph selected={search.node} onSelect={(node) => navigate({ to: "/", search: node ? { node } : {} })} />
      <header className="glass absolute top-4 left-4 flex items-center gap-1 rounded-full py-1 pr-1 pl-4">
        <span className="type-title mr-2">Agent Map</span>
        <Link to="/" className={tab} activeProps={{ className: "bg-secondary text-foreground" }}>
          Sessions
        </Link>
        <Link to="/settings" className={tab} activeProps={{ className: "bg-secondary text-foreground" }}>
          Settings
        </Link>
      </header>
      <MapControls />
      <Outlet />
    </main>
  );
}
