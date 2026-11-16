import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
  "events",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    key: text("key").notNull().unique(),
    sessionId: text("session_id").notNull(),
    at: text("at").notNull(),
    body: text("body").notNull(),
  },
  (table) => [index("events_session").on(table.sessionId), index("events_at").on(table.at)],
);

export const hidden = sqliteTable("hidden", {
  sessionId: text("session_id").primaryKey(),
});

export const meta = sqliteTable("meta", {
  name: text("name").primaryKey(),
  value: text("value").notNull(),
});
