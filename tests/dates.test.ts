import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dateKey,
  isDateKey,
  monday,
  parseDate,
  weekNumber,
} from "../lib/dates.ts";
test("ISO-Wochen über den Jahreswechsel", () => {
  assert.equal(weekNumber(parseDate("2021-01-01")), 53);
  assert.equal(dateKey(monday(parseDate("2021-01-01"))), "2020-12-28");
  assert.equal(weekNumber(parseDate("2026-10-09")), 41);
});
test("Kalendertage bleiben bei Sommerzeitwechsel stabil", () => {
  assert.equal(dateKey(addDays(parseDate("2026-03-28"), 1)), "2026-03-29");
  assert.equal(dateKey(addDays(parseDate("2026-10-24"), 1)), "2026-10-25");
  assert.ok(isDateKey("2028-02-29"));
  assert.ok(!isDateKey("2026-02-29"));
  assert.ok(!isDateKey("2026-13-01"));
});
