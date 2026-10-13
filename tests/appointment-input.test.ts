import assert from "node:assert/strict";
import test from "node:test";
import { parseAppointmentInput } from "../lib/appointment-input.ts";
const base = "2026-10-12";
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
