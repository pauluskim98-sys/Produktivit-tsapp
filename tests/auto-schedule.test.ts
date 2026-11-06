import test from "node:test";
import assert from "node:assert/strict";
import { autoSchedule, scheduleUntimedOnSave } from "../lib/auto-schedule.ts";
import { validZone, zoneOccurs } from "../lib/calendar-zones.ts";
import type { Todo, CalendarEvent } from "../lib/types.ts";
const task = (id: string, patch: Partial<Todo> = {}) =>
  ({
    id,
    title: id,
    done: false,
    priority: "low",
    plannedDate: null,
    time: "",
    duration: 60,
    deadline: null,
    position: 1,
    ...patch,
  }) as Todo;
const event = (start: string, end: string, allDay = false) =>
  ({
    id: "event",
    start: allDay ? start : new Date(start).toISOString(),
    end: allDay ? end : new Date(end).toISOString(),
    allDay,
  }) as CalendarEvent;
const range = { start: "2026-10-19", end: "2026-10-25" },
  now = new Date("2026-10-19T07:00");
test("saving appointments fills missing times without moving explicit times or double booking",()=>{
  const day=range.start;
  const timed=task("timed",{plannedDate:day,time:"08:00",tags:[]});
  const first=task("first",{plannedDate:day,tags:[]});
  const second=task("second",{plannedDate:day,tags:[]});
  const result=scheduleUntimedOnSave([first,timed,second],[],[],now);
  assert.deepEqual(result.map((item)=>item.time),["09:15","08:00","10:30"]);
  assert.equal(scheduleUntimedOnSave([first],[],[event(day,"2026-10-20",true)],now)[0].time,"");
});
test("zones repeat on their selected weekdays and stop at the end date",()=>{
  const zone=validZone({id:"weekly",name:"Lernzeit",color:"#426d54",outline:true,start:600,end:720,
    days:["2026-10-19","2026-10-21"],repeat:"weekly",until:"2026-10-26",categories:["learning"]});
  assert.equal(zone.outline,true);
  assert.equal(zoneOccurs(zone,"2026-10-20"),false);
  assert.equal(zoneOccurs(zone,"2026-10-26"),true);
  assert.equal(zoneOccurs(zone,"2026-10-28"),false);
});
test("auto planning reserves zones for their categories and can move a default day",()=>{
  const zone=validZone({id:"focus",name:"Lernzeit",color:"#426d54",outline:false,start:480,end:630,
    days:["2026-10-20"],repeat:"none",until:"",categories:["learning"]});
  const flexible=task("flexible",{plannedDate:"2026-10-19",tags:["c:learning","h:day","d:2026-10-19","auto:day"]});
  const fixed=task("fixed",{plannedDate:"2026-10-19",tags:["c:learning"]});
  const other=task("other",{plannedDate:"2026-10-20",tags:["c:work"]});
  const result=autoSchedule([flexible,fixed,other],[],[event("2026-10-20T08:00","2026-10-20T09:00")],range,now,[zone]);
  assert.deepEqual(result.scheduled.map(({id,plannedDate,time})=>({id,plannedDate,time})),[
    {id:"flexible",plannedDate:"2026-10-20",time:"09:15"},
    {id:"other",plannedDate:"2026-10-20",time:"10:30"},
  ]);
  assert.equal(result.scheduled[0].tags.includes("auto:day"),false);
  assert.deepEqual(result.skipped.map((todo)=>todo.id),["fixed"]);
});
test("auto planning chooses a time while preserving an explicit day", () => {
  const plannedDate = "2026-10-21";
  const untimed = task("untimed", { plannedDate });
  const result = autoSchedule([untimed], [untimed], [], range, now);
  assert.equal(result.scheduled[0].plannedDate, plannedDate);
  assert.ok(result.scheduled[0].time);
});
test("an automatically assigned day can move without zones, while parked tasks stay out",()=>{
  const late=new Date("2026-10-19T22:00");
  const flexible=task("default",{plannedDate:range.start,tags:["auto:day",`d:${range.start}`]});
  const parked=task("parked",{tags:["stored"]});
  const fixed=task("fixed",{plannedDate:range.start});
  const result=autoSchedule([flexible,parked,fixed],[],[],range,late);
  assert.deepEqual(result.scheduled.map((item)=>[item.id,item.plannedDate]),[["default","2026-10-20"]]);
  assert.deepEqual(result.skipped.map((item)=>item.id),["fixed"]);
});
test("auto planning respects priorities, fixed appointments, travel and breaks", () => {
  const existing = task("occupied", {
    plannedDate: range.start,
    time: "08:00",
    duration: 60,
    travelAfter: 15,
  });
  const requests = [
    task("low"),
    task("high", { priority: "high", duration: 90, travelBefore: 15 }),
  ];
  const result = autoSchedule(
    requests,
    [existing, ...requests],
    [event("2026-10-19T12:00", "2026-10-19T13:00")],
    range,
    now,
  );
  assert.equal(result.scheduled[0].id, "high");
  assert.equal(result.scheduled[0].time, "09:45");
  assert.equal(result.scheduled[1].time, "13:15");
  assert.equal(requests[0].plannedDate, null);
  assert.equal(existing.time, "08:00");
});
test("unplaceable tasks stay unplanned; deadline and all-day events are respected", () => {
  const requests = [
    task("too-long", { duration: 900 }),
    task("deadline", { deadline: "2026-10-19" }),
    task("next"),
  ];
  const r = autoSchedule(
    requests,
    requests,
    [event("2026-10-19", "2026-10-20", true)],
    range,
    now,
  );
  assert.deepEqual(
    r.skipped.map((t) => t.id),
    ["deadline", "too-long"],
  );
  assert.equal(r.scheduled[0].plannedDate, "2026-10-20");
});
test("today is never planned into the past and explicit days/times are retained", () => {
  const r = autoSchedule(
    [
      task("now"),
      task("fixed", { plannedDate: "2026-10-21", time: "16:00", duration: 90 }),
    ],
    [],
    [],
    range,
    new Date("2026-10-19T14:07"),
  );
  assert.equal(r.scheduled.find((t) => t.id === "now")?.time, "14:15");
  assert.equal(
    r.scheduled.find((t) => t.id === "fixed")?.plannedDate,
    "2026-10-21",
  );
  assert.equal(r.scheduled.find((t) => t.id === "fixed")?.time, "16:00");
  assert.equal(
    autoSchedule(
      [task("past")],
      [],
      [],
      { start: "2026-10-01", end: "2026-10-05" },
      now,
    ).skipped.length,
    1,
  );
});
test("overnight occupancy and own current slot do not create overlaps", () => {
  const requested = task("own", { plannedDate: range.start, time: "08:00" });
  const overnight = task("night", {
    plannedDate: "2026-10-18",
    time: "23:00",
    duration: 600,
  });
  const r = autoSchedule([requested], [requested, overnight], [], range, now);
  assert.equal(r.scheduled[0].time, "09:15");
});
