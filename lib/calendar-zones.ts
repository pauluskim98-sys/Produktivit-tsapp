import { isDateKey, parseDate } from "./dates.ts";

export type ZoneRepeat = "none" | "daily" | "weekly" | "monthly";
export type CalendarZone = {
  id: string;
  name: string;
  color: string;
  outline: boolean;
  start: number;
  end: number;
  days: string[];
  repeat: ZoneRepeat;
  until: string;
  categories: string[];
};

export function validZone(value: unknown): CalendarZone {
  if (!value || typeof value !== "object") throw new Error("Ungültige Zone.");
  const zone = value as CalendarZone;
  if (typeof zone.id !== "string" || !/^[\w-]{1,80}$/.test(zone.id) ||
      typeof zone.name !== "string" || !zone.name.trim() || zone.name.length > 100 ||
      typeof zone.color !== "string" || !/^#[0-9a-f]{6}$/i.test(zone.color) ||
      !Number.isInteger(zone.start) || !Number.isInteger(zone.end) ||
      zone.start < 0 || zone.end > 1440 || zone.start >= zone.end ||
      !Array.isArray(zone.days) || !zone.days.length || zone.days.length > 7 || !zone.days.every(isDateKey) ||
      !["none", "daily", "weekly", "monthly"].includes(zone.repeat) ||
      (zone.until !== "" && (!isDateKey(zone.until) || zone.until < [...zone.days].sort().at(-1)!)) ||
      !Array.isArray(zone.categories) || zone.categories.length > 100 ||
      !zone.categories.every((category)=>typeof category==="string" && /^[\w-]{1,100}$/.test(category))) {
    throw new Error("Bitte Name, Zeitraum und Wiederholung der Zone prüfen.");
  }
  return {
    id:zone.id,name:zone.name.trim(),color:zone.color,outline:zone.outline===true,
    start:zone.start,end:zone.end,days:[...new Set(zone.days)].sort(),
    repeat:zone.repeat,until:zone.until,categories:[...new Set(zone.categories)],
  };
}

export function zoneOccurs(zone: CalendarZone, day: string) {
  if (zone.until && day > zone.until) return false;
  const date = parseDate(day);
  return zone.days.some((first)=>{
    if(day < first) return false;
    if(day === first || zone.repeat === "daily") return true;
    const original = parseDate(first);
    if(zone.repeat === "weekly") return date.getDay() === original.getDay();
    if(zone.repeat !== "monthly") return false;
    // A monthly occurrence on the 31st exists only in months with 31 days.
    return date.getDate() === original.getDate();
  });
}

