import test from "node:test";
import assert from "node:assert/strict";
import { parseAppointmentInput } from "../lib/appointment-input.ts";
import { mapsAddress } from "../lib/addresses.ts";
import { taskSegment, totalDuration } from "../lib/schedule.ts";
import type { Todo } from "../lib/types.ts";
test("address moves from title into description and maps URL", () => {
  const result = parseAppointmentInput(
    "Konzert 16.10.2026 19:00 Venloer Straße 40, 50672 Köln",
    "2026-10-12",
  );
  assert.equal(result.title, "Konzert");
  assert.equal(result.location, "Venloer Straße 40, 50672 Köln");
  assert.equal(result.description, "Adresse: Venloer Straße 40, 50672 Köln");
  assert.equal(
    new URL(mapsAddress(result.location)).searchParams.get("query"),
    result.location,
  );
});
test("travel extends occupied time while keeping appointment start and duration", () => {
  const todo = {
    plannedDate: "2026-10-16",
    time: "10:00",
    duration: 60,
    travelBefore: 20,
    travelAfter: 30,
  } as Todo;
  assert.equal(totalDuration(todo), 110);
  assert.equal(taskSegment(todo, "2026-10-16")?.start, 580);
  assert.equal(taskSegment(todo, "2026-10-16")?.end, 690);
  assert.equal(todo.time, "10:00");
  assert.equal(todo.duration, 60);
});
test("travel before midnight belongs to previous day", () => {
  const todo = {
    plannedDate: "2026-10-16",
    time: "00:15",
    duration: 60,
    travelBefore: 30,
    travelAfter: 10,
  } as Todo;
  assert.equal(taskSegment(todo, "2026-10-15")?.start, 1425);
  assert.equal(taskSegment(todo, "2026-10-15")?.end, 1440);
});
