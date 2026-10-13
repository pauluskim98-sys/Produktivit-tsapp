import test from "node:test";
import assert from "node:assert/strict";
import { normalizeClockTime } from "../lib/time-input.ts";

test("typed clock times normalize hours and German dot notation", () => {
  for (const [input, expected] of [
    ["9", "09:00"],
    ["9:05", "09:05"],
    ["15.15", "15:15"],
    ["23:59", "23:59"],
    ["0", "00:00"],
    ["", ""],
  ]) {
    assert.equal(normalizeClockTime(input), expected);
  }
});
test("incomplete or impossible clock times are rejected instead of shifted", () => {
  for (const input of ["15:", "15:1", "24:00", "12:60", "-1", "1,5", "noon"])
    assert.equal(normalizeClockTime(input), null);
});
