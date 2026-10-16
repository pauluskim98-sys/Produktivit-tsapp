import test from "node:test";
import assert from "node:assert/strict";
import { freeTime } from "../lib/free-time.ts";
import type { Todo, CalendarEvent } from "../lib/types.ts";
test("free time combines overlapping task, travel and imported intervals", () => {
  const tasks = [
    {
      plannedDate: "2026-10-16",
      time: "10:00",
      duration: 60,
      travelBefore: 30,
      travelAfter: 30,
    },
    { plannedDate: "2026-10-16", time: "", duration: 60 },
  ] as Todo[];
  const events = [
    { start: "2026-10-16T10:30:00", end: "2026-10-16T12:00:00", allDay: false },
    { start: "2026-10-16", end: "2026-10-17", allDay: true },
  ] as CalendarEvent[];
  assert.deepEqual(freeTime(["2026-10-16"], tasks, events), {
    available: 18,
    occupied: 2.5,
    free: 15.5,
  });
});
test("night time is excluded and multi-day events are clipped to each day", () => {
  const tasks = [
    { plannedDate: "2026-10-15", time: "23:00", duration: 480 },
  ] as Todo[];
  const events = [
    { start: "2026-10-16T23:00:00", end: "2026-10-17T07:00:00", allDay: false },
  ] as CalendarEvent[];
  assert.deepEqual(freeTime(["2026-10-16", "2026-10-17"], tasks, events), {
    available: 36,
    occupied: 3,
    free: 33,
  });
});
