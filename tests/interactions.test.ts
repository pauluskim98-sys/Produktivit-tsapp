import test from "node:test";
import assert from "node:assert/strict";
import {
  periodRange,
  nextTask,
  shiftTasks,
} from "../lib/calendar-interactions.ts";
import type { Todo } from "../lib/types.ts";
const task = (id: string, day: string, time: string) =>
  ({
    description:"",done:false,priority:"none",deadline:null,tags:[],position:0,createdAt:"2026-10-11T00:00:00Z",
    id,
    plannedDate: day,
    time,
    duration: 60,
    subtasks: [],
    title: id,
    color: "blue",
    notes: "keep",
  }) as Todo;
test("period keys distinguish notes and respect calendar boundaries", () => {
  assert.equal(periodRange("month:2028-02-15")?.days.length, 29);
  assert.equal(periodRange("week:2026-10-11")?.start, "2026-10-05");
  assert.equal(periodRange("2026-10-11")?.days.length, 1);
  assert.equal(periodRange("month:2026-02-30"), null);
  assert.equal(periodRange("invalid:2026-10-11"), null);
});
test("arrows select closest block in the intended direction", () => {
  const t = [
    task("a", "2026-10-05", "09:00"),
    task("b", "2026-10-05", "11:00"),
    task("c", "2026-10-06", "09:30"),
    task("d", "2026-10-06", "16:00"),
  ];
  assert.equal(nextTask(t, "a", "ArrowDown"), "b");
  assert.equal(nextTask(t, "b", "ArrowUp"), "a");
  assert.equal(nextTask(t, "a", "ArrowRight"), "c");
  assert.equal(nextTask(t, "c", "ArrowLeft"), "a");
  assert.equal(nextTask(t, "a", "ArrowLeft"), null);
});
test("group moves retain spacing across midnight and copies have fresh identities", () => {
  const a = task("a", "2026-10-24", "23:00"),
    b = task("b", "2026-10-25", "01:00");
  const moved = shiftTasks([a, b], a, "2026-10-25", "22:00");
  assert.equal(moved[1].plannedDate, "2026-10-26");
  assert.equal(moved[1].time, "00:00");
  assert.equal(moved[0].id, "a");
  assert.equal(moved[0].notes, "keep");
  const copied = shiftTasks([a, b], a, "2026-10-26", "23:00", true);
  assert.notEqual(copied[0].id, "a");
  assert.equal(copied[1].plannedDate, "2026-10-27");
  assert.equal(a.plannedDate, "2026-10-24");
});
