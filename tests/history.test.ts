import test from "node:test";
import assert from "node:assert/strict";
import { applyHistoryDelta } from "../lib/history-delta.ts";
test("undo/redo changes only edited fields and keeps new contact timestamps", () => {
  const before = {
    friends: [
      { id: "p", name: "Peter", lastContact: "2026-10-01", interval: 14 },
    ],
    groups: [],
  };
  const after = {
    ...before,
    friends: [{ ...before.friends[0], interval: 7 }],
    groups: [{ id: "g", name: "Freunde" }],
  };
  const current = {
    ...after,
    friends: [{ ...after.friends[0], lastContact: "2026-10-11" }],
  };
  const undo = applyHistoryDelta(current, after, before);
  assert.equal(undo.friends[0].interval, 14);
  assert.equal(undo.friends[0].lastContact, "2026-10-11");
  assert.deepEqual(undo.groups, []);
  assert.deepEqual(applyHistoryDelta(undo, before, after), current);
  assert.throws(() =>
    applyHistoryDelta(
      { ...current, friends: [{ ...current.friends[0], interval: 20 }] },
      after,
      before,
    ),
  );
});
import { priorityOrder } from "../lib/priority-order.ts";
import type { Todo } from "../lib/types.ts";
test("yellow above high becomes first yellow; rank order and equal positions stay stable", () => {
  const task = (id: string, priority: Todo["priority"], position: number) =>
    ({
      id,
      priority,
      position,
      plannedDate: null,
      done: false,
      tags: [],
    }) as unknown as Todo;
  const tasks = [
    task("red", "high", 1),
    task("yellow", "medium", 1),
    task("low1", "low", 1),
    task("low2", "low", 1),
  ];
  const result = priorityOrder(tasks, tasks[3], "red", "medium", "week");
  assert.deepEqual(
    result.map((t) => t.id),
    ["red", "low2", "yellow", "low1"],
  );
  const next = priorityOrder(tasks, tasks[3], "low1", "low", "week");
  assert.deepEqual(
    next.map((t) => t.id),
    ["red", "yellow", "low2", "low1"],
  );
  assert.equal(new Set(next.map((t) => t.position)).size, 4);
});
