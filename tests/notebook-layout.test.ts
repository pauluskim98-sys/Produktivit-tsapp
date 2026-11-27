import test from "node:test";
import assert from "node:assert/strict";
import { addNotebookColumns, applyNotebookTemplate, defaultJournalTab, defaultNotebookLayout, defaultTodoTab, initialNotebookSession, notebookColumnKey, notebookFeatures, updateWeeklyNotebookLayout, weeklyNotebookLayout } from "../lib/notebook-layout.ts";
import { notebookColumnParent } from "../lib/notebook.ts";
import { isJournalKey, journalFieldKey, journalFieldsFor, journalLayoutKey, journalMoodKey, readJournalMood } from "../lib/journal-layout.ts";
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

test("all columns can be removed from the shared weekly layout and added again", () => {
  const week = "week:2026-11-23";
  const first = weeklyNotebookLayout(week);
  const empty = updateWeeklyNotebookLayout(first,{...first, features:{weekdays:false,mood:false},columns:[]});
  const saved = JSON.parse(JSON.stringify(empty));
  assert.deepEqual(weeklyNotebookLayout(week,saved).columns, []);
  const next = weeklyNotebookLayout("week:2026-11-30",undefined,saved);
  assert.deepEqual(next.columns, []);
  assert.equal(notebookFeatures(next).weekdays,false);
  const added = updateWeeklyNotebookLayout(next,{...next,columns:addNotebookColumns(next.columns,1)});
  assert.equal(weeklyNotebookLayout(week,saved,added).columns.length,1);
  assert.equal(weeklyNotebookLayout(week,saved,added).columns[0].weekday,undefined);
});

test("removing the planning column and Monday leaves Tuesday attached to the correct note in other weeks", () => {
  const week = "week:2026-11-23";
  const otherWeek = "week:2026-11-30";
  const first = weeklyNotebookLayout(week);
  const legacy = {...defaultNotebookLayout, columns:[{id:"main"},{id:crypto.randomUUID()}]};
  const edited = updateWeeklyNotebookLayout(first,{...first,columns:first.columns.slice(2)});
  const other = weeklyNotebookLayout(otherWeek,legacy,edited);
  assert.equal(other.columns[0].id,legacy.columns[1].id);
  assert.equal(other.columns[0].weekday,1);
  const revised = updateWeeklyNotebookLayout(other,{...other,columns:other.columns.slice(1)});
  const restored = weeklyNotebookLayout(otherWeek,revised,edited);
  assert.equal(restored.columns[0].id,legacy.columns[1].id);
});

test("journal page overrides do not affect later dates; later defaults can also be empty",()=>{
  const first={id:crypto.randomUUID(),title:"Rückblick"};
  const second={id:crypto.randomUUID(),title:"Ideen"};
  const notes={
    [journalLayoutKey("2026-11-25")]:JSON.stringify({future:[first,second]}),
    [journalLayoutKey("2026-11-27")]:JSON.stringify({day:[second,first]}),
    [journalLayoutKey("2026-12-01")]:JSON.stringify({future:[]}),
  };
  assert.deepEqual(journalFieldsFor(notes,"2026-11-24"),[]);
  assert.deepEqual(journalFieldsFor(notes,"2026-11-26"),[first,second]);
  assert.deepEqual(journalFieldsFor(notes,"2026-11-27"),[second,first]);
  assert.deepEqual(journalFieldsFor(notes,"2026-11-28"),[first,second]);
  assert.deepEqual(journalFieldsFor(notes,"2026-12-02"),[]);
});

test("journal notes use separate date-validated storage keys",()=>{
  const date="2026-11-27";
  assert.ok(isJournalKey(journalFieldKey(date,crypto.randomUUID())));
  assert.ok(isJournalKey(journalMoodKey(date)));
  assert.equal(isJournalKey(journalLayoutKey("2026-02-31")),false);
  assert.deepEqual(readJournalMood(date,JSON.stringify({date,score:0,reason:"Gut"})),{date,score:0,reason:"Gut"});
  assert.equal(readJournalMood(date,"null"),undefined);
});
