import test from "node:test";
import assert from "node:assert/strict";
import { parseICS } from "../lib/calendar/ics.ts";
import { applyCalendarRules, type CalendarRule } from "../lib/calendar/overrides.ts";

test("calendar rules distinguish occurrences, series and title groups across syncs", () => {
  const source = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:series",
    "DTSTART:20261105T090000Z", "DTEND:20261105T100000Z",
    "RRULE:FREQ=WEEKLY;COUNT=2", "SUMMARY:Training", "END:VEVENT",
    "BEGIN:VEVENT", "UID:single", "DTSTART:20261106T090000Z",
    "DTEND:20261106T100000Z", "SUMMARY:Training", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const parse = (id: string) => parseICS(source, id, new Date("2026-11-05"));
  const events = parse("own");
  const series = events.filter((event) => event.seriesId);
  assert.equal(series.length, 2);
  assert.equal(series[0].seriesId, series[1].seriesId);
  assert.notEqual(series[0].id, series[1].id);
  const group: CalendarRule = { connectionId: "own", kind: "group", key: "training", label: "Sport", title: "", color: "#123456", hidden: 0 };
  const occurrence: CalendarRule = { ...group, kind: "event", key: series[0].id, title: "Probe", color: "#654321" };
  const edited = applyCalendarRules([...events, ...parse("other")], [occurrence, group]);
  assert.equal(edited.find((event) => event.id === occurrence.key)?.color, "#654321");
  assert.equal(edited.find((event) => event.id === series[1].id)?.group, "Sport");
  assert.ok(edited.filter((event) => event.connectionId === "other").every((event) => !event.color));
  assert.equal(applyCalendarRules(events, [{ ...occurrence, hidden: 1 }]).length, 2);
  assert.equal(applyCalendarRules(parse("own"), [{ ...occurrence, kind: "series", key: series[0].seriesId!, hidden: 1 }]).length, 1);
});
