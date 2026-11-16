import { Database } from "bun:sqlite";
import { join } from "node:path";
import type { AgentEvent } from "@agent-map/shared/events";
import { asc, countDistinct, eq, gt, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

export type Entry = { seq: number; event: AgentEvent };
export type Notice = { type: "event"; entry: Entry } | { type: "forget"; sessionId: string };
type Listener = (notice: Notice) => void;

const PAGE = 2000;
const MIGRATIONS = join(import.meta.dir, "../../drizzle");

// why: transcripts are re-read after every restart, so an identical event must land only once
const keyOf = (event: AgentEvent) => Bun.hash(JSON.stringify(event)).toString(36);

export function createStore(path: string) {
  const sqlite = new Database(path, { create: true, strict: true });
  sqlite.run("PRAGMA journal_mode = WAL");

  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  db.insert(schema.meta)
    .values({ name: "id", value: crypto.randomUUID().slice(0, 8) })
    .onConflictDoNothing()
    .run();

  // why: a client's Last-Event-ID is only meaningful against the database that issued it
  const id =
    db.select({ value: schema.meta.value }).from(schema.meta).where(eq(schema.meta.name, "id")).get()?.value ?? "";
  const isHidden = db
    .select({ sessionId: schema.hidden.sessionId })
    .from(schema.hidden)
    .where(eq(schema.hidden.sessionId, sql.placeholder("sessionId")))
    .prepare();
  const insert = db
    .insert(schema.events)
    .values({
      key: sql.placeholder("key"),
      sessionId: sql.placeholder("sessionId"),
      at: sql.placeholder("at"),
      body: sql.placeholder("body"),
    })
    .onConflictDoNothing()
    .returning({ seq: schema.events.seq })
    .prepare();
  const page = db
    .select({ seq: schema.events.seq, body: schema.events.body })
    .from(schema.events)
    .where(gt(schema.events.seq, sql.placeholder("cursor")))
    .orderBy(asc(schema.events.seq))
    .limit(PAGE)
    .prepare();

  const listeners = new Set<Listener>();
  const notify = (notice: Notice) => {
    for (const listener of listeners) listener(notice);
  };

  return {
    id,
    publish(events: AgentEvent[]) {
      let added = 0;
      for (const event of events) {
        if (isHidden.get({ sessionId: event.sessionId })) continue;
        const row = insert.get({
          key: keyOf(event),
          sessionId: event.sessionId,
          at: event.at,
          body: JSON.stringify(event),
        });
        if (!row) continue;
        added++;
        notify({ type: "event", entry: { seq: row.seq, event } });
      }
      return added;
    },
    *since(after: number): Generator<Entry> {
      let cursor = after;
      while (true) {
        const rows = page.all({ cursor });
        for (const row of rows) yield { seq: row.seq, event: JSON.parse(row.body) };
        if (rows.length < PAGE) return;
        cursor = rows[rows.length - 1].seq;
      }
    },
    forget(sessionId: string) {
      db.insert(schema.hidden).values({ sessionId }).onConflictDoNothing().run();
      const deleted = db
        .delete(schema.events)
        .where(eq(schema.events.sessionId, sessionId))
        .returning({ seq: schema.events.seq })
        .all();
      notify({ type: "forget", sessionId });
      return deleted.length;
    },
    prune(retentionDays: number) {
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
      return db.delete(schema.events).where(lt(schema.events.at, cutoff)).returning({ seq: schema.events.seq }).all()
        .length;
    },
    sessions: () =>
      db
        .select({ count: countDistinct(schema.events.sessionId) })
        .from(schema.events)
        .get()?.count ?? 0,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => sqlite.close(),
  };
}

export type Store = ReturnType<typeof createStore>;
