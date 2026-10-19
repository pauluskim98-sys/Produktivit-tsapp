import { addDays, dateKey, parseDate } from "./dates.ts";
import { goalRange, type GoalHorizon } from "./goals.ts";
export type ReviewKind = Exclude<GoalHorizon, "year">;
export type ReviewPeriod = { kind: ReviewKind; anchor: string };
export function reviewKey(period: ReviewPeriod) {
  return `${period.kind}:${goalRange(period.anchor, period.kind).start}`;
}
/** Review only the actual local Sunday / final calendar day, including leap years. */
export function dueReviews(now = new Date()): ReviewPeriod[] {
  const anchor = dateKey(now),
    periods: ReviewPeriod[] = [];
  if (now.getDay() === 0) periods.push({ kind: "week", anchor });
  if (
    now.getDate() ===
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  )
    periods.push({ kind: "month", anchor });
  return periods;
}
export function nextReviewPeriod(period: ReviewPeriod) {
  return dateKey(
    addDays(parseDate(goalRange(period.anchor, period.kind).end), 1),
  );
}
