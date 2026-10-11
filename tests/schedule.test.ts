import test from "node:test";
import assert from "node:assert/strict";
import {
  creationRange,
  scheduleAt,
  resizeSchedule,
  taskSegment,
  layoutIntervals,
} from "../lib/schedule.ts";
import type { Todo } from "../lib/types.ts";
test("drop snaps to quarter hours, preserves duration and bounds start", () => {
  assert.deepEqual(scheduleAt(553, 90), { time: "09:15", duration: 90 });
  assert.deepEqual(scheduleAt(-40), { time: "00:00", duration: 60 });
  assert.deepEqual(scheduleAt(1450, 180), { time: "23:45", duration: 180 });
});
test("resize keeps opposite edge fixed and prevents inversion", () => {
  assert.deepEqual(resizeSchedule("09:00", 60, "start", 30), {
    time: "09:30",
    duration: 30,
  });
  assert.deepEqual(resizeSchedule("09:00", 60, "end", 60), {
    time: "09:00",
    duration: 120,
  });
  assert.deepEqual(resizeSchedule("09:00", 60, "end", -100), {
    time: "09:00",
    duration: 15,
  });
  assert.deepEqual(resizeSchedule("23:00", 60, "end", 120), {
    time: "23:00",
    duration: 60,
  });
});
test("midnight segments use calendar days across DST", () => {
  const todo = {
    plannedDate: "2026-10-24",
    time: "23:30",
    duration: 120,
  } as Todo;
  assert.deepEqual(taskSegment(todo, "2026-10-25"), {
    start: 0,
    end: 90,
    offset: 1440,
    continuesBefore: true,
    continuesAfter: false,
  });
  assert.equal(taskSegment(todo, "2026-10-26"), null);
});
test("overlaps share lanes; adjacent and separate groups reclaim width", () => {
  const layout = layoutIntervals([
    { id: "a", start: 60, end: 180 },
    { id: "b", start: 120, end: 240 },
    { id: "c", start: 180, end: 210 },
    { id: "d", start: 240, end: 300 },
  ]);
  assert.equal(layout.find((x) => x.id === "a")?.lanes, 2);
  assert.equal(layout.find((x) => x.id === "c")?.lane, 0);
  assert.equal(layout.find((x) => x.id === "d")?.lanes, 1);
});

test("creation draws the same range in either direction and snaps to 15 minutes", () => {
  assert.deepEqual(creationRange(182, 301), {
    start: 180,
    end: 300,
    time: "09:00",
    duration: 120,
  });
  assert.deepEqual(creationRange(301, 182), creationRange(182, 301));
  assert.equal(creationRange(180, 180).duration, 15);
  assert.deepEqual(creationRange(1050, 1110), {
    start: 1050,
    end: 1110,
    time: "23:30",
    duration: 60,
  });
  assert.deepEqual(creationRange(1200, 1230), {
    start: 1200,
    end: 1230,
    time: "02:00",
    duration: 30,
  });
  assert.deepEqual(creationRange(1500, 1500), {
    start: 1425,
    end: 1440,
    time: "05:45",
    duration: 15,
  });
});
