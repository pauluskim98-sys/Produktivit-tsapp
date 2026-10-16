import type { Todo, CalendarEvent } from "./types";
import { taskSegment } from "./schedule.ts";
/** Unoccupied planning time from 06:00 to midnight; overlapping events count once. */
export function freeTime(
  days: string[],
  todos: Todo[],
  events: CalendarEvent[],
) {
  let occupied = 0;
  const timedEvents = events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }));
  for (const day of days) {
    const startDate = new Date(`${day}T00:00:00`),
      start = startDate.getTime(),
      endDay = new Date(`${day}T23:59:59.999`).getTime();
    const ranges = todos.flatMap((t) => {
      const r = taskSegment(t, day);
      return r ? [r] : [];
    });
    for (const e of timedEvents) {
      const a = e.start,
        b = e.end;
      // Calendar days after a clock change still use the displayed local hour.
      const offset = (d: Date) =>
        d.getFullYear() === startDate.getFullYear() &&
        d.getMonth() === startDate.getMonth() &&
        d.getDate() === startDate.getDate()
          ? d.getHours() * 60 + d.getMinutes()
          : d.getTime() < start
            ? 0
            : 1440;
      if (b.getTime() > start && a.getTime() < endDay)
        ranges.push({
          start: offset(a),
          end: offset(b),
        } as (typeof ranges)[number]);
    }
    const sorted = ranges
      .map((r) => ({
        start: Math.max(360, r.start),
        end: Math.min(1440, r.end),
      }))
      .filter((r) => r.end > r.start)
      .sort((a, b) => a.start - b.start);
    let edge = 360;
    for (const r of sorted) {
      occupied += Math.max(0, r.end - Math.max(edge, r.start));
      edge = Math.max(edge, r.end);
    }
  }
  return {
    available: days.length * 18,
    occupied: occupied / 60,
    free: Math.max(0, days.length * 18 - occupied / 60),
  };
}
