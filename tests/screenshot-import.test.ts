import test from "node:test";
import assert from "node:assert/strict";
import {
  parseScreenshotImport,
  screenshotOccurrences,
  screenshotTasks,
} from "../lib/screenshot-import.ts";
import type { Todo } from "../lib/types.ts";
const base = "2026-10-13";
const draft = (title = "Yoga"): Todo => ({
  id: "primary",
  title,
  description: "",
  notes: "",
  plannedDate: "2026-10-15",
  time: "18:30",
  duration: 60,
  done: false,
  priority: "low",
  deadline: null,
  position: 1,
  subtasks: [],
  tags: [],
  createdAt: "",
  location: "",
});
test("two explicit dates become a finite same-title series with shared details", () => {
  const plan = parseScreenshotImport(
    "Yoga\n15.10.2026 18:30–19:30\n22.10.2026 18:30–19:30\nAdresse: Aachener Straße 123, 50931 Köln\nHinweis: Yogamatte mitbringen",
    base,
  );
  assert.deepEqual(
    plan.events.map((event) => event.plannedDate),
    ["2026-10-15", "2026-10-22"],
  );
  assert.deepEqual(
    plan.events.map((event) => event.title),
    ["Yoga", "Yoga"],
  );
  assert.equal(plan.events[0].duration, 60);
  assert.match(plan.events[0].description, /Yogamatte mitbringen/);
  assert.equal(plan.recurrence, undefined);
  let n = 0;
  const tasks = screenshotTasks(
    draft(),
    screenshotOccurrences(plan, draft()),
    () => `copy-${++n}`,
  );
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].seriesId, tasks[1].seriesId);
});
test("shorthand date lists preserve the shared month and year", () => {
  const plan = parseScreenshotImport(
    "Workshop\n15. und 22. Oktober 2026\n18:30–20:00",
    base,
  );
  assert.deepEqual(
    plan.events.map((event) => event.plannedDate),
    ["2026-10-15", "2026-10-22"],
  );
  assert.deepEqual(
    plan.events.map((event) => event.title),
    ["Workshop", "Workshop"],
  );
  assert.equal(plan.events[1].duration, 90);
});
test("separate event titles and times remain independent", () => {
  const plan = parseScreenshotImport(
    "Yoga\n15.10.2026 18:30\nKonzert\n16.10.2026 20:00",
    base,
  );
  assert.deepEqual(
    plan.events.map((event) => event.title),
    ["Yoga", "Konzert"],
  );
  assert.deepEqual(
    plan.events.map((event) => event.time),
    ["18:30", "20:00"],
  );
  let n = 0;
  const tasks = screenshotTasks(
    draft(),
    screenshotOccurrences(plan, draft()),
    () => `id-${++n}`,
  );
  assert.equal(tasks[0].seriesId, "");
  assert.equal(tasks[1].seriesId, "");
});
test("explicit weekly recurrence expands inclusively and deduplicates listed occurrences", () => {
  const plan = parseScreenshotImport(
    "Yoga\n15.10.2026 18:30–19:30\n22.10.2026 18:30–19:30\nJeden Donnerstag bis 29.10.2026",
    base,
  );
  assert.equal(plan.recurrence?.frequency, "weekly");
  assert.equal(plan.recurrence?.until, "2026-10-29");
  assert.deepEqual(
    screenshotOccurrences(plan, draft()).map((event) => event.plannedDate),
    ["2026-10-15", "2026-10-22", "2026-10-29"],
  );
});
test("a weekly label without an end gets a visible finite proposal", () => {
  const plan = parseScreenshotImport(
    "Yoga\n15.10.2026 18:30\nWöchentlich donnerstags",
    base,
  );
  assert.equal(plan.recurrence?.inferredEnd, true);
  assert.ok(plan.warnings.some((w) => w.includes("8 Wochen")));
  assert.equal(screenshotOccurrences(plan, draft()).length, 9);
});
test("monthly recurrence skips months where the day does not exist", () => {
  const plan = parseScreenshotImport(
    "Abrechnung\n31.01.2026 09:00\nMonatlich bis 31.05.2026",
    base,
  );
  const first = {
    ...draft("Abrechnung"),
    plannedDate: "2026-01-31",
    time: "09:00",
  };
  assert.deepEqual(
    screenshotOccurrences(plan, first).map((event) => event.plannedDate),
    ["2026-01-31", "2026-03-31", "2026-05-31"],
  );
});
test("manual changes to a primary title and time apply to its proposed repetitions", () => {
  const plan = parseScreenshotImport(
    "Yoga\n15.10.2026 18:30\n22.10.2026 18:30",
    base,
  );
  const events = screenshotOccurrences(plan, {
    ...draft("Yoga mit Lea"),
    time: "19:00",
  });
  assert.deepEqual(
    events.map((event) => event.title),
    ["Yoga mit Lea", "Yoga mit Lea"],
  );
  assert.deepEqual(
    events.map((event) => event.time),
    ["19:00", "19:00"],
  );
});
test("date-only screenshots do not invent a title, time, or recurrence", () => {
  const plan = parseScreenshotImport("TM ©\n15.10.2026\n22.10.2026", base);
  assert.equal(plan.events[0].title, "");
  assert.equal(plan.events[0].time, undefined);
  assert.equal(plan.recurrence, undefined);
});

