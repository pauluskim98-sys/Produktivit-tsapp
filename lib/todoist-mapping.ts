import { isDateKey } from "./dates.ts";
import type { Todo } from "./types.ts";
export type TodoistTask = {
  id: string;
  content: string;
  description?: string;
  labels?: string[];
  priority?: number | string;
  checked?: boolean;
  is_deleted?: boolean;
  is_uncompletable?: boolean;
  due?: {
    date?: string;
    datetime?: string;
    string?: string;
    timezone?: string;
  };
  dueDate?: string;
  duration?: { amount: number; unit: string } | string;
  deadline?: { date?: string };
  deadlineDate?: string;
  added_at?: string;
};
export function mapTodoistTask(
  task: TodoistTask,
  position: number,
  now: string,
): Todo {
  const raw = task.due?.datetime || task.due?.date || task.dueDate || "";
  const weekly = /^(?:diese|nächste)\s+woche$|^(?:this|next)\s+week$/i.test(
    task.due?.string?.trim() || "",
  );
  let date = raw.slice(0, 10),
    dueTime = raw.match(/T(\d{2}:\d{2})/)?.[1] || "";
  if (
    dueTime &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(raw) &&
    Number.isFinite(Date.parse(raw))
  ) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(raw));
    const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    date = `${p.year}-${p.month}-${p.day}`;
    dueTime = `${p.hour}:${p.minute}`;
  }
  let duration: number | null = null;
  if (typeof task.duration === "object")
    duration = task.duration.amount * (task.duration.unit === "day" ? 1440 : 1);
  if (typeof task.duration === "string") {
    const h = task.duration.match(/([\d.]+)h/),
      m = task.duration.match(/(\d+)m/),
      d = task.duration.match(/(\d+)d/);
    duration =
      Number(h?.[1] || 0) * 60 +
      Number(m?.[1] || 0) +
      Number(d?.[1] || 0) * 1440;
  }
  if (!duration || duration < 1 || duration > 10080) duration = null;
  const priority =
    typeof task.priority === "string"
      ? { p1: 4, p2: 3, p3: 2, p4: 1 }[task.priority] || 1
      : task.priority || 1;
  return {
    id: `todoist-${task.id}`,
    title: task.content.trim().slice(0, 500),
    description: [
      task.description || "",
      dueTime ? `Todoist: fällig um ${dueTime} Uhr` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    notes: "",
    done: Boolean(task.checked),
    priority: priority >= 4 ? "high" : priority >= 3 ? "medium" : "low",
    plannedDate: !weekly && isDateKey(date) ? date : null,
    time: "",
    duration: duration ? Math.round(duration) : null,
    deadline: isDateKey(task.deadline?.date || task.deadlineDate)
      ? (task.deadline?.date || task.deadlineDate)!
      : null,
    color: "green",
    tags: [
      ...new Set([
        ...(task.labels || [])
          .filter((x) => !/^(k|r|h):/.test(x))
          .map((x) => x.slice(0, 40))
          .slice(0, 18),
        "h:week",
      ]),
    ],
    subtasks: [],
    position,
    createdAt:
      task.added_at && Number.isFinite(Date.parse(task.added_at))
        ? task.added_at
        : now,
  };
}
export function mergeTodoistTask(local: Todo, before: Todo, next: Todo): Todo {
  const merged = { ...local };
  for (const key of [
    "title",
    "description",
    "done",
    "priority",
    "plannedDate",
    "duration",
    "deadline",
    "tags",
  ] as const)
    if (JSON.stringify(local[key]) === JSON.stringify(before[key]))
      Object.assign(merged, { [key]: next[key] });
  return merged;
}
