import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { bootId, type Entry, since, subscribe } from "../events/log";

const lastSeq = (header: string | undefined) => {
  const [boot, seq] = (header ?? "").split(":");
  return boot === bootId ? Number(seq) || 0 : 0;
};

export const stream = (c: Context) =>
  streamSSE(c, async (sse) => {
    const after = lastSeq(c.req.header("Last-Event-ID"));
    const send = ({ seq, event }: Entry) => sse.writeSSE({ id: `${bootId}:${seq}`, data: JSON.stringify(event) });
    if (after === 0) await sse.writeSSE({ event: "reset", data: bootId });
    const unsubscribe = subscribe((entry) => void send(entry));
    for (const entry of since(after)) await send(entry);
    sse.onAbort(() => {
      unsubscribe();
    });
    while (!sse.aborted) {
      // why: Bun closes a connection after 10 s without bytes, and proxies drop quiet streams
      await sse.sleep(5000);
      await sse.writeSSE({ event: "ping", data: "" });
    }
    unsubscribe();
  });
