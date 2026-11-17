import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "@rancher/shared/events";
import { asc, countDistinct, eq, gt, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import initial from "../../drizzle/0000_lyrical_ken_ellis.sql" with { type: "text" };
import journal from "../../drizzle/meta/_journal.json";
import * as schema from "./schema";

// why: the body stays the stored JSON string, so the stream sends it without parsing and stringifying again
export type Entry = { seq: number; body: string };
export type Notice = { type: "events"; entries: Entry[] } | { type: "forget"; sessionId: string };
type Listener = (notice: Notice) => void;

const PAGE = 2000;

// why: drizzle's migrator reads a folder from disk, which does not exist inside the compiled desktop sidecar; the SQL is embedded and written out first
// shortcut: each new migration needs an import and a row here, upgrade when a second one lands
const SQL: Record<string, string> = { "0000_lyrical_ken_ellis": initial };

function migrationsFolder() {
  const folder = mkdtempSync(join(tmpdir(), "rancher-migrations-"));
  mkdirSync(join(folder, "meta"));
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) {
    const query = SQL[entry.tag];
    if (query === undefined) throw new Error(`migration ${entry.tag} is not embedded in store.ts`);
    writeFileSync(join(folder, `${entry.tag}.sql`), query);
  }
  return folder;
}

// why: transcripts are re-read after every restart, so an identical event must land only once
const keyOf = (body: string) => Bun.hash(body).toString(36);

export function createStore(path: string) {
  const sqlite = new Database(path, { create: true, strict: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  // why: WAL with NORMAL survives an app crash; transcripts are re-read on restart, so only a power cut can lose hook events
  sqlite.run("PRAGMA synchronous = NORMAL");

  const db = drizzle({ client: sqlite, schema });
  const folder = migrationsFolder();
  try {
    migrate(db, { migrationsFolder: folder });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  db.insert(schema.meta)
    .values({ name: "id", value: crypto.randomUUID().slice(0, 8) })
    .onConflictDoNothing()
    .run();

  // why: a client's Last-Event-ID is only meaningful against the database that issued it
  const id =
    db.select({ value: schema.meta.value }).from(schema.meta).where(eq(schema.meta.name, "id")).get()?.value ?? "";
  const hidden = new Set(
    db
      .select({ sessionId: schema.hidden.sessionId })
      .from(schema.hidden)
      .all()
      .map((row) => row.sessionId),
  );
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

  // why: one transaction per batch instead of one commit per event
  const insertAll = sqlite.transaction((events: AgentEvent[]) => {
    const entries: Entry[] = [];
    for (const event of events) {
      if (hidden.has(event.sessionId)) continue;
      const body = JSON.stringify(event);
      const row = insert.get({ key: keyOf(body), sessionId: event.sessionId, at: event.at, body });
      if (row) entries.push({ seq: row.seq, body });
    }
    return entries;
  });

  const listeners = new Set<Listener>();
  const notify = (notice: Notice) => {
    for (const listener of listeners) listener(notice);
  };

  return {
    id,
    publish(events: AgentEvent[]) {
      const entries = insertAll(events);
      if (entries.length > 0) notify({ type: "events", entries });
      return entries.length;
    },
    *since(after: number): Generator<Entry[]> {
      let cursor = after;
      while (true) {
        const rows = page.all({ cursor });
        if (rows.length > 0) yield rows;
        if (rows.length < PAGE) return;
        cursor = rows[rows.length - 1].seq;
      }
    },
    forget(sessionId: string) {
      db.insert(schema.hidden).values({ sessionId }).onConflictDoNothing().run();
      hidden.add(sessionId);
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
