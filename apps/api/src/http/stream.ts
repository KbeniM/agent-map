import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { Entry, Notice, Store } from "../events/store";

const lastSeq = (store: Store, header: string | undefined) => {
  const [id, seq] = (header ?? "").split(":");
  return id === store.id ? Number(seq) || 0 : 0;
};

export const stream = (store: Store) => (c: Context) =>
  streamSSE(c, async (sse) => {
    const after = lastSeq(store, c.req.header("Last-Event-ID"));
    // why: bodies come from JSON.stringify and hold no raw newline, so one data line per event is valid SSE
    const frames = (entries: Entry[]) =>
      entries.map((entry) => `id: ${store.id}:${entry.seq}\ndata: ${entry.body}\n\n`).join("");
    // why: one write per batch or history page instead of one per event keeps replay off the per-chunk overhead
    const write = (notice: Notice) =>
      notice.type === "events"
        ? sse.write(frames(notice.entries))
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
    for (const page of store.since(after)) {
      await sse.write(frames(page));
      last = page[page.length - 1].seq;
    }
    for (const notice of pending) {
      if (notice.type === "forget") await write(notice);
      else await write({ type: "events", entries: notice.entries.filter((entry) => entry.seq > last) });
    }
    replaying = false;
    while (!sse.aborted) {
      // why: Bun closes a connection after 10 s without bytes, and proxies drop quiet streams
      await sse.sleep(5000);
      await sse.writeSSE({ event: "ping", data: "" });
    }
    unsubscribe();
  });
