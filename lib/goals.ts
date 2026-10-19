import type { Todo, CalendarEvent } from "./types.ts";
import { monday, dateKey, parseDate, addDays } from "./dates.ts";

export type GoalHorizon = "week" | "month" | "year";
export type GoalTarget = { target: number; unit: "hours" | "times" };
export type GoalCategory = { id: string; name: string };
export function goalRange(anchor: string, horizon: GoalHorizon) {
  const start = parseDate(anchor),
    end = parseDate(anchor);
  if (horizon === "week") {
    const first = monday(start);
    return { start: dateKey(first), end: dateKey(addDays(first, 6)) };
  }
  start.setDate(1);
  if (horizon === "year") {
    start.setMonth(0);
    end.setMonth(11, 31);
  } else end.setMonth(end.getMonth() + 1, 0);
  return { start: dateKey(start), end: dateKey(end) };
}
const clean = (s: string) =>
  s.toLocaleLowerCase("de").normalize("NFKD").replace(/\p{M}/gu, "");
export function matchesGoal(
  todo: Todo,
  category: GoalCategory,
  rhythms: { id: string; tabId?: string }[] = [],
) {
  if (todo.tags.includes(`c:${category.id}`)) return true;
  if (category.id === "todo") return !todo.tags.some((t) => /^[crk]:/.test(t));
  if (category.id === "social" && todo.tags.some((t) => t.startsWith("k:")))
    return true;
  if (
    rhythms.some(
      (r) =>
        (r.id === category.id || r.tabId === category.id) &&
        todo.tags.includes(`r:${r.id}`),
    )
  )
    return true;
  return (
    todo.tags.some((t) => clean(t) === clean(category.name)) ||
    (category.id === "sport" &&
      todo.tags.some((t) => /sport|fitness|training/i.test(t)))
  );
}
/** Planned time is clipped to the period. Done tasks count fully; otherwise
 * only already elapsed scheduled time counts as progress. No time is invented. */
export function goalProgress(
  category: GoalCategory,
  target: GoalTarget,
  todos: Todo[],
  events: CalendarEvent[],
  range: { start: string; end: string },
  now = new Date(),
  rhythms: { id: string; tabId?: string }[] = [],
) {
  const from = +new Date(`${range.start}T00:00:00`),
    until = +new Date(`${dateKey(addDays(parseDate(range.end), 1))}T00:00:00`);
  let planned = 0,
    completed = 0;
  const count = (
    day: string,
    time: string,
    duration: number | null,
    done: boolean,
    endTime?: number,
  ) => {
    if (!time) {
      if (day >= range.start && day <= range.end && target.unit === "times") {
        planned++;
        if (done) completed++;
      }
      return;
    }
    const start = +new Date(`${day}T${time}`),
      end = endTime ?? start + (duration ?? 60) * 60000;
    const a = Math.max(from, start),
      b = Math.min(until, end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return;
    if (target.unit === "times") {
      if (start < from || start >= until) return;
      planned++;
      if (done || end <= +now) completed++;
    } else {
      planned += (b - a) / 3600000;
      completed +=
        (done ? b - a : Math.max(0, Math.min(b, +now) - a)) / 3600000;
    }
  };
  for (const t of todos)
    if (t.plannedDate && matchesGoal(t, category, rhythms))
      count(t.plannedDate, t.time, t.duration, t.done);
  // Imported appointments have no task tags. Match explicit category names.
  for (const e of events)
    if (
      !e.allDay &&
      clean(e.title).includes(clean(category.name)) &&
      category.name.length >= 3
    ) {
      const d = new Date(e.start);
      count(
        dateKey(d),
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        null,
        false,
        +new Date(e.end),
      );
    }
  return {
    planned,
    completed,
    plannedPercent: Math.min(100, (planned / target.target) * 100),
    completedPercent: Math.min(100, (completed / target.target) * 100),
  };
}
