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
    description: "",
    done: false,
    priority: "none",
    deadline: null,
    tags: [],
    position: 0,
    createdAt: "2026-10-11T00:00:00Z",
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

import { NavigationStack } from "../lib/navigation-stack.ts";
import { wheelSwipe, emptySwipe } from "../lib/calendar-swipe.ts";
import { taskColorForKey, TASK_COLOR_VALUES } from "../lib/task-colors.ts";
import { moveTaskGroup } from "../lib/calendar-interactions.ts";
test("view navigation is bounded to four shared steps and supports forward", () => {
  const history = new NavigationStack(),
    owner = {};
  let view = 0;
  for (let i = 1; i <= 6; i++) {
    const before = i - 1,
      after = i;
    history.push({
      owner,
      before: String(before),
      back: () => (view = before),
      forward: () => (view = after),
    });
    view = i;
  }
  for (let i = 0; i < 4; i++) assert.equal(history.back(), true);
  assert.equal(view, 2);
  assert.equal(history.back(), false);
  assert.equal(history.forward(), true);
  assert.equal(view, 3);
  history.push({
    owner,
    before: "3",
    back: () => (view = 3),
    forward: () => (view = 9),
  });
  assert.equal(history.forward(), false);
});
test("trackpad momentum changes one page, renewed swipes respond immediately", () => {
  const g = emptySwipe();
  assert.equal(wheelSwipe(g, 130, 1000), 0);
  assert.equal(wheelSwipe(g, 100, 1016), 1);
  for (let i = 0; i < 10; i++)
    assert.equal(wheelSwipe(g, 10 - i, 1032 + i * 16), 0);
  assert.equal(wheelSwipe(g, 100, 1210), 0);
  assert.equal(wheelSwipe(g, 130, 1226), 1);
  assert.equal(wheelSwipe(g, -230, 1242), -1);
});
test("only a strong sustained swipe advances several pages", () => {
  const g = emptySwipe();
  assert.equal(wheelSwipe(g, 250, 1000), 1);
  assert.equal(wheelSwipe(g, 200, 1016), 0);
  assert.equal(wheelSwipe(g, 200, 1032), 1);
  assert.equal(wheelSwipe(g, 460, 1048), 1);
});
test("all ten color keys map to their palette position", () => {
  assert.deepEqual(
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(taskColorForKey),
    TASK_COLOR_VALUES,
  );
  assert.equal(taskColorForKey("a"), undefined);
});
test("unplanned task groups can be scheduled together without invalid dates", () => {
  const a = {
    ...task("a", "2026-10-11", "10:00"),
    plannedDate: null,
    time: "",
  };
  const b = { ...a, id: "b" };
  const moved = moveTaskGroup([a, b], a, "2026-10-13", "11:30");
  assert.deepEqual(
    moved.map((t) => [t.plannedDate, t.time]),
    [
      ["2026-10-13", "11:30"],
      ["2026-10-13", "11:30"],
    ],
  );
});
