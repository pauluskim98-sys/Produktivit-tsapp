import type { Todo } from "./types";
export const MINUTE_HEIGHT = 0.55;
export function gridMinute(minute: number) {
  return minute >= 360 ? minute - 360 : minute + 1080;
}
export function clockMinute(position: number) {
  return (Math.max(0, Math.min(1439, position)) + 360) % 1440;
}
export function splitAtSix(start: number, end: number) {
  return [
    { start: Math.max(360, start), end },
    { start, end: Math.min(360, end) },
  ].filter((s) => s.end > s.start);
}
export const SNAP_MINUTES = 15;
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function dayDistance(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86400000,
  );
}
export function scheduleAt(minutes: number, duration = 60) {
  const length = Math.min(10080, Math.max(15, duration));
  return {
    time: toTime(Math.max(0, Math.min(1425, Math.round(minutes / 15) * 15))),
    duration: length,
  };
}
export function taskSegment(todo: Todo, day: string) {
  if (!todo.plannedDate || !todo.time) return null;
  const offset = dayDistance(todo.plannedDate, day) * 1440;
  const start = toMinutes(todo.time) - offset,
    end = start + (todo.duration || 60);
  if (end <= 0 || start >= 1440) return null;
  return {
    start: Math.max(0, start),
    end: Math.min(1440, end),
    offset,
    continuesBefore: start < 0,
    continuesAfter: end > 1440,
  };
}
export function resizeSchedule(
  time: string,
  duration: number,
  edge: "start" | "end",
  deltaMinutes: number,
  dayOffset = 0,
) {
  const originalStart = toMinutes(time),
    originalEnd = originalStart + duration;
  const change = Math.round(deltaMinutes / 15) * 15;
  if (edge === "start") {
    const start = Math.max(
      0,
      Math.min(1425, originalEnd - 15, originalStart + change),
    );
    return { time: toTime(start), duration: originalEnd - start };
  }
  const end = Math.max(
    originalStart + 15,
    Math.min(dayOffset + 1440, originalEnd + change),
  );
  return { time, duration: end - originalStart };
}
export interface LayoutItem {
  id: string;
  start: number;
  end: number;
}
// Use equal-width lanes within each connected group of overlapping intervals.
export function layoutIntervals<T extends LayoutItem>(
  items: T[],
): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id),
  );
  const result: (T & { lane: number; lanes: number })[] = [];
  let group: T[] = [],
    end = -1;
  function flush() {
    const laneEnds: number[] = [];
    const placed = group.map((item) => {
      let lane = laneEnds.findIndex((value) => value <= item.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.end;
      return { ...item, lane, lanes: 0 };
    });
    result.push(...placed.map((item) => ({ ...item, lanes: laneEnds.length })));
    group = [];
  }
  for (const item of sorted) {
    if (group.length && item.start >= end) {
      flush();
      end = -1;
    }
    group.push(item);
    end = Math.max(end, item.end);
  }
  flush();
  return result;
}

// The displayed day starts at 06:00. Crossing its midnight divider selects
// an overnight interval; starting below it selects the same date's early hours.
export function creationRange(anchor: number, current: number) {
  const snap = (n: number) =>
    Math.max(0, Math.min(1440, Math.round(n / 15) * 15));
  const a = snap(anchor),
    b = snap(current);
  const start = Math.min(Math.min(a, b), 1425);
  const end = Math.min(1440, Math.max(a, b, start + 15));
  return {
    start,
    end,
    time: toTime((start + 360) % 1440),
    duration: end - start,
  };
}
