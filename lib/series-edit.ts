import type { Todo } from "./types";
import { addDays, dateKey, parseDate } from "./dates.ts";
const fields = [
  "title",
  "description",
  "notes",
  "done",
  "priority",
  "reminder",
  "location",
  "travelBefore",
  "travelAfter",
  "travelMode",
  "color",
  "plannedDate",
  "time",
  "deadline",
  "duration",
  "tags",
  "subtasks",
] as const;
export function changedTaskFields(before: Todo, after: Todo) {
  return fields.filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}
export function applySeriesEdit(
  source: Todo,
  edited: Todo,
  target: Todo,
): Todo {
  const result = structuredClone(target);
  for (const key of changedTaskFields(source, edited)) {
    if (
      key === "plannedDate" &&
      source.plannedDate &&
      edited.plannedDate &&
      target.plannedDate
    ) {
      const days = Math.round(
        (Date.parse(edited.plannedDate) - Date.parse(source.plannedDate)) /
          86400000,
      );
      result.plannedDate = dateKey(
        addDays(parseDate(target.plannedDate), days),
      );
    } else if (key === "subtasks") {
      result.subtasks = edited.subtasks.map((s, i) => ({
        ...s,
        id: target.subtasks[i]?.id || crypto.randomUUID(),
      }));
    } else {
      (result as unknown as Record<string, unknown>)[key] = structuredClone(
        edited[key],
      );
    }
  }
  return result;
}
