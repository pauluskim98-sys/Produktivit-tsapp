import type { Todo } from "./types.ts";
export function openWeekCount(todos: Todo[], days: string[]): number {
  return todos.filter(
    (t) =>
      !t.done &&
      (t.plannedDate
        ? days.includes(t.plannedDate)
        : (t.tags.find((x) => /^h:(week|month|year)$/.test(x)) || "h:week") ===
          "h:week"),
  ).length;
}
