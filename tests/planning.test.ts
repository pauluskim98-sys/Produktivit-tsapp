import test from "node:test";
import assert from "node:assert/strict";
import { repeatDates } from "../lib/repeat.ts";
import { gridMinute, clockMinute, splitAtSix } from "../lib/schedule.ts";
import { validatePlanItems } from "../lib/ai-plan.ts";
test("06–24 first, early hours last, mappings and split preserve calendar date", () => {
  assert.equal(gridMinute(360), 0);
  assert.equal(gridMinute(0), 1080);
  assert.equal(clockMinute(0), 360);
  assert.equal(clockMinute(1080), 0);
  for (let minute = 0; minute < 1440; minute += 15)
    assert.equal(clockMinute(gridMinute(minute)), minute);
  assert.deepEqual(splitAtSix(300, 420), [
    { start: 360, end: 420 },
    { start: 300, end: 360 },
  ]);
});
test("weekday repeats skip source and remain stable across DST", () => {
  assert.deepEqual(repeatDates("2026-10-24", [0, 2], 2), [
    "2026-10-26",
    "2026-10-28",
    "2026-11-02",
    "2026-11-04",
  ]);
  assert.throws(() => repeatDates("2026-10-24", [7], 4));
  assert.throws(() => repeatDates("2026-10-24", [0], 53));
});
test("AI suggestions validate complete tasks and reject out-of-range or incomplete blocks", () => {
  const item = {
    title: "Lernen",
    description: "Kapitel 1",
    plannedDate: "2026-10-12",
    time: "10:00",
    duration: 60,
    color: "blue",
  };
  assert.equal(
    validatePlanItems([item], "2026-10-10", "2026-11-10")[0].title,
    "Lernen",
  );
  assert.throws(() =>
    validatePlanItems(
      [{ ...item, plannedDate: "2026-12-01" }],
      "2026-10-10",
      "2026-11-10",
    ),
  );
  assert.throws(() =>
    validatePlanItems(
      [{ ...item, duration: null }],
      "2026-10-10",
      "2026-11-10",
    ),
  );
  assert.throws(() =>
    validatePlanItems([{ ...item, time: "25:00" }], "2026-10-10", "2026-11-10"),
  );
  assert.throws(() =>
    validatePlanItems(Array(81).fill(item), "2026-10-10", "2026-11-10"),
  );
});

test("Day overview detects overlaps without pretending to be AI", async () => {
  const { dayAssessment } = await import("../lib/day-assessment.ts");
  const tasks = [
    { time: "10:00", duration: 90, done: false },
    { time: "11:00", duration: 60, done: false },
    { time: "", duration: null, done: false },
  ] as import("../lib/types.ts").Todo[];
  const result = dayAssessment(tasks, [], "2026-10-12");
  assert.match(result[0], /3 offene Aufgaben, davon 1/);
  assert.ok(result.some((t) => t.includes("überschneiden")));
});
