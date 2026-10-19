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

/** Effective-dated targets carry forward. A later edit never rewrites an older period. */
export type GoalRules = Record<
  string,
  Partial<Record<GoalHorizon, Record<string, GoalTarget>>>
>;
export type GoalSettings = {
  goalSettings?: Record<string, Partial<Record<GoalHorizon, GoalTarget>>>;
  goalPeriodSettings?: GoalRules;
};
export function goalTarget(
  settings: GoalSettings,
  id: string,
  horizon: GoalHorizon,
  anchor: string,
) {
  const start = goalRange(anchor, horizon).start;
  const rules = settings.goalPeriodSettings?.[id]?.[horizon] || {};
  const latest = Object.keys(rules)
    .filter((day) => day <= start)
    .sort()
    .at(-1);
  return latest ? rules[latest] : settings.goalSettings?.[id]?.[horizon];
}
export function setGoalTarget<T extends GoalSettings>(
  settings: T,
  id: string,
  horizon: GoalHorizon,
  anchor: string,
  target: GoalTarget,
  distribute = false,
): T {
  const rules = structuredClone(settings.goalPeriodSettings || {});
  const put = (period: GoalHorizon, value: number) => {
    const category = (rules[id] ||= {});
    const dates = (category[period] ||= {});
    dates[goalRange(anchor, period).start] = {
      target: value,
      unit: target.unit,
    };
  };
  put(horizon, target.target);
  // Deliberately use four weeks per month: 48 hours/year → 4/month → 1/week.
  if (distribute && horizon === "year") {
    put("month", target.target / 12);
    put("week", target.target / 48);
  } else if (distribute && horizon === "month") put("week", target.target / 4);
  return { ...settings, goalPeriodSettings: rules };
}
export function validGoalRules(value: unknown): value is GoalRules | undefined {
  if (value === undefined) return true;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > 300
  )
    return false;
  let count = 0;
  for (const [id, horizons] of Object.entries(value)) {
    if (
      !/^[\w-]{1,100}$/.test(id) ||
      !horizons ||
      typeof horizons !== "object" ||
      Array.isArray(horizons)
    )
      return false;
    for (const [horizon, rules] of Object.entries(horizons)) {
      if (
        !["week", "month", "year"].includes(horizon) ||
        !rules ||
        typeof rules !== "object" ||
        Array.isArray(rules)
      )
        return false;
      for (const [date, goal] of Object.entries(rules)) {
        if (
          ++count > 10000 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(+parseDate(date)) ||
          dateKey(parseDate(date)) !== date ||
          goalRange(date, horizon as GoalHorizon).start !== date ||
          !goal ||
          typeof goal !== "object" ||
          !Number.isFinite(goal.target) ||
          goal.target <= 0 ||
          goal.target > 10000 ||
          !["hours", "times"].includes(goal.unit)
        )
          return false;
      }
    }
  }
  return true;
}
