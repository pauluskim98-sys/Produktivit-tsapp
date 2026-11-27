import type { CalendarEvent, Todo } from "./types";

export function isExamAppointment(title: string): boolean {
  const words = title.normalize("NFC").toLocaleLowerCase("de-DE").match(/[\p{L}\p{M}]+/gu) ?? [];
  return words.some(word => word.includes("prüfung") || word.startsWith("test") ||
    (/tests?$/.test(word) && !/protests?$/.test(word)));
}

export function taskPriority(todo: Pick<Todo, "title" | "priority">): Todo["priority"] {
  return isExamAppointment(todo.title) ? "high" : todo.priority;
}

export function eventFlag(event: Pick<CalendarEvent, "title" | "originalTitle">) {
  return isExamAppointment(event.title) || isExamAppointment(event.originalTitle ?? "") ? "red" : undefined;
}

export const TASK_COLORS = {
  green: "Grün",
  blue: "Blau",
  purple: "Violett",
  orange: "Orange",
  pink: "Rosa",
  red: "Rot",
  yellow: "Gelb",
  teal: "Türkis",
  indigo: "Indigo",
  slate: "Schiefer",
} as const;
export type TaskColor = keyof typeof TASK_COLORS;
export function taskFlag(priority:string) {
  return priority==="high" ? "red" : priority==="medium" ? "yellow" : undefined;
}
export const TASK_COLOR_VALUES: TaskColor[] = Object.keys(
  TASK_COLORS,
) as TaskColor[];
export function taskColorForKey(key: string): TaskColor | undefined {
  return /^[0-9]$/.test(key)
    ? TASK_COLOR_VALUES[key === "0" ? 9 : Number(key) - 1]
    : undefined;
}
export const TASK_COLOR_HEX: Record<TaskColor, string> = {
  green: "#54a478",
  blue: "#5391c9",
  purple: "#9772c8",
  orange: "#d59e42",
  pink: "#d86e83",
  red: "#cd6863",
  yellow: "#baa039",
  teal: "#409e9b",
  indigo: "#6b78bd",
  slate: "#7b8a9c",
};
