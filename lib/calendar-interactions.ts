import type { Todo } from "./types";
import { dateKey, parseDate, addDays, monday, isDateKey } from "./dates.ts";
import { toMinutes, toTime } from "./schedule.ts";
export function periodRange(key: unknown) {
  if (typeof key !== "string") return null;
  const parts = key.split(":");
  const kind = parts.length === 1 ? "day" : parts[0];
  const date = parts.at(-1)!;
  if (!["day", "week", "month", "year"].includes(kind) || !isDateKey(date)) return null;
  const d = parseDate(date);
  const start =
    kind === "week"
      ? monday(d)
      : kind === "month"
        ? new Date(d.getFullYear(), d.getMonth(), 1)
        : kind === "year"
          ? new Date(d.getFullYear(), 0, 1)
        : d;
  const end =
    kind === "week"
      ? addDays(start, 6)
      : kind === "month"
        ? new Date(d.getFullYear(), d.getMonth() + 1, 0)
        : kind === "year"
          ? new Date(d.getFullYear(), 11, 31)
        : d;
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(dateKey(d));
  return { kind, start: dateKey(start), end: dateKey(end), days };
}
export function nextTask(todos: Todo[], id: string, key: string) {
  const t = todos.find((t) => t.id === id);
  if (!t?.plannedDate || !t.time) return null;
  const day = t.plannedDate,
    time = toMinutes(t.time);
  const candidates = todos
    .filter((x) => x.id !== id && x.plannedDate && x.time)
    .map((x) => ({
      todo: x,
      day: Math.round(
        (Date.parse(x.plannedDate!) - Date.parse(day)) / 86400000,
      ),
      minute: toMinutes(x.time) - time,
    }));
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  const sign = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
  const eligible = candidates.filter((x) =>
    horizontal ? x.day * sign > 0 : x.day === 0 && x.minute * sign > 0,
  );
  eligible.sort((a, b) =>
    horizontal
      ? Math.abs(a.day) - Math.abs(b.day) ||
        Math.abs(a.minute) - Math.abs(b.minute)
      : Math.abs(a.minute) - Math.abs(b.minute),
  );
  return eligible[0]?.todo.id || null;
}
export function shiftTasks(
  todos: Todo[],
  source: Todo,
  day: string,
  time: string,
  copy = false,
) {
  const dayDelta = Math.round(
    (Date.parse(day) - Date.parse(source.plannedDate!)) / 86400000,
  );
  const minuteDelta = toMinutes(time) - toMinutes(source.time);
  return todos.map((t) => {
    const minutes = toMinutes(t.time) + minuteDelta;
    return {
      ...structuredClone(t),
      plannedDate: dateKey(
        addDays(
          parseDate(t.plannedDate!),
          dayDelta + Math.floor(minutes / 1440),
        ),
      ),
      time: toTime(((minutes % 1440) + 1440) % 1440),
      ...(copy
        ? {
            id: crypto.randomUUID(),
            done: false,
            createdAt: new Date().toISOString(),
            subtasks: t.subtasks.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              done: false,
            })),
          }
        : {}),
    };
  });
}