test("same-line dates keep their own times and date shorthand without a year", () => {
  const plan = parseScreenshotImport(
    "Yoga\n15.10.2026 18:30 / 22.10.2026 20:00",
    base,
  );
  assert.deepEqual(
    plan.events.map((event) => event.time),
    ["18:30", "20:00"],
  );
  assert.deepEqual(
    plan.events.map((event) => event.title),
    ["Yoga", "Yoga"],
  );
  assert.equal(
    parseScreenshotImport("Yoga 15.10 18:30", base).events[0].plannedDate,
    "2026-10-15",
  );
});
test("different events retain their own address and short notes", () => {
  const plan = parseScreenshotImport(
    "Yoga\n15.10.2026 18:30\nAdresse: Aachener Straße 123, 50931 Köln\nHinweis: Matte mitbringen\nKonzert\n16.10.2026 20:00\nAdresse: Venloer Straße 10, 50672 Köln\nHinweis: Eintritt frei",
    base,
  );
  assert.equal(plan.events[0].location, "Aachener Straße 123, 50931 Köln");
  assert.equal(plan.events[1].location, "Venloer Straße 10, 50672 Köln");
  assert.ok(!plan.events[0].description.includes("Eintritt frei"));
  assert.ok(!plan.events[1].description.includes("Matte mitbringen"));
});
test("existing primary subtask identities survive an atomic screenshot edit", () => {
  const first = {
    ...draft(),
    subtasks: [{ id: "existing-step", title: "Matte einpacken", done: true }],
  };
  let n = 0;
  const tasks = screenshotTasks(
    first,
    [
      {
        title: "Yoga",
        description: "",
        plannedDate: "2026-10-15",
        time: "18:30",
      },
      {
        title: "Yoga",
        description: "",
        plannedDate: "2026-10-22",
        time: "18:30",
      },
    ],
    () => `new-${++n}`,
    true,
  );
  assert.equal(tasks[0].id, first.id);
  assert.equal(tasks[0].subtasks[0].id, "existing-step");
  assert.notEqual(tasks[1].subtasks[0].id, "existing-step");
  assert.equal(tasks[1].subtasks[0].done, false);
});

test("admission notes retain their own time while labelled start takes precedence", () => {
  const plan = parseScreenshotImport(
    "Konzert\n15.10.2026\nEinlass: 17:30\nBeginn: 18:00–20:00\nHinweis: Eintritt frei",
    base,
  );
  assert.equal(plan.events[0].time, "18:00");
  assert.equal(plan.events[0].duration, 120);
  assert.equal(plan.events[0].description, "Einlass: 17:30\nEintritt frei");
});
