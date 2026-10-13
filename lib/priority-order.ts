import type { Todo, Priority } from "./types.ts";
const rank = { high: 0, medium: 1, low: 2, none: 2 };
export function priorityOrder(
  todos: Todo[],
  source: Todo,
  beforeId: string | null,
  priority: Priority,
  horizon: string,
): Todo[] {
  const ordered = todos
    .filter(
      (t) =>
        !t.plannedDate &&
        !t.done &&
        (t.tags.find((x) => /^h:/.test(x)) || "h:week") === `h:${horizon}`,
    )
    .sort(
      (a, b) => rank[a.priority] - rank[b.priority] || a.position - b.position,
    );
  const boundary = beforeId
    ? ordered.findIndex((t) => t.id === beforeId)
    : ordered.length;
  const prefix = ordered
    .slice(0, boundary < 0 ? ordered.length : boundary)
    .filter((t) => t.id !== source.id && rank[t.priority] === rank[priority]);
  const same = ordered.filter(
    (t) => t.id !== source.id && rank[t.priority] === rank[priority],
  );
  const updated = {
    ...source,
    priority,
    plannedDate: null,
    time: "",
    duration: null,
    tags: [...source.tags.filter((x) => !/^h:/.test(x)), `h:${horizon}`],
  };
  same.splice(prefix.length, 0, updated);
  const result = [
    ...ordered.filter(
      (t) => t.id !== source.id && rank[t.priority] < rank[priority],
    ),
    ...same,
    ...ordered.filter(
      (t) => t.id !== source.id && rank[t.priority] > rank[priority],
    ),
  ];
  return result.map((t, i) => ({ ...t, position: i + 1 }));
}
