import type { Todo, CalendarEvent } from "./types.ts";
import { addDays, dateKey, parseDate } from "./dates.ts";
import { taskSegment, toMinutes, toTime } from "./schedule.ts";

export const AUTO_SCHEDULE_START = 8 * 60;
export const AUTO_SCHEDULE_END = 22 * 60;
export const AUTO_SCHEDULE_GAP = 15;
/** A local, deterministic first-fit planner. Explicit days remain fixed,
 * existing appointments remain untouched, and unplaceable tasks stay put. */
export function autoSchedule(
  requests: Todo[],
  todos: Todo[],
  events: CalendarEvent[],
  range: { start: string; end: string },
  now = new Date(),
) {
  const ids = new Set(requests.map((t) => t.id));
  const occupied = todos.filter((t) => !ids.has(t.id));
  const scheduled: Todo[] = [],
    skipped: Todo[] = [];
  const rank = { high: 0, medium: 1, low: 2, none: 2 };
  const queue = [...new Map(requests.map((t) => [t.id, t])).values()]
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] ||
        (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
        a.position - b.position,
    );
  const today = dateKey(now);
  for (const task of queue) {
    const first =
      task.plannedDate || (range.start > today ? range.start : today);
    const last = [
      task.plannedDate || range.end,
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
        intervals.sort((a, b) => a.start - b.start);
        const earliest = Math.max(
          AUTO_SCHEDULE_START + before,
          task.plannedDate && task.time ? toMinutes(task.time) : 0,
          day === today
            ? now.getHours() * 60 + now.getMinutes() + 1 + before
            : 0,
        );
        let start = Math.ceil(earliest / 15) * 15;
        while (start + duration + after <= AUTO_SCHEDULE_END) {
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
            };
            break;
          }
          start = Math.ceil((clash.end + before) / 15) * 15;
        }
        if (placed) break;
      }
    if (placed) scheduled.push(placed);
    else skipped.push(task);
  }
  return { scheduled, skipped };
}
