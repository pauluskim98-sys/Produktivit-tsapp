import test from "node:test";
import assert from "node:assert/strict";
import { mapTodoistTask, mergeTodoistTask } from "../lib/todoist-mapping.ts";
import { openWeekCount } from "../lib/week-tasks.ts";
const now = "2026-10-14T10:00:00Z";
const map = (extra = {}) =>
  mapTodoistTask({ id: "abc", content: "Aufgabe", ...extra }, 1, now);
test("dated Todoist tasks are unscheduled tasks of the correct Berlin day, not calendar blocks", () => {
  const t = map({
    due: { date: "2026-10-14T23:30:00Z" },
    duration: { amount: 90, unit: "minute" },
    priority: 4,
  });
  assert.equal(t.plannedDate, "2026-10-15");
  assert.equal(t.time, "");
  assert.equal(t.duration, 90);
  assert.equal(t.priority, "high");
  assert.match(t.description, /01:30/);
});
test("week-only and undated tasks go to the week inbox; concrete due dates stay on their day", () => {
  for (const extra of [
    {},
    { due: { string: "diese Woche", date: "2026-10-18" } },
  ]) {
    const t = map(extra);
    assert.equal(t.plannedDate, null);
    assert.ok(t.tags.includes("h:week"));
  }
  assert.equal(map({ due: { date: "2026-10-14" } }).plannedDate, "2026-10-14");
});
test("remote refresh preserves local calendar placement and edited title", () => {
  const before = map(),
    local = {
      ...before,
      title: "Mein Titel",
      plannedDate: "2026-10-15",
      time: "15:00",
    };
  const merged = mergeTodoistTask(local, before, {
    ...before,
    title: "Remote",
    description: "Neu",
  });
  assert.equal(merged.title, "Mein Titel");
  assert.equal(merged.plannedDate, local.plannedDate);
  assert.equal(merged.time, "15:00");
  assert.equal(merged.description, "Neu");
});
test("week badge counts open dated and week-inbox tasks but no completed, month, or other-week tasks", () => {
  const todos = [
    map(),
    map({ due: { date: "2026-10-14" } }),
    { ...map(), done: true },
    { ...map(), tags: ["h:month"] },
    map({ due: { date: "2026-10-21" } }),
  ];
  assert.equal(openWeekCount(todos, ["2026-10-14"]), 2);
});
