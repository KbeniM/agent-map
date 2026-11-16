import { type AgentEvent, agentEventSchema } from "@agent-map/shared/events";
import { useEffect } from "react";
import { useBridge } from "@/stores/bridge";
import { useGraph } from "@/stores/graph";

export function useBridgeStream() {
  const url = useBridge((state) => state.url);

  useEffect(() => {
    const { receive, reset, setConnection } = useGraph.getState();
    const source = new EventSource(`${url}/v1/stream`);
    let queue: AgentEvent[] = [];
    let frame = 0;
    // why: replaying history sends thousands of events at once, so they land in one store update per frame
    const flush = () => {
      frame = 0;
      receive(queue);
      queue = [];
    };
    setConnection("connecting");
    source.onopen = () => setConnection("open");
    source.onerror = () => setConnection(source.readyState === EventSource.CLOSED ? "closed" : "connecting");
    source.addEventListener("reset", () => {
      queue = [];
      reset();
    });
    source.onmessage = (message) => {
      const parsed = agentEventSchema.safeParse(JSON.parse(message.data));
      if (!parsed.success) return;
      queue.push(parsed.data);
      frame ||= requestAnimationFrame(flush);
    };
    return () => {
      cancelAnimationFrame(frame);
      source.close();
    };
  }, [url]);
}
