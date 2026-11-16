# 0005. Events persist in SQLite and are deduplicated by content

The bridge keeps events in `bun:sqlite` (`$DATA_DIR/events.db`, WAL). An event's key is a hash of its JSON, and `INSERT OR IGNORE` drops an identical event.

This makes every adapter idempotent for free: transcripts are re-read after each restart, snapshot files can be re-parsed whole, and a hook and a transcript that report the same fact collapse. A client's `Last-Event-ID` stays valid across restarts because sequence numbers and the database id persist. Removing a session deletes its rows and remembers the id so a re-read transcript does not bring it back.

Considered: in-memory log (lost on restart, ADR-0001's shortcut), per-adapter offset bookkeeping (each adapter would need its own resume logic).
