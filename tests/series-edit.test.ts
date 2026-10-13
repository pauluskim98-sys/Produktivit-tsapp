import test from "node:test";
import assert from "node:assert/strict";
import { applySeriesEdit, changedTaskFields } from "../lib/series-edit.ts";
import type { Todo } from "../lib/types.ts";
const source = {
  id: "a",
  title: "Mathe",
  seriesId: "series",
  deadline: null,
  plannedDate: "2026-10-12",
  time: "09:00",
  duration: 60,
  done: false,
  description: "",
  notes: "",
  priority: "low",
  tags: [],
  subtasks: [],
  position: 1,
  createdAt: "",
} as Todo;
test("series edits preserve occurrence dates and unrelated fields", () => {
  const target = {
    ...source,
    id: "b",
    plannedDate: "2026-10-19",
    description: "eigene Notiz",
  };
  const changed = applySeriesEdit(
    source,
    { ...source, title: "Mathematik", time: "10:30" },
    target,
  );
  assert.equal(changed.title, "Mathematik");
  assert.equal(changed.time, "10:30");
  assert.equal(changed.plannedDate, "2026-10-19");
  assert.equal(changed.description, "eigene Notiz");
  assert.equal(changed.id, "b");
});
test("series date shifts retain spacing across month and daylight saving boundaries", () => {
  const target = { ...source, id: "b", plannedDate: "2026-10-26" };
  assert.equal(
    applySeriesEdit(source, { ...source, plannedDate: "2026-10-14" }, target)
      .plannedDate,
    "2026-10-28",
  );
  assert.deepEqual(changedTaskFields(source, { ...source, position: 9 }), []);
});
