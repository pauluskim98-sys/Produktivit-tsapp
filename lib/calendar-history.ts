import { db, USER, transaction } from "./db";
import { applyHistoryDelta } from "./history-delta";
import { isDeepStrictEqual } from "node:util";
db.exec(
  "CREATE TABLE IF NOT EXISTS CalendarHistory (id TEXT PRIMARY KEY, before TEXT NOT NULL, after TEXT NOT NULL, createdAt INTEGER NOT NULL)",
);
export function calendarSnapshot() {
  return {
    connections: db
      .prepare("SELECT * FROM CalendarConnection WHERE userId=? ORDER BY id")
      .all(USER),
    events: db
      .prepare(
        "SELECT * FROM CalendarEvent WHERE connectionId IN (SELECT id FROM CalendarConnection WHERE userId=?) ORDER BY id",
      )
      .all(USER),
  };
}
export function rememberCalendar(before: ReturnType<typeof calendarSnapshot>) {
  const after = calendarSnapshot();
  if (isDeepStrictEqual(before, after)) return null;
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO CalendarHistory VALUES(?,?,?,?)").run(
    id,
    JSON.stringify(before),
    JSON.stringify(after),
    Date.now(),
  );
  db.prepare(
    "DELETE FROM CalendarHistory WHERE id NOT IN (SELECT id FROM CalendarHistory ORDER BY createdAt DESC LIMIT 100)",
  ).run();
  return id;
}
export function replayCalendar(id: string, redo: boolean) {
  const row = db
    .prepare("SELECT before,after FROM CalendarHistory WHERE id=?")
    .get(id);
  if (!row) throw new Error("Diese Änderung ist nicht mehr im Verlauf.");
  const before = JSON.parse(String(row.before)),
    after = JSON.parse(String(row.after)),
    current = calendarSnapshot(),
    next = applyHistoryDelta(
      current,
      redo ? before : after,
      redo ? after : before,
    );
  transaction(() => {
    for (const c of current.connections)
      if (!next.connections.some((x: any) => x.id === c.id))
        db.prepare(
          "DELETE FROM CalendarConnection WHERE id=? AND userId=?",
        ).run(c.id, USER);
    for (const c of next.connections) {
      const fields = Object.keys(c);
      db.prepare(
        `INSERT OR REPLACE INTO CalendarConnection (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
      ).run(...fields.map((k) => c[k]));
    }
    // REPLACE cascades old events; rebuild the exact merged calendar data.
    for (const e of next.events) {
      const fields = Object.keys(e);
      db.prepare(
        `INSERT OR REPLACE INTO CalendarEvent (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
      ).run(...fields.map((k) => e[k]));
    }
  });
}
