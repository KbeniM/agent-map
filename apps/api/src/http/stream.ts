import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { Notice, Store } from "../events/store";

const lastSeq = (store: Store, header: string | undefined) => {
  const [id, seq] = (header ?? "").split(":");
  return id === store.id ? Number(seq) || 0 : 0;
};

export const stream = (store: Store) => (c: Context) =>
  streamSSE(c, async (sse) => {
    const after = lastSeq(store, c.req.header("Last-Event-ID"));
    const write = (notice: Notice) =>
      notice.type === "event"
        ? sse.writeSSE({ id: `${store.id}:${notice.entry.seq}`, data: JSON.stringify(notice.entry.event) })
        : sse.writeSSE({ event: "forget", data: notice.sessionId });
    const pending: Notice[] = [];
    let replaying = true;
    // why: events published while history replays are queued so the client never sees them out of order
    const unsubscribe = store.subscribe((notice) => {
      if (replaying) pending.push(notice);
      else void write(notice);
    });
    sse.onAbort(() => {
      unsubscribe();
    });
    if (after === 0) await sse.writeSSE({ event: "reset", data: store.id });
    let last = after;
    for (const entry of store.since(after)) {
      await write({ type: "event", entry });
      last = entry.seq;
    }
    for (const notice of pending) if (notice.type === "forget" || notice.entry.seq > last) await write(notice);
    replaying = false;
    while (!sse.aborted) {
      // why: Bun closes a connection after 10 s without bytes, and proxies drop quiet streams
      await sse.sleep(5000);
      await sse.writeSSE({ event: "ping", data: "" });
    }
    unsubscribe();
  });
