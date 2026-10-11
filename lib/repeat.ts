import { addDays, dateKey, parseDate } from "./dates.ts";
export function repeatDates(start: string, weekdays: unknown, weeks: unknown) {
  if (
    !Array.isArray(weekdays) ||
    !weekdays.length ||
    weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    !Number.isInteger(weeks) ||
    Number(weeks) < 1 ||
    Number(weeks) > 52
  )
    throw new Error(
      "Bitte Wochentage und einen Zeitraum bis 52 Wochen wählen.",
    );
  const dates: string[] = [];
  for (let i = 1; i <= Number(weeks) * 7; i++) {
    const d = addDays(parseDate(start), i);
    if (weekdays.includes((d.getDay() + 6) % 7)) dates.push(dateKey(d));
  }
  return dates;
}
