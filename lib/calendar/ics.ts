import ICAL from "ical.js";
import { createHash } from "node:crypto";
import type { CalendarEvent } from "../types";
import type { CalendarProvider, CalendarSource } from "./provider";
import { fetchCalendar } from "./fetch.ts";
function stamp(time: ICAL.Time, tzid?: string): string {
  if (time.isDate) return time.toString().slice(0, 10);
  if (tzid && time.zone.tzid === "floating") {
    // Some feeds use IANA TZIDs without shipping VTIMEZONE components.
    try {
      const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: tzid,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
      const wall = Date.UTC(
        time.year,
        time.month - 1,
        time.day,
        time.hour,
        time.minute,
        time.second,
      );
      let utc = wall;
      for (let i = 0; i < 3; i++) {
        const p = Object.fromEntries(
          fmt.formatToParts(new Date(utc)).map((p) => [p.type, p.value]),
        );
        const represented = Date.UTC(
          +p.year,
          +p.month - 1,
          +p.day,
          +p.hour,
          +p.minute,
          +p.second,
        );
        utc += wall - represented;
      }
      return new Date(utc).toISOString();
    } catch {
      throw new Error(
        `Die Zeitzone „${tzid}“ ist unbekannt. Bitte einen Kalender mit VTIMEZONE exportieren.`,
      );
    }
  }
  return time.toJSDate().toISOString();
}
export function parseICS(
  content: string,
  connectionId: string,
  now = new Date(),
): CalendarEvent[] {
  if (content.length > 2 * 1024 * 1024 || !content.includes("BEGIN:VCALENDAR"))
    throw new Error(
      "Bitte eine gültige ICS-Datei mit höchstens 2 MB importieren.",
    );
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(content));
  } catch {
    throw new Error("Die ICS-Datei konnte nicht gelesen werden.");
  }
  const zones = root.getAllSubcomponents("vtimezone");
  zones.forEach((zone) => ICAL.TimezoneService.register(zone));
  const lower = new Date(now);
  lower.setFullYear(lower.getFullYear() - 1);
  const upper = new Date(now);
  upper.setFullYear(upper.getFullYear() + 2);
  const components = root.getAllSubcomponents("vevent");
  if (components.length > 10000)
    throw new Error("Der Kalender enthält zu viele Termine.");
  const events: CalendarEvent[] = [];
  let iterations = 0;
  for (const component of components) {
    if (component.getFirstPropertyValue("recurrence-id")) continue;
    if (component.getFirstPropertyValue("status") === "CANCELLED") continue;
    if (!component.getFirstProperty("dtstart")) continue;
    const event = new ICAL.Event(component);
    const exceptions = components.filter(
      (c) =>
        c.getFirstPropertyValue("uid") === event.uid &&
        c.getFirstPropertyValue("recurrence-id"),
    );
    exceptions.forEach((c) => event.relateException(new ICAL.Event(c)));
    const iterator = event.iterator();
    let occurrence: ICAL.Time | null;
    while ((occurrence = iterator.next())) {
      if (++iterations > 50000)
        throw new Error(
          "Zu viele Wiederholungen. Bitte einen kürzeren Kalenderzeitraum exportieren.",
        );
      if (occurrence.toJSDate() > upper) break;
      const details = event.getOccurrenceDetails(occurrence);
      const item = details.item;
      if (item.component.getFirstPropertyValue("status") === "CANCELLED")
        continue;
      const tzid = item.component
        .getFirstProperty("dtstart")
        ?.getParameter("tzid") as string | undefined;
      const start = stamp(details.startDate, tzid);
      let end = stamp(details.endDate, tzid);
      if (details.endDate.toJSDate() < lower) continue;
      if (start === end) {
        if (details.startDate.isDate) {
          const next = details.startDate.clone();
          next.adjust(1, 0, 0, 0);
          end = stamp(next);
        } else end = new Date(new Date(start).getTime() + 60000).toISOString();
      }
      events.push({
        id: createHash("sha256")
          .update(
            `${connectionId}:${event.uid || component.toString()}:${occurrence.toString()}`,
          )
          .digest("hex"),
        connectionId,
        title: item.summary || "Ohne Titel",
        start,
        end,
        allDay: details.startDate.isDate,
        location: item.location || "",
        description: item.description || "",
      });
      if (events.length > 10000)
        throw new Error(
          "Der Kalender enthält mehr als 10.000 Termine im Importzeitraum.",
        );
      if (!event.isRecurring()) break;
    }
  }
  return [...new Map(events.map((event) => [event.id, event])).values()];
}
export class ICSProvider implements CalendarProvider {
  readonly id = "ics";
  async connect(source: CalendarSource) {
    return this.getEvents(source);
  }
  async getEvents(source: CalendarSource) {
    return parseICS(
      source.sourceType === "url"
        ? await fetchCalendar(source.source)
        : source.source,
      source.id,
    );
  }
  async sync(source: CalendarSource) {
    return this.getEvents(source);
  }
  async disconnect(_source: CalendarSource) {}
}
export const calendarProviders: Record<string, CalendarProvider> = {
  ics: new ICSProvider(),
};
