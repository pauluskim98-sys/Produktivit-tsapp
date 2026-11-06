import type { Todo, CalendarEvent } from "./types.ts";
import { addDays, dateKey, parseDate } from "./dates.ts";
import { taskSegment, toMinutes, toTime } from "./schedule.ts";
import { zoneOccurs, type CalendarZone } from "./calendar-zones.ts";
import { isFlexibleTask } from "./planner-day.ts";

export const AUTO_SCHEDULE_START = 8 * 60;
export const AUTO_SCHEDULE_END = 22 * 60;
export const AUTO_SCHEDULE_GAP = 15;
export function scheduleUntimedOnSave(tasks:Todo[],todos:Todo[],events:CalendarEvent[],now=new Date(),zones:CalendarZone[]=[]){
  const today=dateKey(now);
  const occupied=[...todos,...tasks.filter((task)=>task.time)];
  return tasks.map((task)=>{
    if(task.time || task.done || task.tags.includes("stored"))return task;
    const start=isFlexibleTask(task) || !task.plannedDate ? today : task.plannedDate;
    const end=isFlexibleTask(task) || !task.plannedDate ? dateKey(addDays(parseDate(today),13)) : task.plannedDate;
    const [planned]=autoSchedule([task],occupied,events,{start,end},now,zones).scheduled;
    if(planned)occupied.push(planned);
    return planned || task;
  });
}
/** A local, deterministic first-fit planner. Explicit days remain fixed,
 * existing appointments remain untouched, and unplaceable tasks stay put. */
export function autoSchedule(
  requests: Todo[],
  todos: Todo[],
  events: CalendarEvent[],
  range: { start: string; end: string },
  now = new Date(),
  zones: CalendarZone[] = [],
) {
  const ids = new Set(requests.map((t) => t.id));
  const occupied = todos.filter((t) => !ids.has(t.id));
  const scheduled: Todo[] = [],
    skipped: Todo[] = [];
  const rank = { high: 0, medium: 1, low: 2, none: 2 };
  const queue = [...new Map(requests.map((t) => [t.id, t])).values()]
    .filter((t) => !t.done && !t.tags?.includes("stored"))
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] ||
        (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
        a.position - b.position,
    );
  const today = dateKey(now);
  const activeZones = zones.filter((zone)=>zone.categories.length && (!zone.until || zone.until>=today) &&
    (zone.repeat!=="none" || zone.days.some((day)=>day>=today)));
  for (const task of queue) {
    const matching = activeZones.filter((zone)=>zone.categories.some((category)=>task.tags?.includes(`c:${category}`)));
    const fixedDay = isFlexibleTask(task) ? null : task.plannedDate;
    const first =
      fixedDay || (range.start > today ? range.start : today);
    const last = [
      fixedDay || range.end,
      task.deadline || "9999-12-31",
      range.end,
    ].sort()[0];
    const duration = task.duration ?? 60,
      before = task.travelBefore || 0,
      after = task.travelAfter || 0;
    let placed: Todo | null = null;
    if (first >= range.start && first >= today && duration >= 1)
      for (let d = parseDate(first); dateKey(d) <= last; d = addDays(d, 1)) {
        const day = dateKey(d),
          dayStart = +new Date(`${day}T00:00:00`),
          dayEnd = +new Date(`${dateKey(addDays(d, 1))}T00:00:00`);
        const windows = matching.length
          ? matching.filter((zone)=>zoneOccurs(zone,day)).sort((a,b)=>a.start-b.start)
          : [{start:AUTO_SCHEDULE_START,end:AUTO_SCHEDULE_END}];
        if (!windows.length) continue;
        const intervals = [...occupied, ...scheduled].flatMap((t) => {
          const s = taskSegment(t, day);
          return s ? [{ start: s.start, end: s.end + AUTO_SCHEDULE_GAP }] : [];
        });
        let allDay = false;
        for (const e of events) {
          if (e.allDay) {
            if (e.start.slice(0, 10) <= day && e.end.slice(0, 10) > day)
              allDay = true;
            continue;
          }
          const a = +new Date(e.start),
            b = +new Date(e.end);
          if (a < dayEnd && b > dayStart) {
            const startDate = new Date(a),
              endDate = new Date(b);
            intervals.push({
              start:
                dateKey(startDate) < day
                  ? 0
                  : startDate.getHours() * 60 + startDate.getMinutes(),
              end:
                (dateKey(endDate) > day
                  ? 1440
                  : endDate.getHours() * 60 +
                    endDate.getMinutes() +
                    endDate.getSeconds() / 60) + AUTO_SCHEDULE_GAP,
            });
          }
        }
        if (allDay) continue;
        if (!matching.length) intervals.push(...activeZones.filter((zone)=>zoneOccurs(zone,day)));
        intervals.sort((a, b) => a.start - b.start);
        const earliest = Math.max(
          task.plannedDate && task.time ? toMinutes(task.time) : 0,
          day === today
            ? now.getHours() * 60 + now.getMinutes() + 1 + before
            : 0,
        );
        for (const window of windows) {
          let start = Math.ceil(Math.max(earliest,window.start+before) / 15) * 15;
          while (start + duration + after <= window.end) {
            const clash = intervals.find(
              (i) =>
                start - before < i.end &&
                start + duration + after + AUTO_SCHEDULE_GAP > i.start,
            );
            if (!clash) {
              placed = {
                ...task,
                plannedDate: day,
                time: toTime(start),
                duration,
                ...(task.tags ? {tags:task.tags.filter((tag)=>tag!=="auto:day")} : {}),
              };
              break;
            }
            start = Math.ceil((clash.end + before) / 15) * 15;
          }
          if (placed) break;
        }
        if (placed) break;
      }
    if (placed) scheduled.push(placed);
    else skipped.push(task);
  }
  return { scheduled, skipped };
}
