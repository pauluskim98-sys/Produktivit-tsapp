import assert from "node:assert/strict";
import test from "node:test";
import { parseAppointmentInput, parseRecurringAppointmentInput } from "../lib/appointment-input.ts";
import { normalizeClockNotation } from "../lib/clock-notation.ts";
const base = "2026-10-12";
test("short hours after um are recognized without interpreting bare numbers",()=>{
  assert.equal(parseAppointmentInput("Arzt um 11",base).time,"11:00");
  assert.equal(parseAppointmentInput("Arzt um 11",base).title,"Arzt");
  assert.equal(parseAppointmentInput("Kurs um 11 bis 13",base).duration,120);
  assert.equal(parseAppointmentInput("Kapitel 11",base).time,undefined);
});
test("natural German recurrence keeps the first matching date and cleans the saved title",()=>{
  const weekly=parseRecurringAppointmentInput("Lernen jeden Montag und Mittwoch um 11","2026-10-13");
  assert.deepEqual([weekly.title,weekly.plannedDate,weekly.time,weekly.repeatDays],["Lernen","2026-10-14","11:00",[0,2]]);
  assert.deepEqual(parseRecurringAppointmentInput("Sport dienstags und freitags um 9",base).repeatDays,[1,4]);
  assert.deepEqual(parseRecurringAppointmentInput("Sport immer Mo/Mi/Fr um 9",base).repeatDays,[0,2,4]);
  assert.equal(parseRecurringAppointmentInput("Lesen jeden Tag um 8",base).repeatDays.length,7);
  assert.equal(parseRecurringAppointmentInput("Das gilt für immer",base).repeatDays.length,0);
});
test("weekday abbreviations work with or without a clock time", () => {
  const monday = parseAppointmentInput("Lernen mo 16:00", "2026-11-05");
  assert.equal(monday.title, "Lernen");
  assert.equal(monday.plannedDate, "2026-11-09");
  assert.equal(monday.time, "16:00");
  assert.equal(parseAppointmentInput("Arzt Mi. 8 Uhr", base).plannedDate, "2026-10-14");
  assert.equal(parseAppointmentInput("Training fr", base).plannedDate, "2026-10-16");
  assert.equal(parseAppointmentInput("so schnell wie möglich", base).title, "so schnell wie möglich");
});
test("extract date and time range while keeping a clean title", () => {
  const result = parseAppointmentInput(
    "Yoga am 15.10.2026 um 18:30–20:00",
    base,
  );
  assert.equal(result.title, "Yoga");
  assert.equal(result.plannedDate, "2026-10-15");
  assert.equal(result.time, "18:30");
  assert.equal(result.duration, 90);
});
test("pasted event keeps source in editable title and only contacts in description", () => {
  const result = parseAppointmentInput(
    "Titel: Konzert\nDatum: Freitag, 16. Oktober 2026\nUhrzeit: 19:00–21:00 Uhr\nOrt: Köln\nhttps://example.com/konzert",
    base,
  );
  assert.equal(result.title, "Konzert\nhttps://example.com/konzert");
  assert.equal(result.plannedDate, "2026-10-16");
  assert.equal(result.time, "19:00");
  assert.equal(result.duration, 120);
  assert.equal(result.description, "Adresse: Köln");
});
test("relative dates and explicit hours", () => {
  const result = parseAppointmentInput("Arzt morgen 9 Uhr", base);
  assert.equal(result.title, "Arzt");
  assert.equal(result.plannedDate, "2026-10-13");
  assert.equal(result.time, "09:00");
});
test("natural language extracts separate minute and hour durations into a clean title", () => {
  for (const [text, minutes] of [
    ["Morgen 16 Uhr 90 min Anatomie", 90],
    ["Anatomie morgen um 16:00 für 1,5 Stunden", 90],
    ["Anatomie 16 Uhr 45 Min.", 45],
    ["Anatomie 16 Uhr Dauer: 2 h", 120],
  ] as const) {
    const r = parseAppointmentInput(text, "2026-10-19");
    assert.equal(r.title, "Anatomie", text);
    assert.equal(r.time, "16:00", text);
    assert.equal(r.duration, minutes, text);
  }
  assert.equal(
    parseAppointmentInput(
      "Morgen 16 Uhr 90 min Anatomie",
      "2026-10-25",
      "2026-10-19",
    ).plannedDate,
    "2026-10-20",
  );
  assert.equal(
    parseAppointmentInput("Kapitel 90 lernen", "2026-10-19").title,
    "Kapitel 90 lernen",
  );
});
test("invalid dates and ordinary numbers stay untouched", () => {
  assert.equal(
    parseAppointmentInput("Kapitel 12 lernen", base).title,
    "Kapitel 12 lernen",
  );
  assert.equal(
    parseAppointmentInput("Test 31.02.2026", base).plannedDate,
    undefined,
  );
});
test("overnight ranges and existing task text", () => {
  assert.equal(parseAppointmentInput("Feier 23:00–01:00", base).duration, 120);
  assert.equal(
    parseAppointmentInput("Treffen am See", base).title,
    "Treffen am See",
  );
});

test("numeric date/time only and slash dates are recognised without a title", () => {
  const result = parseAppointmentInput("16/10/2026\n19:30", base);
  assert.equal(result.plannedDate, "2026-10-16");
  assert.equal(result.time, "19:30");
  assert.equal(result.title, "");
});

test("screenshot content remains editable while telephone and address become notes", () => {
  const result = parseAppointmentInput(
    "Workshop\nFotografie für Anfänger\n16.10.2026 18:00\nAdresse: Aachener Straße 123, 50931 Köln\nTelefon: +49 221 1234567",
    base,
  );
  assert.equal(result.title, "Workshop\nFotografie für Anfänger");
  assert.equal(result.time, "18:00");
  assert.equal(result.plannedDate, "2026-10-16");
  assert.equal(
    result.description,
    "Adresse: Aachener Straße 123, 50931 Köln\nTelefon: +49 221 1234567",
  );
});

test("German dotted times, hour ranges and spaced OCR times are extracted", () => {
  for (const [text, time, duration] of [
    ["Yoga 16.10.2026 14.00 Uhr", "14:00", undefined],
    ["Yoga 16.10.2026 14–16 Uhr", "14:00", 120],
    ["Yoga 16.10.2026 14 : 30 – 16 : 00", "14:30", 90],
    ["Yoga 16.10.2026 09.05–10.30 Uhr", "09:05", 85],
    ["Yoga 16.10.2026 18:OO–2O:00 Uhr", "18:00", 120],
  ] as const) {
    const result = parseAppointmentInput(text, base);
    assert.equal(result.plannedDate, "2026-10-16");
    assert.equal(result.time, time, text);
    assert.equal(result.duration, duration, text);
    assert.equal(result.title, "Yoga", text);
  }
});
test("labelled start and end override an unrelated clock and define duration", () => {
  const result = parseAppointmentInput(
    "19:02\nYoga\n16.10.2026\nBeginn 09.05 Uhr\nEnde: 10.30 Uhr",
    base,
  );
  assert.equal(result.time, "09:05");
  assert.equal(result.duration, 85);
  assert.equal(parseAppointmentInput("Yoga 09.05.2026", base).time, undefined);
});

test("date ranges remain dates while unambiguous dotted clocks become times", () => {
  assert.equal(normalizeClockNotation("09.05–10.06.2026"), "09.05–10.06.2026");
  assert.equal(normalizeClockNotation("09.05–10.06"), "09.05–10.06");
  assert.equal(
    parseAppointmentInput("Yoga 16.10.2026 14.00", base).time,
    "14:00",
  );
});
