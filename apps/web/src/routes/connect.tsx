import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Panel } from "@/components/panel";
import { Input } from "@/components/ui/input";
import { bridge, unwrap } from "@/lib/api";
import { useBridge } from "@/stores/bridge";

export const Route = createFileRoute("/connect")({ component: Connect });

const urlSchema = z.url({ protocol: /^https?$/ });

const sample = (url: string) => `curl -X POST ${url}/v1/events \\
  -H 'content-type: application/json' \\
  -d '{"type":"tool.started","sessionId":"run-1",
       "agentId":"run-1","toolId":"t1","name":"search",
       "at":"${new Date().toISOString().slice(0, 19)}Z"}'`;

function Connect() {
  const { url, setUrl } = useBridge();
  const harnesses = useQuery({
    queryKey: ["harnesses", url],
    queryFn: () => unwrap(bridge(url).v1.harnesses.$get()),
    refetchInterval: 5000,
  });

  return (
    <Panel side="left" label="Connect">
      <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="type-caption text-muted-foreground">Bridge</span>
          <Input
            defaultValue={url}
            key={url}
            spellCheck={false}
            className="font-mono"
            onBlur={(event) => {
              const parsed = urlSchema.safeParse(event.target.value.trim().replace(/\/$/, ""));
              if (parsed.success) setUrl(parsed.data);
              else event.target.value = url;
            }}
          />
        </label>

        <div className="flex flex-col gap-2">
          <h2 className="type-caption text-muted-foreground">Harnesses</h2>
          {harnesses.isError && <p className="type-body text-destructive">Bridge unreachable at {url}</p>}
          {harnesses.data?.map((harness) => (
            <div key={harness.id} className="flex flex-col">
              <span className="type-body font-medium">{harness.name}</span>
              <span className="type-caption truncate font-mono text-muted-foreground">{harness.source}</span>
              <span className="type-caption text-muted-foreground">
                {harness.sessions} {harness.sessions === 1 ? "session" : "sessions"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="type-caption text-muted-foreground">Any other harness</h2>
          <p className="type-body text-muted-foreground">
            Post <span className="font-mono text-foreground">session.started</span>,{" "}
            <span className="font-mono text-foreground">agent.started</span>,{" "}
            <span className="font-mono text-foreground">tool.started</span> and{" "}
            <span className="font-mono text-foreground">tool.finished</span> events. A subagent names the tool call that
            spawned it in <span className="font-mono text-foreground">parentToolId</span>.
          </p>
          <pre className="type-micro overflow-x-auto rounded-2xl bg-background/60 p-3 font-mono text-muted-foreground">
            {sample(url)}
          </pre>
        </div>
      </div>
    </Panel>
  );
}
