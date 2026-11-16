import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useNavigate, useSearch } from "@tanstack/react-router";
import { AgentGraph } from "@/components/graph/agent-graph";
import { MapControls } from "@/components/map-controls";
import { useBridgeStream } from "@/lib/stream";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Root });

const tab = "rounded-full px-3 py-1 type-caption text-muted-foreground transition-colors hover:text-foreground";

function Root() {
  useBridgeStream();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <AgentGraph selected={search.node} onSelect={(node) => navigate({ to: "/", search: node ? { node } : {} })} />
      <header className="glass absolute top-4 left-4 flex items-center gap-1 rounded-full py-1 pr-1 pl-4">
        <span className="type-title mr-2">Agent Map</span>
        <Link to="/" className={tab} activeProps={{ className: "bg-secondary text-foreground" }}>
          Sessions
        </Link>
        <Link to="/connect" className={tab} activeProps={{ className: "bg-secondary text-foreground" }}>
          Connect
        </Link>
      </header>
      <MapControls />
      <Outlet />
    </main>
  );
}
