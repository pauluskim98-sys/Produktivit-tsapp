import test from "node:test";
import assert from "node:assert/strict";
import { notePeriod, putInNoteTodo, waitingNoteTodo } from "../lib/note-todos.ts";
import { tabEmoji } from "../lib/tab-emoji.ts";
import type { Todo } from "../lib/types.ts";

test("unfinished calendar to-dos return only after their scheduled day", () => {
  const todo = { tags: ["note-todo:week"], plannedDate: "2026-11-06", done: false };
  assert.equal(waitingNoteTodo(todo, "2026-11-06"), false);
  assert.equal(waitingNoteTodo(todo, "2026-11-07"), true);
  assert.equal(waitingNoteTodo({ ...todo, done: true }, "2026-11-07"), false);
  assert.equal(waitingNoteTodo({ ...todo, tags: [] }, "2026-11-07"), false);
});

test("moving a task to a board cell clears its previous scheduling tags", () => {
  const todo = { tags: ["note-todo:week", "h:week", "d:2026-11-06", "auto:day", "work"], plannedDate: "2026-11-06", time: "13:00" } as Todo;
  const moved = putInNoteTodo(todo, "month", true, 2);
  assert.equal(notePeriod(moved), "month");
  assert.equal(moved.priority, "high");
  assert.equal(moved.position, 2);
  assert.equal(moved.plannedDate, null);
  assert.equal(moved.time, "");
  assert.deepEqual(moved.tags, ["work", "note-todo:month"]);
});

test("tab symbols accept a single emoji including joined and modified forms", () => {
  for (const emoji of ["🎨", "👩🏽‍💻", "🇩🇪", "1️⃣"]) assert.equal(tabEmoji(emoji), true);
  for (const value of ["🎨🎓", "A", "<svg>", ""]) assert.equal(tabEmoji(value), false);
});
