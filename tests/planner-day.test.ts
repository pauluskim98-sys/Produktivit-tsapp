import test from "node:test";
import assert from "node:assert/strict";
import { taskDay,plannerPeriodTags,parkTask,restoreParkedTask } from "../lib/planner-day.ts";
import type { Todo } from "../lib/types.ts";

test("a day task mirrors to its selected day without acquiring a calendar time",()=>{
  const tags=plannerPeriodTags(["h:week","q:1","c:work"],"day","2026-11-09");
  const task={tags,plannedDate:null,createdAt:"2026-11-05T12:00:00Z"};
  assert.equal(taskDay(task),"2026-11-09");
  assert.equal(taskDay({...task,plannedDate:"2026-11-10"}),"2026-11-10");
  assert.equal(taskDay({...task,tags:plannerPeriodTags(tags,"week","2026-11-09")}),null);
  assert.equal(taskDay({...task,tags:[...tags,"stored"]}),null);
});
test("a parked task returns as the same task at its original time or the dragged target",()=>{
  const task={id:"task",title:"Lernen",tags:["c:learning"],plannedDate:"2026-11-06",time:"13:15",duration:45} as Todo;
  const parked=parkTask(parkTask(task,"week:2026-11-02"),"month:2026-11-01");
  assert.equal(parked.plannedDate,null);
  const original=restoreParkedTask(parked,"2026-11-07");
  assert.deepEqual([original.id,original.plannedDate,original.time,original.duration],["task","2026-11-06","13:15",45]);
  const moved=restoreParkedTask(parked,"2026-11-07",{day:"2026-11-10",time:"09:00",duration:45});
  assert.deepEqual(moved.tags,["c:learning","h:day","d:2026-11-10"]);
});
