import test from "node:test";
import assert from "node:assert/strict";
import { applyTaskTemplate, templateSettings } from "../lib/task-templates.ts";
import type { Todo } from "../lib/types.ts";

const task: Todo = { id: "new-task", title: "", description: "", notes: "", done: false, priority: "none", plannedDate: "2026-11-21", time: "14:30", duration: 45, deadline: null, tags: [], subtasks: [], position: 3, createdAt: "2026-11-21" };
const settings = { color: "blue" as const, description: "Bücher mitbringen", plannedDate: "2026-10-01", time: "09:00", duration: 90, subtasks: [{ id: "old", title: "Lesen", done: true }] };

test("a selected calendar cell wins over template scheduling while appearance is reused", () => {
  const result = applyTaskTemplate(task, { category: "learning", title: "Lernen", uses: 2, settings }, true);
  assert.equal(result.plannedDate, task.plannedDate);
  assert.equal(result.time, task.time);
  assert.equal(result.duration, task.duration);
  assert.equal(result.color, "blue");
  assert.equal(result.description, settings.description);
  assert.equal(result.id, task.id);
  assert.equal(result.subtasks[0].done, false);
  assert.notEqual(result.subtasks[0].id, "old");
  assert.ok(result.tags.includes("c:learning"));
});

test("without a chosen cell templates supply scheduling; old title-only templates still work", () => {
  assert.equal(applyTaskTemplate(task, { category: "learning", title: "Lernen", uses: 1, settings }, false).time, "09:00");
  const legacy = applyTaskTemplate(task, { category: "learning", title: "Lernen", uses: 1 }, true);
  assert.equal(legacy.title, "Lernen");
  assert.equal(legacy.time, task.time);
});

test("templates discard instance identity and notepad placement", () => {
  const saved = templateSettings({ ...task, tags: ["c:learning", "stored", "note-origin:x", "auto:day"] });
  assert.equal(saved.id, undefined);
  assert.equal(saved.done, undefined);
  assert.deepEqual(saved.tags, ["c:learning"]);
});
