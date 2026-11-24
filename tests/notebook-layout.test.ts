import test from "node:test";
import assert from "node:assert/strict";
import { addNotebookColumns, defaultNotebookLayout, notebookColumnKey, notebookFeatures } from "../lib/notebook-layout.ts";
import { notebookColumnParent } from "../lib/notebook.ts";
import { parkedNoteTag } from "../lib/planner-day.ts";

test("legacy notebook modes, combined features and column overrides resolve independently", () => {
  const weekly = { ...defaultNotebookLayout, kind:"weekly" as const };
  assert.deepEqual(notebookFeatures(weekly), {todo:false, weekdays:true});
  const combined = { ...weekly, features:{todo:true, weekdays:true} };
  assert.deepEqual(notebookFeatures(combined), {todo:true, weekdays:true});
  assert.deepEqual(notebookFeatures(combined, {id:"main",features:{todo:false}}), {todo:false, weekdays:true});
});

test("adding columns preserves manual widths and assigns only new columns flexible widths", () => {
  const columns = [{ id: "main", width: 240 }, { id: crypto.randomUUID() }];
  const next = addNotebookColumns(columns, 7);
  assert.deepEqual(next.slice(0, 2), columns);
  assert.equal(next.length, 7);
  assert.ok(next.slice(2).every(column => !Object.hasOwn(column, "width")));
  assert.equal(new Set(next.map(column => column.id)).size, 7);
});

test("extra columns have separate storage keys and valid, distinct calendar task tags", () => {
  const note = "week:2026-11-23";
  assert.equal(notebookColumnKey(note, "main"), note);
  const column = notebookColumnKey(note, crypto.randomUUID());
  assert.equal(notebookColumnParent(column), note);
  assert.notEqual(parkedNoteTag(column), parkedNoteTag(note));
  assert.ok(parkedNoteTag(column).length <= 40);
});
