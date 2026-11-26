import test from "node:test";
import assert from "node:assert/strict";
import { addNotebookColumns, applyNotebookTemplate, defaultJournalTab, defaultNotebookLayout, defaultTodoTab, initialNotebookSession, notebookColumnKey, notebookFeatures, weeklyNotebookLayout } from "../lib/notebook-layout.ts";
import { notebookColumnParent } from "../lib/notebook.ts";
import { parkedNoteTag } from "../lib/planner-day.ts";

test("fresh notebooks start with diary, calendar week, then a checklist", () => {
  const session=initialNotebookSession("week:2026-11-23");
  assert.deepEqual(session.tabs,[defaultJournalTab,"week:2026-11-23",defaultTodoTab]);
  assert.equal(session.active,defaultJournalTab);
  assert.equal(session.layouts[defaultJournalTab].kind,"journal");
  assert.equal(notebookFeatures(session.layouts[defaultTodoTab]).todo,true);
});

test("legacy notebook modes, combined features and column overrides resolve independently", () => {
  const weekly = { ...defaultNotebookLayout, kind:"weekly" as const };
  assert.deepEqual(notebookFeatures(weekly), {todo:false, weekdays:true, mood:false, lessons:false});
  const combined = { ...weekly, features:{todo:true, weekdays:true} };
  assert.deepEqual(notebookFeatures(combined), {todo:true, weekdays:true, mood:false, lessons:false});
  assert.deepEqual(notebookFeatures(combined, {id:"main",features:{todo:false}}), {todo:false, weekdays:true, mood:false, lessons:false});
});

test("mood tracking requires weekday columns", () => {
  const layout = {...defaultNotebookLayout, features:{mood:true}};
  assert.equal(notebookFeatures(layout).mood,false);
  assert.equal(notebookFeatures(layout,{id:"main",features:{weekdays:true}}).mood,true);
});

test("applying a template keeps note and column identities", () => {
  const layout = {...defaultNotebookLayout,title:"Vorhanden",columns:[{id:"main"},{id:"existing"}]};
  const source = {...defaultNotebookLayout,title:"Vorlage",columns:[{id:"other",title:"Neuer Spaltentitel"}]};
  const applied = applyNotebookTemplate(layout,source);
  assert.equal(applied.title,"Vorhanden");
  assert.equal(applied.columns[0].title,"Neuer Spaltentitel");
  assert.deepEqual(applied.columns.map(column=>column.id),["main","existing"]);
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


test("automatic weeks preserve existing Monday data and keep each week's new columns separate", () => {
  const first = weeklyNotebookLayout("week:2026-11-23");
  const next = weeklyNotebookLayout("week:2026-11-30");
  assert.equal(first.columns.length, 8);
  assert.equal(first.columns[0].planning, true);
  assert.equal(first.columns[1].id, "main");
  assert.notEqual(first.columns[2].id, next.columns[2].id);
  assert.equal(notebookFeatures(first).mood, true);
  assert.deepEqual(weeklyNotebookLayout("week:2026-11-23", first).columns, first.columns);
});

test("a shared weekly layout applies colors, sizes, and added columns without reusing another week's keys", () => {
  const first = weeklyNotebookLayout("week:2026-11-23");
  const second = weeklyNotebookLayout("week:2026-11-30");
  const shared = {
    ...first, color:"#c9e1bb",
    columns:addNotebookColumns(first.columns,9).map((column,index)=>index===2 ? {...column,width:180} : column),
  };
  const result = weeklyNotebookLayout("week:2026-11-30",second,shared);
  assert.equal(result.color,shared.color);
  assert.equal(result.columns[2].id,second.columns[2].id);
  assert.equal(result.columns[2].width,180);
  assert.notEqual(result.columns[8].id,shared.columns[8].id);
  assert.equal(weeklyNotebookLayout("week:2026-11-30",second,shared).columns[8].id,result.columns[8].id);
});
