import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CalendarProvider } from "../lib/calendar/provider.ts";
import type { CalendarEvent } from "../lib/types.ts";
const dir = mkdtempSync(join(tmpdir(), "raum-sync-"));
process.env.DATABASE_PATH = join(dir, "test.sqlite");
const { db, USER } = await import("../lib/db.ts");
const { syncConnection, syncDueCalendars, isSyncDue } =
  await import("../lib/calendar/sync.ts");
function connection(type = "url") {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO CalendarConnection (id,userId,name,provider,sourceType,source,color,lastSynced) VALUES (?,?,?,?,?,?,?,?)",
  ).run(
    id,
    USER,
    "Test",
    "ics",
    type,
    "https://calendar.example/feed.ics",
    "#abc",
    "2020-01-01T00:00:00Z",
  );
  return id;
}
function row(id: string) {
  return db
    .prepare("SELECT * FROM CalendarConnection WHERE id=?")
    .get(id) as unknown as import("../lib/calendar/sync.ts").SyncSource;
}
function event(id: string, title = "Neu"): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    connectionId: id,
    title,
    start: "2026-10-10T08:00:00Z",
    end: "2026-10-10T09:00:00Z",
    allDay: false,
    location: "",
    description: "",
  };
}
function provider(sync: CalendarProvider["sync"]): CalendarProvider {
  return {
    id: "test",
    sync,
    connect: sync,
    getEvents: sync,
    disconnect: async () => {},
  };
}
test("Automatischer Abruf ersetzt Termine und überspringt Dateien/frische Abonnements", async () => {
  const id = connection(),
    file = connection("file");
  let calls = 0;
  await syncDueCalendars(
    provider(async (source) => {
      calls++;
      return [event(source.id)];
    }),
  );
  assert.equal(calls, 1);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS n FROM CalendarEvent WHERE connectionId=?")
      .get(id)?.n,
    1,
  );
  assert.equal(row(file).lastSynced, "2020-01-01T00:00:00Z");
  await syncDueCalendars(
    provider(async () => {
      calls++;
      return [];
    }),
  );
  assert.equal(calls, 1);
  await syncConnection(
    id,
    provider(async () => []),
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS n FROM CalendarEvent WHERE connectionId=?")
      .get(id)?.n,
    0,
  );
  db.prepare("DELETE FROM CalendarConnection").run();
});
test("Fehler behalten vorhandene Termine, Retry nach 5 Minuten, Erfolg löscht Fehlermeldung", async () => {
  const id = connection();
  await syncConnection(
    id,
    provider(async () => [event(id, "Vorhanden")]),
  );
  await assert.rejects(() =>
    syncConnection(
      id,
      provider(async () => {
        throw new Error("Netzwerkfehler");
      }),
    ),
  );
  assert.equal(
    db.prepare("SELECT title FROM CalendarEvent WHERE connectionId=?").get(id)
      ?.title,
    "Vorhanden",
  );
  assert.ok(row(id).lastError);
  const attempt = Date.parse(row(id).lastAttemptAt);
  assert.equal(isSyncDue(row(id), attempt + 299999), false);
  assert.equal(isSyncDue(row(id), attempt + 300000), true);
  await syncConnection(
    id,
    provider(async () => [event(id, "Aktualisiert")]),
  );
  assert.equal(row(id).lastError, "");
  assert.equal(
    db.prepare("SELECT title FROM CalendarEvent WHERE connectionId=?").get(id)
      ?.title,
    "Aktualisiert",
  );
  db.prepare("DELETE FROM CalendarConnection").run();
});
test("Überlappende Abrufe sind gesperrt und entfernte Kalender bleiben entfernt", async () => {
  const id = connection();
  let finish!: (events: CalendarEvent[]) => void;
  const pending = syncConnection(
    id,
    provider(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  await assert.rejects(
    () =>
      syncConnection(
        id,
        provider(async () => []),
      ),
    /bereits synchronisiert/,
  );
  db.prepare("DELETE FROM CalendarConnection WHERE id=?").run(id);
  finish([event(id)]);
  await assert.rejects(() => pending, /entfernt/);
  assert.equal(row(id), undefined);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM CalendarEvent").get()?.n,
    0,
  );
});
test.after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
