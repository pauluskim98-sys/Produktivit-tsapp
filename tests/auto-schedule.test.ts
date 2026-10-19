import test from "node:test";
import assert from "node:assert/strict";
import { autoSchedule } from "../lib/auto-schedule.ts";
import type { Todo, CalendarEvent } from "../lib/types.ts";
const task = (id: string, patch: Partial<Todo> = {}) =>
  ({
    id,
    title: id,
    done: false,
    priority: "low",
    plannedDate: null,
    time: "",
    duration: 60,
    deadline: null,
    position: 1,
    ...patch,
  }) as Todo;
const event = (start: string, end: string, allDay = false) =>
  ({
    id: "event",
    start: allDay ? start : new Date(start).toISOString(),
    end: allDay ? end : new Date(end).toISOString(),
    allDay,
  }) as CalendarEvent;
const range = { start: "2026-10-19", end: "2026-10-25" },
  now = new Date("2026-10-19T07:00");
test("auto planning respects priorities, fixed appointments, travel and breaks", () => {
  const existing = task("occupied", {
    plannedDate: range.start,
    time: "08:00",
    duration: 60,
    travelAfter: 15,
  });
  const requests = [
    task("low"),
    task("high", { priority: "high", duration: 90, travelBefore: 15 }),
  ];
  const result = autoSchedule(
    requests,
    [existing, ...requests],
    [event("2026-10-19T12:00", "2026-10-19T13:00")],
    range,
    now,
  );
  assert.equal(result.scheduled[0].id, "high");
  assert.equal(result.scheduled[0].time, "09:45");
  assert.equal(result.scheduled[1].time, "13:15");
  assert.equal(requests[0].plannedDate, null);
  assert.equal(existing.time, "08:00");
});
test("unplaceable tasks stay unplanned; deadline and all-day events are respected", () => {
  const requests = [
    task("too-long", { duration: 900 }),
    task("deadline", { deadline: "2026-10-19" }),
    task("next"),
  ];
  const r = autoSchedule(
    requests,
    requests,
    [event("2026-10-19", "2026-10-20", true)],
    range,
    now,
  );
  assert.deepEqual(
    r.skipped.map((t) => t.id),
    ["deadline", "too-long"],
  );
  assert.equal(r.scheduled[0].plannedDate, "2026-10-20");
});
test("today is never planned into the past and explicit days/times are retained", () => {
  const r = autoSchedule(
    [
      task("now"),
      task("fixed", { plannedDate: "2026-10-21", time: "16:00", duration: 90 }),
    ],
    [],
    [],
    range,
    new Date("2026-10-19T14:07"),
  );
  assert.equal(r.scheduled.find((t) => t.id === "now")?.time, "14:15");
  assert.equal(
    r.scheduled.find((t) => t.id === "fixed")?.plannedDate,
    "2026-10-21",
  );
  assert.equal(r.scheduled.find((t) => t.id === "fixed")?.time, "16:00");
  assert.equal(
    autoSchedule(
      [task("past")],
      [],
      [],
      { start: "2026-10-01", end: "2026-10-05" },
      now,
    ).skipped.length,
    1,
  );
});
test("overnight occupancy and own current slot do not create overlaps", () => {
  const requested = task("own", { plannedDate: range.start, time: "08:00" });
  const overnight = task("night", {
    plannedDate: "2026-10-18",
    time: "23:00",
    duration: 600,
  });
  const r = autoSchedule([requested], [requested, overnight], [], range, now);
  assert.equal(r.scheduled[0].time, "09:15");
});
