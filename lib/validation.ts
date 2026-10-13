import { TASK_COLOR_VALUES } from "./task-colors.ts";
import type { Todo } from "./types";
import { isDateKey } from "./dates.ts";
export function validTodo(value: unknown): Todo {
  if (!value || typeof value !== "object")
    throw new Error("Ungültige Aufgabe.");
  const t = value as Todo;
  if (typeof t.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(t.id))
    throw new Error("Ungültige Aufgaben-ID.");
  if (typeof t.title !== "string" || !t.title.trim() || t.title.length > 500)
    throw new Error("Bitte einen Titel mit höchstens 500 Zeichen eingeben.");
  if (
    !["none", "low", "medium", "high"].includes(t.priority) ||
    typeof t.done !== "boolean"
  )
    throw new Error("Ungültiger Status.");
  for (const field of ["description", "notes"] as const)
    if (
      typeof t[field] !== "string" ||
      t[field].length > (field === "description" ? 60000 : 30000)
    )
      throw new Error("Notiz ist zu lang.");
  for (const field of ["plannedDate", "deadline"] as const)
    if (t[field] !== null && !isDateKey(t[field]))
      throw new Error("Ungültiges Datum.");
  if (
    typeof t.time !== "string" ||
    (t.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))
  )
    throw new Error("Ungültige Uhrzeit.");
  if (
    t.duration !== null &&
    (!Number.isInteger(t.duration) || t.duration < 1 || t.duration > 10080)
  )
    throw new Error("Dauer muss zwischen 1 und 10080 Minuten liegen.");
  if (!Number.isFinite(t.position)) throw new Error("Ungültige Reihenfolge.");
  if (
    !Array.isArray(t.tags) ||
    t.tags.length > 20 ||
    t.tags.some((s) => typeof s !== "string" || !s.trim() || s.length > 40)
  )
    throw new Error("Ungültige Tags.");
  if (
    !Array.isArray(t.subtasks) ||
    t.subtasks.length > 100 ||
    t.subtasks.some(
      (s) =>
        !s ||
        typeof s.id !== "string" ||
        s.id.length > 80 ||
        typeof s.title !== "string" ||
        !s.title.trim() ||
        s.title.length > 500 ||
        typeof s.done !== "boolean",
    )
  )
    throw new Error("Ungültige Unteraufgaben.");
  if (new Set(t.subtasks.map((s) => s.id)).size !== t.subtasks.length)
    throw new Error("Unteraufgaben müssen eindeutige IDs haben.");
  if (
    typeof t.createdAt !== "string" ||
    !Number.isFinite(Date.parse(t.createdAt))
  )
    throw new Error("Ungültiges Erstellungsdatum.");
  if (t.color !== undefined && !TASK_COLOR_VALUES.includes(t.color))
    throw new Error("Ungültige Farbe.");
  if (t.reminder !== undefined && typeof t.reminder !== "boolean")
    throw new Error("Ungültige Erinnerung.");
  if (
    t.seriesId !== undefined &&
    (typeof t.seriesId !== "string" ||
      (t.seriesId !== "" && !/^[a-zA-Z0-9-]{1,80}$/.test(t.seriesId)))
  )
    throw new Error("Ungültige Termingruppe.");
  if (
    t.location !== undefined &&
    (typeof t.location !== "string" || t.location.length > 1000)
  )
    throw new Error("Ungültige Adresse.");
  if (
    t.travelMode !== undefined &&
    !["", "bike", "transit"].includes(t.travelMode)
  )
    throw new Error("Ungültiges Verkehrsmittel.");
  for (const key of ["travelBefore", "travelAfter"] as const)
    if (
      t[key] !== undefined &&
      (!Number.isInteger(t[key]) || t[key]! < 0 || t[key]! > 1440)
    )
      throw new Error("Wegzeit muss zwischen 0 und 1440 Minuten liegen.");
  return {
    ...t,
    seriesId: t.seriesId || "",
    reminder: Boolean(t.reminder),
    color: t.color || "green",
    title: t.title.trim(),
    tags: [...new Set(t.tags.map((s) => s.trim()))],
  };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !==
      (request.headers.get("host") || new URL(request.url).host)
  )
    throw new Error("Diese Anfrage ist nicht erlaubt.");
}
export function errorResponse(error: unknown, status = 400) {
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Die Anfrage konnte nicht verarbeitet werden.",
    },
    { status },
  );
}
