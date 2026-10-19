import { TASK_COLOR_VALUES, type TaskColor } from "./task-colors.ts";
import { db } from "./db";
import { isDateKey } from "./dates";
import {
  validGoalRules,
  type GoalRules,
  type GoalCategory,
  type GoalHorizon,
  type GoalTarget,
} from "./goals";
export interface Friend {
  id: string;
  name: string;
  lastContact: string;
  interval: number | null;
  meetInterval?: number | null;
  groupId?: string;
  whatsappId?: string;
  avatar?: string;
}
export interface Rhythm {
  id: string;
  name: string;
  days: number;
  target: number;
  unit: "times" | "hours";
  tabId?: string;
  online?: boolean;
  links?: string[];
  app?: string;
}
export interface MealLog {
  todoId?: string;
  id: string;
  day: string;
  name: string;
  diet?: "meat" | "vegetarian" | "unknown";
  calories: number | null;
  quality: "balanced" | "mixed" | "treat" | "unknown";
}
export interface LifeState {
  goalCategories?: GoalCategory[];
  goalPeriodSettings?: GoalRules;
  hiddenGoalCategories?: string[];
  goalSettings?: Record<string, Partial<Record<GoalHorizon, GoalTarget>>>;
  whatsappImport?: { selected: Record<string, boolean>; seen: string[] };
  tabOrder: string[];
  city: string;
  friends: Friend[];
  rhythms: Rhythm[];
  hidden: string[];
  labels: Record<string, string>;
  meals: MealLog[];
  groups: { id: string; name: string }[];
  tabSettings: Record<
    string,
    { online?: boolean; links?: string[]; defaultColor?: TaskColor }
  >;
}
db.exec(
  "CREATE TABLE IF NOT EXISTS LifeState (id INTEGER PRIMARY KEY, content TEXT NOT NULL)",
);
export function getLife(): LifeState {
  const row = db.prepare("SELECT content FROM LifeState WHERE id=1").get();
  const s = row
    ? JSON.parse(String(row.content))
    : { city: "Köln", friends: [], rhythms: [] };
  return {
    ...s,
    hidden: s.hidden || [],
    labels: s.labels || {},
    meals: s.meals || [],
    groups: s.groups || [],
    tabSettings: s.tabSettings || {},
    tabOrder: s.tabOrder || [],
  };
}
export function saveLife(value: unknown) {
  const s = value as LifeState;
  if (
    !s ||
    typeof s.city !== "string" ||
    s.city.length > 100 ||
    !Array.isArray(s.friends) ||
    !Array.isArray(s.rhythms) ||
    s.friends.length > 5000 ||
    s.rhythms.length > 100
  )
    throw new Error("Bitte Angaben prüfen.");
  const goalId = (id: unknown) =>
    typeof id === "string" && /^[\w-]{1,100}$/.test(id);
  if (
    !Array.isArray(s.goalCategories || []) ||
    (s.goalCategories || []).length > 100 ||
    (s.goalCategories || []).some(
      (g) =>
        !goalId(g.id) ||
        typeof g.name !== "string" ||
        !g.name.trim() ||
        g.name.length > 100,
    ) ||
    !Array.isArray(s.hiddenGoalCategories || []) ||
    (s.hiddenGoalCategories || []).length > 300 ||
    (s.hiddenGoalCategories || []).some((id) => !goalId(id)) ||
    (s.goalSettings != null &&
      (typeof s.goalSettings !== "object" ||
        Array.isArray(s.goalSettings) ||
        Object.keys(s.goalSettings).length > 300))
  )
    throw new Error("Zielkategorien prüfen.");
  if (!validGoalRules(s.goalPeriodSettings))
    throw new Error("Zielzeiträume prüfen.");
  for (const [id, periods] of Object.entries(s.goalSettings || {})) {
    if (
      !goalId(id) ||
      !periods ||
      typeof periods !== "object" ||
      Array.isArray(periods)
    )
      throw new Error("Ziele prüfen.");
    for (const [period, goal] of Object.entries(periods))
      if (
        !["week", "month", "year"].includes(period) ||
        !goal ||
        !Number.isFinite(goal.target) ||
        goal.target <= 0 ||
        goal.target > 10000 ||
        !["hours", "times"].includes(goal.unit)
      )
        throw new Error("Zielumfang prüfen.");
  }
  for (const f of s.friends)
    if (
      !f.name?.trim() ||
      f.name.length > 100 ||
      typeof f.id !== "string" ||
      f.id.length > 100 ||
      (f.interval !== null &&
        (!Number.isFinite(f.interval) ||
          f.interval < 1 ||
          f.interval > 3650)) ||
      (f.meetInterval != null &&
        (!Number.isFinite(f.meetInterval) ||
          f.meetInterval < 1 ||
          f.meetInterval > 3650)) ||
      (f.groupId !== undefined &&
        (typeof f.groupId !== "string" || f.groupId.length > 100)) ||
      typeof f.lastContact !== "string" ||
      (f.lastContact !== "" && !isDateKey(f.lastContact)) ||
      (f.whatsappId && !/^[\w@.:-]{1,100}$/.test(f.whatsappId)) ||
      (f.avatar !== undefined &&
        (typeof f.avatar !== "string" ||
          (f.avatar !== "" &&
            !/^\/api\/whatsapp\/avatar\?id=[\w%.@-]{1,120}$/.test(f.avatar))))
    )
      throw new Error("Person prüfen.");
  if (s.whatsappImport) {
    const p = s.whatsappImport;
    const id = /^\d{1,30}@(s\.whatsapp\.net|lid)$/;
    if (
      !p.selected ||
      typeof p.selected !== "object" ||
      Array.isArray(p.selected) ||
      Object.keys(p.selected).length > 20000 ||
      Object.entries(p.selected).some(
        ([k, v]) => !id.test(k) || typeof v !== "boolean",
      ) ||
      !Array.isArray(p.seen) ||
      p.seen.length > 20000 ||
      p.seen.some((k) => typeof k !== "string" || !id.test(k))
    )
      throw new Error("Kontaktauswahl prüfen.");
  }
  for (const r of s.rhythms)
    if (
      !r.name?.trim() ||
      r.name.length > 100 ||
      typeof r.id !== "string" ||
      r.id.length > 100 ||
      !Number.isFinite(r.days) ||
      r.days < 1 ||
      r.days > 3650 ||
      !Number.isFinite(r.target) ||
      r.target < 0.1 ||
      r.target > 1000 ||
      !["times", "hours"].includes(r.unit) ||
      (r.links &&
        (!Array.isArray(r.links) ||
          r.links.length > 10 ||
          r.links.some(
            (x) =>
              typeof x !== "string" ||
              x.length > 2000 ||
              !/^https:\/\//.test(x),
          ))) ||
      (r.app && !["", "whatsapp", "calendar"].includes(r.app))
    )
      throw new Error("Reiter prüfen.");
  s.tabOrder = s.tabOrder || [];
  if (
    !Array.isArray(s.tabOrder) ||
    s.tabOrder.length > 200 ||
    s.tabOrder.some((id) => typeof id !== "string" || id.length > 100) ||
    new Set(s.tabOrder).size !== s.tabOrder.length
  )
    throw new Error("Reihenfolge prüfen.");
  s.hidden = s.hidden || [];
  s.labels = s.labels || {};
  s.meals = s.meals || [];
  s.groups = s.groups || [];
  s.tabSettings = s.tabSettings || {};
  if (
    !Array.isArray(s.groups) ||
    s.groups.length > 100 ||
    s.groups.some(
      (g) => typeof g.id !== "string" || !g.name?.trim() || g.name.length > 100,
    ) ||
    !s.tabSettings ||
    typeof s.tabSettings !== "object" ||
    Object.keys(s.tabSettings).length > 200
  )
    throw new Error("Gruppen prüfen.");
  for (const setting of Object.values(s.tabSettings)) {
    if (
      setting.defaultColor !== undefined &&
      !TASK_COLOR_VALUES.includes(setting.defaultColor)
    )
      throw new Error("Standardfarbe prüfen.");
    if (setting.online !== undefined && typeof setting.online !== "boolean")
      throw new Error("Interneteinstellung prüfen.");
    if (
      setting.links &&
      (!Array.isArray(setting.links) ||
        setting.links.length > 10 ||
        setting.links.some(
          (x) =>
            typeof x !== "string" || x.length > 2000 || !/^https:\/\//.test(x),
        ))
    )
      throw new Error("Quellenlinks prüfen.");
  }
  if (
    !Array.isArray(s.hidden) ||
    s.hidden.length > 200 ||
    s.hidden.some((x) => typeof x !== "string" || x.length > 100) ||
    typeof s.labels !== "object" ||
    Object.entries(s.labels).length > 200 ||
    Object.entries(s.labels).some(
      ([k, v]) =>
        k.length > 100 || typeof v !== "string" || !v.trim() || v.length > 100,
    ) ||
    !Array.isArray(s.meals) ||
    s.meals.length > 10000
  )
    throw new Error("Reiter prüfen.");
  for (const m of s.meals)
    if (
      typeof m.id !== "string" ||
      (m.todoId !== undefined &&
        (typeof m.todoId !== "string" ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(m.todoId))) ||
      !isDateKey(m.day) ||
      typeof m.name !== "string" ||
      (m.diet !== undefined &&
        !["meat", "vegetarian", "unknown"].includes(m.diet)) ||
      m.name.length > 200 ||
      !["balanced", "mixed", "treat", "unknown"].includes(m.quality) ||
      (m.calories !== null &&
        (!Number.isFinite(m.calories) || m.calories < 0 || m.calories > 20000))
    )
      throw new Error("Essenseintrag prüfen.");
  db.prepare(
    "INSERT INTO LifeState(id,content) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content",
  ).run(JSON.stringify(s));
  return s;
}
