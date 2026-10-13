import { totalDuration } from "./schedule.ts";
import type { Todo, CalendarEvent } from "./types";
export function dayAssessment(
  tasks: Todo[],
  events: CalendarEvent[],
  day: string,
): string[] {
  const open = tasks.filter((t) => !t.done),
    planned = open.filter((t) => t.time),
    unplanned = open.length - planned.length;
  const minutes = planned.reduce((n, t) => n + totalDuration(t), 0);
  const tips = [
    `${open.length} offene Aufgaben, davon ${unplanned} ohne Uhrzeit.`,
    `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min. für Aufgaben eingeplant${events.length ? ` plus ${events.length} Kalendertermine` : ""}.`,
  ];
  const ranges = [
    ...planned.map((t) => {
      const start =
        new Date(`${day}T${t.time}`).getTime() - (t.travelBefore || 0) * 60000;
      return { start, end: start + totalDuration(t) * 60000 };
    }),
    ...events
      .filter((e) => !e.allDay)
      .map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end) })),
  ].sort((a, b) => a.start - b.start);
  let end = -Infinity,
    overlap = false;
  for (const r of ranges) {
    if (r.start < end) overlap = true;
    end = Math.max(end, r.end);
  }
  if (overlap)
    tips.push(
      "Einige Zeitblöcke überschneiden sich. Prüfe, ob du sie nacheinander einplanen möchtest.",
    );
  else if (minutes > 360)
    tips.push(
      "Du hast mehr als sechs Stunden für Aufgaben reserviert. Halte Platz für Pausen und Unerwartetes frei.",
    );
  else if (unplanned)
    tips.push(
      "Wähle für die noch offenen Aufgaben zuerst einen passenden Zeitblock.",
    );
  else
    tips.push(
      open.length
        ? "Zwischen festen Terminen etwas Puffer lassen."
        : "Für diesen Tag sind keine offenen Aufgaben eingeplant.",
    );
  return tips;
}

export function eventsForDay(events: CalendarEvent[], day: string) {
  const start = new Date(day + "T00:00:00"),
    end = new Date(start);
  end.setDate(end.getDate() + 1);
  return events.filter((e) =>
    e.allDay
      ? e.start.slice(0, 10) <= day && e.end.slice(0, 10) > day
      : Date.parse(e.start) < end.getTime() &&
        Date.parse(e.end) > start.getTime(),
  );
}
