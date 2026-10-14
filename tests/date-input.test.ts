import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTypedDate, displayTypedDate } from "../lib/date-input.ts";
test("manually typed German dates accept short dates, two-digit years and ISO", () => {
  for (const [value, expected] of [
    ["16.10.2026", "2026-10-16"],
    ["9.2.", "2026-02-09"],
    ["9/2/27", "2027-02-09"],
    ["2026-10-16", "2026-10-16"],
    ["", ""],
  ])
    assert.equal(normalizeTypedDate(value, "2026"), expected);
  assert.equal(displayTypedDate("2026-10-16"), "16.10.2026");
});
test("invalid and incomplete dates do not silently shift into another month", () => {
  for (const value of [
    "31.02.2026",
    "29.02.2026",
    "16.",
    "16.10.202",
    "3.13.2026",
  ])
    assert.equal(normalizeTypedDate(value, "2026"), null);
  assert.equal(normalizeTypedDate("29.02.2028", "2026"), "2028-02-29");
});
