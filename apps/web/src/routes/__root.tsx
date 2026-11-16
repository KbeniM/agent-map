import { Layers01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { cn } from "cn";
import { lazy, Suspense } from "react";
import { MapControls } from "@/components/map-controls";
import { SheepLoader } from "@/components/sheep-loader";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BridgeStreams } from "@/lib/stream";
import { useMapStore } from "@/stores/map";

const AgentGraph = lazy(() =>
  import("@/components/graph/agent-graph").then((module) => ({ default: module.AgentGraph })),
);

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  errorComponent: ({ error }) => (
    <main className="grid h-dvh place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Something broke</CardTitle>
          <CardDescription>{(error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  ),
  notFoundComponent: () => <p className="type-body absolute top-20 left-6 text-muted-foreground">Nothing here.</p>,
});

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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const leftOpen = useMapStore((state) => state.leftOpen);
  const setLeftOpen = useMapStore((state) => state.setLeftOpen);
  const toggleLeft = useMapStore((state) => state.toggleLeft);
  const sessionsOpen = pathname === "/" && leftOpen;
  const settingsOpen = pathname === "/settings" && leftOpen;

  return (
    <TooltipProvider>
      <main className="relative h-dvh w-full overflow-hidden">
        <BridgeStreams />
        <Suspense
          fallback={
            <div className="grid h-dvh w-full place-items-center">
              <SheepLoader label="Loading map…" />
            </div>
          }
        >
          <AgentGraph selected={search.node} onSelect={(node) => navigate({ to: "/", search: node ? { node } : {} })} />
        </Suspense>
        <header className="surface absolute top-0 left-0 z-10 flex h-10 items-stretch border-t-0 border-l-0 pointer-coarse:h-11">
          <div className="flex aspect-square items-center justify-center text-foreground">
            <SheepIcon className="size-7" />
            <span className="sr-only">Rancher</span>
          </div>
          <Separator orientation="vertical" />
          <nav aria-label="Main" className="flex items-stretch">
            <Button asChild variant="ghost" className="h-full px-4">
              <Link
                to="/"
                aria-expanded={sessionsOpen}
                className={cn(sessionsOpen && "bg-muted text-foreground")}
                onClick={(event) => {
                  if (pathname === "/") {
                    event.preventDefault();
                    toggleLeft();
                  } else {
                    setLeftOpen(true);
                  }
                }}
              >
                <HugeiconsIcon icon={Layers01Icon} />
                <span className="max-sm:sr-only">Sessions</span>
              </Link>
            </Button>
            <Separator orientation="vertical" />
            <Button asChild variant="ghost" className="h-full px-4">
              <Link
                to="/settings"
                aria-expanded={settingsOpen}
                className={cn(settingsOpen && "bg-muted text-foreground")}
                onClick={(event) => {
                  if (pathname === "/settings") {
                    event.preventDefault();
                    toggleLeft();
                  } else {
                    setLeftOpen(true);
                  }
                }}
              >
                <HugeiconsIcon icon={Settings01Icon} />
                <span className="max-sm:sr-only">Settings</span>
              </Link>
            </Button>
          </nav>
        </header>
        <MapControls />
        <Outlet />
      </main>
    </TooltipProvider>
  );
}
