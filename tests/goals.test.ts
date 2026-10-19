import test from "node:test";
import assert from "node:assert/strict";
import { goalRange, goalProgress, matchesGoal } from "../lib/goals.ts";
import type { Todo, CalendarEvent } from "../lib/types.ts";
const task = (extra: Partial<Todo>) =>
  ({
    id: "t",
    title: "Lernen",
    tags: ["c:sport"],
    plannedDate: "2026-10-19",
    time: "10:00",
    duration: 120,
    done: false,
    ...extra,
  }) as Todo;
test("goals use real calendar week, month and year boundaries", () => {
  assert.deepEqual(goalRange("2026-10-21", "week"), {
    start: "2026-10-19",
    end: "2026-10-25",
  });
  assert.deepEqual(goalRange("2028-02-10", "month"), {
    start: "2028-02-01",
    end: "2028-02-29",
  });
  assert.deepEqual(goalRange("2026-10-19", "year"), {
    start: "2026-01-01",
    end: "2026-12-31",
  });
});
test("hour goals distinguish planned, elapsed and explicitly completed time", () => {
  const tasks = [
    task({}),
    task({ id: "future", plannedDate: "2026-10-20", done: true, duration: 60 }),
    task({ id: "undated", plannedDate: null }),
    task({ id: "other", tags: ["c:events"] }),
  ];
  const p = goalProgress(
    { id: "sport", name: "Sport" },
    { target: 4, unit: "hours" },
    tasks,
    [],
    goalRange("2026-10-19", "week"),
    new Date("2026-10-19T11:00"),
  );
  assert.equal(p.planned, 3);
  assert.equal(p.completed, 2);
  assert.equal(p.plannedPercent, 75);
  assert.equal(p.completedPercent, 50);
});
test("count goals and named calendar events include only the selected period", () => {
  const event = {
    id: "e",
    title: "Sport im Park",
    start: new Date("2026-10-19T08:00").toISOString(),
    end: new Date("2026-10-19T09:00").toISOString(),
    allDay: false,
  } as CalendarEvent;
  const tasks = [
    task({ duration: 60 }),
    task({
      id: "end",
      plannedDate: "2026-10-25",
      time: "23:30",
      duration: 120,
    }),
    task({ id: "next", plannedDate: "2026-10-26" }),
  ];
  const range = goalRange("2026-10-19", "week"),
    now = new Date("2026-10-19T11:30");
  const p = goalProgress(
    { id: "sport", name: "Sport" },
    { target: 2, unit: "times" },
    tasks,
    [event],
    range,
    now,
  );
  assert.equal(p.planned, 3);
  assert.equal(p.completed, 2);
  assert.equal(p.plannedPercent, 100);
  const h = goalProgress(
    { id: "sport", name: "Sport" },
    { target: 5, unit: "hours" },
    tasks,
    [],
    range,
    now,
  );
  assert.equal(h.planned, 1.5);
});
test("legacy rhythm and contact tasks retain categories; custom categories match tags", () => {
  assert.equal(
    matchesGoal(task({ tags: ["r:abc"] }), { id: "music", name: "Musik" }, [
      { id: "abc", tabId: "music" },
    ]),
    true,
  );
  assert.equal(
    matchesGoal(task({ tags: ["k:friend"] }), {
      id: "social",
      name: "Beziehungen",
    }),
    true,
  );
  assert.equal(
    matchesGoal(task({ tags: ["Bücher"] }), { id: "custom", name: "Bücher" }),
    true,
  );
  assert.equal(
    matchesGoal(task({ tags: ["h:week"] }), { id: "todo", name: "Todo" }),
    true,
  );
});
