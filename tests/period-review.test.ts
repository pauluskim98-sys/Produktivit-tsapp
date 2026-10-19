import test from "node:test";
import assert from "node:assert/strict";
import {
  dueReviews,
  nextReviewPeriod,
  reviewKey,
} from "../lib/period-review.ts";
import {
  goalTarget,
  setGoalTarget,
  goalRange,
  goalProgress,
  validGoalRules,
} from "../lib/goals.ts";
import type { GoalSettings } from "../lib/goals.ts";
import type { Todo } from "../lib/types.ts";
const target = (n: number) => ({ target: n, unit: "hours" as const });
test("target edits carry forward but keep past periods and later manual overrides intact", () => {
  let settings: GoalSettings = {
    goalSettings: { sport: { week: target(2), month: target(8) } },
  };
  settings = setGoalTarget(settings, "sport", "week", "2026-10-26", target(3));
  settings = setGoalTarget(settings, "sport", "week", "2026-11-09", target(5));
  settings = setGoalTarget(settings, "sport", "week", "2026-11-02", target(4));
  assert.equal(goalTarget(settings, "sport", "week", "2026-10-25")?.target, 2);
  assert.equal(goalTarget(settings, "sport", "week", "2026-10-30")?.target, 3);
  assert.equal(goalTarget(settings, "sport", "week", "2026-11-02")?.target, 4);
  assert.equal(goalTarget(settings, "sport", "week", "2027-01-01")?.target, 5);
  settings = setGoalTarget(
    settings,
    "sport",
    "month",
    "2026-11-01",
    target(12),
  );
  assert.equal(goalTarget(settings, "sport", "month", "2026-10-31")?.target, 8);
  assert.equal(
    goalTarget(settings, "sport", "month", "2027-03-01")?.target,
    12,
  );
});
test("48 annual hours distribute to 4 monthly and 1 weekly without mutating state", () => {
  const old: GoalSettings = { goalSettings: { sport: { month: target(20) } } };
  const s = setGoalTarget(old, "sport", "year", "2027-01-01", target(48), true);
  assert.equal(goalTarget(s, "sport", "year", "2027-01-01")?.target, 48);
  assert.equal(goalTarget(s, "sport", "month", "2027-01-01")?.target, 4);
  assert.equal(goalTarget(s, "sport", "week", "2027-01-01")?.target, 1);
  assert.equal(goalTarget(s, "sport", "month", "2026-12-01")?.target, 20);
  assert.equal(old.goalPeriodSettings, undefined);
  const m = setGoalTarget(s, "sport", "month", "2027-02-01", target(8), true);
  assert.equal(goalTarget(m, "sport", "week", "2027-02-01")?.target, 2);
  assert.equal(goalTarget(m, "sport", "year", "2027-02-01")?.target, 48);
  const count = setGoalTarget(
    {},
    "social",
    "month",
    "2027-01-01",
    { target: 8, unit: "times" },
    true,
  );
  assert.deepEqual(goalTarget(count, "social", "week", "2027-01-01"), {
    target: 2,
    unit: "times",
  });
});
test("new week/month progress starts at zero without deleting the old achievements", () => {
  const tasks = [
    {
      id: "sport",
      title: "Sport",
      tags: ["c:sport"],
      plannedDate: "2026-10-25",
      time: "12:00",
      duration: 60,
      done: true,
    },
  ] as Todo[];
  const category = { id: "sport", name: "Sport" };
  assert.equal(
    goalProgress(
      category,
      target(1),
      tasks,
      [],
      goalRange("2026-10-25", "week"),
    ).completed,
    1,
  );
  assert.equal(
    goalProgress(
      category,
      target(1),
      tasks,
      [],
      goalRange("2026-10-26", "week"),
    ).completed,
    0,
  );
  assert.equal(
    goalProgress(
      category,
      target(1),
      tasks,
      [],
      goalRange("2026-11-01", "month"),
    ).planned,
    0,
  );
});
test("reviews appear on local Sundays and actual month endings, merging coincident dates", () => {
  assert.deepEqual(dueReviews(new Date(2026, 9, 19, 9)), []);
  assert.deepEqual(
    dueReviews(new Date(2026, 9, 25, 0)).map((p) => p.kind),
    ["week"],
  );
  assert.deepEqual(
    dueReviews(new Date(2026, 9, 31, 23, 59)).map((p) => p.kind),
    ["month"],
  );
  assert.deepEqual(
    dueReviews(new Date(2026, 4, 31, 12)).map((p) => p.kind),
    ["week", "month"],
  );
  assert.deepEqual(
    dueReviews(new Date(2028, 1, 29, 12)).map((p) => p.kind),
    ["month"],
  );
  assert.equal(
    reviewKey({ kind: "week", anchor: "2026-10-25" }),
    "week:2026-10-19",
  );
});
test("next review planning crosses year/month and daylight-saving boundaries correctly", () => {
  assert.equal(
    nextReviewPeriod({ kind: "week", anchor: "2026-10-25" }),
    "2026-10-26",
  );
  assert.equal(
    nextReviewPeriod({ kind: "month", anchor: "2026-12-31" }),
    "2027-01-01",
  );
  assert.equal(
    nextReviewPeriod({ kind: "month", anchor: "2028-02-29" }),
    "2028-03-01",
  );
});
test("persisted goal rules reject invalid periods, values, arrays and malformed dates", () => {
  assert.equal(validGoalRules(undefined), true);
  assert.equal(
    validGoalRules(
      setGoalTarget({}, "sport", "week", "2026-10-19", target(1))
        .goalPeriodSettings,
    ),
    true,
  );
  for (const bad of [
    null,
    [],
    { sport: [] },
    { sport: { day: {} } },
    { sport: { week: { "2026-10-20": target(1) } } },
    { sport: { month: { "2026-02-30": target(1) } } },
    { sport: { year: { "2026-01-01": target(0) } } },
    { sport: { week: { "2026-10-19": { target: Infinity, unit: "hours" } } } },
  ])
    assert.equal(validGoalRules(bad), false);
});
