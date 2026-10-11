import { db, transaction, USER } from "../db.ts";
import { calendarProviders } from "./ics.ts";
import type { CalendarProvider, CalendarSource } from "./provider";
import type { CalendarEvent } from "../types";
export const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const RETRY_INTERVAL_MS = 5 * 60 * 1000;
export interface SyncSource extends CalendarSource {
  provider: string;
  lastSynced: string;
  lastAttemptAt: string;
  lastError: string;
  syncLeaseUntil: number;
  syncToken: string;
}
export function isSyncDue(source: SyncSource, now = Date.now()) {
  if (source.sourceType !== "url" || source.syncLeaseUntil > now) return false;
  const last = Date.parse(source.lastAttemptAt || source.lastSynced);
  return (
    !Number.isFinite(last) ||
    now - last >= (source.lastError ? RETRY_INTERVAL_MS : SYNC_INTERVAL_MS)
  );
}
export function replaceEvents(connectionId: string, events: CalendarEvent[]) {
  db.prepare("DELETE FROM CalendarEvent WHERE connectionId=?").run(
    connectionId,
  );
  const insert = db.prepare(
    "INSERT INTO CalendarEvent (id,connectionId,title,start,end,allDay,location,description) VALUES (?,?,?,?,?,?,?,?)",
  );
  for (const e of events)
    insert.run(
      e.id,
      connectionId,
      e.title,
      e.start,
      e.end,
      Number(e.allDay),
      e.location,
      e.description,
    );
}
export async function syncConnection(
  id: string,
  overrideProvider?: CalendarProvider,
) {
  const source = db
    .prepare("SELECT * FROM CalendarConnection WHERE id=? AND userId=?")
    .get(id, USER) as unknown as SyncSource | undefined;
  if (!source) throw new Error("Kalender nicht gefunden.");
  const token = crypto.randomUUID(),
    now = Date.now();
  const lease = db
    .prepare(
      "UPDATE CalendarConnection SET syncToken=?,syncLeaseUntil=?,lastAttemptAt=? WHERE id=? AND userId=? AND syncLeaseUntil<=?",
    )
    .run(token, now + 120000, new Date(now).toISOString(), id, USER, now);
  if (!lease.changes)
    throw new Error("Dieser Kalender wird bereits synchronisiert.");
  try {
    const provider = overrideProvider || calendarProviders[source.provider];
    if (!provider) throw new Error("Kalenderanbieter nicht verfügbar.");
    const events = await provider.sync(source);
    transaction(() => {
      // A removed connection or an expired/replaced lease must never be resurrected.
      const result = db
        .prepare(
          "UPDATE CalendarConnection SET lastSynced=?,lastError=?,syncLeaseUntil=0,syncToken=? WHERE id=? AND syncToken=?",
        )
        .run(new Date().toISOString(), "", "", id, token);
      if (!result.changes)
        throw new Error(
          "Kalender wurde entfernt oder inzwischen neu synchronisiert.",
        );
      replaceEvents(id, events);
    });
    return events.length;
  } catch (error) {
    db.prepare(
      "UPDATE CalendarConnection SET lastError=?,syncLeaseUntil=0,syncToken=? WHERE id=? AND syncToken=?",
    ).run(
      "Aktualisierung fehlgeschlagen. Bestehende Termine bleiben erhalten. Neuer Versuch in 5 Minuten.",
      "",
      id,
      token,
    );
    throw error;
  }
}
export async function syncDueCalendars(provider?: CalendarProvider) {
  const sources = db
    .prepare(
      "SELECT * FROM CalendarConnection WHERE userId=? AND sourceType='url'",
    )
    .all(USER) as unknown as SyncSource[];
  for (const source of sources) {
    if (!isSyncDue(source)) continue;
    try {
      await syncConnection(source.id, provider);
    } catch {
      /* Retry metadata is persisted; do not log subscription URLs. */
    }
  }
}
