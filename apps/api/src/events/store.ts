import { Database } from "bun:sqlite";
import type { AgentEvent } from "@agent-map/shared/events";

export type Entry = { seq: number; event: AgentEvent };
export type Notice = { type: "event"; entry: Entry } | { type: "forget"; sessionId: string };
type Listener = (notice: Notice) => void;

const PAGE = 2000;

// why: transcripts are re-read after every restart, so an identical event must land only once
const keyOf = (event: AgentEvent) => Bun.hash(JSON.stringify(event)).toString(36);

export function createStore(path: string) {
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run(`CREATE TABLE IF NOT EXISTS events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    at TEXT NOT NULL,
    body TEXT NOT NULL
  )`);
  db.run("CREATE INDEX IF NOT EXISTS events_session ON events (session_id)");
  db.run("CREATE INDEX IF NOT EXISTS events_at ON events (at)");
  db.run("CREATE TABLE IF NOT EXISTS hidden (session_id TEXT PRIMARY KEY)");
  db.run("CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.run("INSERT OR IGNORE INTO meta (name, value) VALUES ('id', ?)", [crypto.randomUUID().slice(0, 8)]);

  // why: a client's Last-Event-ID is only meaningful against the database that issued it
  const id = (db.query("SELECT value FROM meta WHERE name = 'id'").get() as { value: string }).value;
  const insert = db.query(
    "INSERT OR IGNORE INTO events (key, session_id, at, body) VALUES ($key, $session, $at, $body) RETURNING seq",
  );
  const hidden = db.query("SELECT 1 FROM hidden WHERE session_id = ?");
  const page = db.query("SELECT seq, body FROM events WHERE seq > ? ORDER BY seq LIMIT ?");
  const listeners = new Set<Listener>();
  const notify = (notice: Notice) => {
    for (const listener of listeners) listener(notice);
  };

  return {
    id,
    publish(events: AgentEvent[]) {
      let added = 0;
      for (const event of events) {
        if (hidden.get(event.sessionId)) continue;
        const row = insert.get({
          key: keyOf(event),
          session: event.sessionId,
          at: event.at,
          body: JSON.stringify(event),
        }) as { seq: number } | null;
        if (!row) continue;
        added++;
        notify({ type: "event", entry: { seq: row.seq, event } });
      }
      return added;
    },
    *since(after: number): Generator<Entry> {
      let cursor = after;
      while (true) {
        const rows = page.all(cursor, PAGE) as { seq: number; body: string }[];
        for (const row of rows) yield { seq: row.seq, event: JSON.parse(row.body) };
        if (rows.length < PAGE) return;
        cursor = rows[rows.length - 1].seq;
      }
    },
    forget(sessionId: string) {
      db.run("INSERT OR IGNORE INTO hidden (session_id) VALUES (?)", [sessionId]);
      const { changes } = db.run("DELETE FROM events WHERE session_id = ?", [sessionId]);
      notify({ type: "forget", sessionId });
      return changes;
    },
    prune(retentionDays: number) {
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
      return db.run("DELETE FROM events WHERE at < ?", [cutoff]).changes;
    },
    sessions: () =>
      (db.query("SELECT COUNT(DISTINCT session_id) AS count FROM events").get() as { count: number }).count,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => db.close(),
  };
}

export type Store = ReturnType<typeof createStore>;
