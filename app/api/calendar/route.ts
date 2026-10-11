import { db, transaction, USER } from "@/lib/db";
import { calendarProviders } from "@/lib/calendar/ics";
import type { CalendarSource } from "@/lib/calendar/provider";
import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
import { syncConnection, replaceEvents } from "@/lib/calendar/sync";
const colors = ["#97a9c4", "#bcaa82", "#8eac98", "#ae9dbd"];
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const provider = calendarProviders.ics;
    if (body.action === "disconnect") {
      const source = db
        .prepare("SELECT * FROM CalendarConnection WHERE id=? AND userId=?")
        .get(body.id, USER) as unknown as CalendarSource | undefined;
      if (!source) throw new Error("Kalender nicht gefunden.");
      await provider.disconnect(source);
      db.prepare("DELETE FROM CalendarConnection WHERE id=? AND userId=?").run(
        body.id,
        USER,
      );
      return Response.json({ message: "Kalender entfernt." });
    }
    let source: CalendarSource;
    if (body.action === "sync") {
      const count = await syncConnection(body.id);
      return Response.json({
        message: `${count} Termine aktualisiert.`,
        count,
      });
    } else if (body.action === "connect") {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 80
      )
        throw new Error("Bitte einen Kalendernamen eingeben.");
      if (typeof (body.url || body.content) !== "string")
        throw new Error("Bitte eine ICS-Datei oder Kalenderadresse angeben.");
      const count = (
        db
          .prepare("SELECT COUNT(*) as count FROM CalendarConnection")
          .get() as { count: number }
      ).count;
      source = {
        id: crypto.randomUUID(),
        name: body.name.trim(),
        sourceType: body.url ? "url" : "file",
        source: body.url || body.content,
        color: colors[count % colors.length],
      };
    } else throw new Error("Unbekannte Aktion.");
    const events = await provider.connect(source);
    transaction(() => {
      db.prepare(
        "INSERT INTO CalendarConnection (id,userId,name,provider,sourceType,source,color,lastSynced) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET lastSynced=excluded.lastSynced",
      ).run(
        source.id,
        USER,
        source.name,
        "ics",
        source.sourceType,
        source.source,
        source.color,
        new Date().toISOString(),
      );
      replaceEvents(source.id, events);
    });
    return Response.json({
      message: `${events.length} Termine importiert.`,
      count: events.length,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
