"use client";
import { CalendarDays, Clock3, Repeat2, ScanText, X } from "lucide-react";
import type { Todo } from "@/lib/types";
import { addDays, dateKey, parseDate } from "@/lib/dates";
import {
  screenshotOccurrences,
  type ScreenshotImport,
} from "@/lib/screenshot-import";
export default function ScreenshotImportReview({
  plan,
  draft,
  onChange,
}: {
  plan: ScreenshotImport;
  draft: Todo;
  onChange: (plan: ScreenshotImport) => void;
}) {
  const occurrences = screenshotOccurrences(plan, draft);
  const patchEvent = (
    index: number,
    patch: Partial<ScreenshotImport["events"][number]>,
  ) =>
    onChange({
      ...plan,
      events: plan.events.map((event, i) =>
        i === index ? { ...event, ...patch } : event,
      ),
    });
  const rule = plan.recurrence;
  return (
    <section
      className="screenshot-review"
      aria-label="Screenshot-Import prüfen"
      data-imported
    >
      <header>
        <span>
          <ScanText size={16} /> Aus Screenshot
        </span>
        <small>Noch nicht gespeichert</small>
      </header>
      <div className="screenshot-import-count">
        {occurrences.length > 1 ? `${occurrences.length} Termine` : "1 Termin"}
        {rule && (
          <span>
            <Repeat2 size={12} />{" "}
            {rule.frequency === "weekly"
              ? "Wöchentlich"
              : rule.frequency === "daily"
                ? "Täglich"
                : "Monatlich"}
          </span>
        )}
      </div>
      {plan.warnings.map((warning) => (
        <p className="screenshot-warning" key={warning}>
          {warning}
        </p>
      ))}
      {plan.events.length > 1 && (
        <details className="screenshot-extra-events" open>
          <summary>Weitere erkannte Termine</summary>
          {plan.events.slice(1).map((event, i) => (
            <div className="screenshot-event-draft" key={i}>
              <div className="screenshot-event-title">
                <input
                  aria-label={`Titel von Termin ${i + 2}`}
                  value={
                    event.title === plan.events[0].title
                      ? draft.title
                      : event.title
                  }
                  onChange={(e) => patchEvent(i + 1, { title: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Termin ${i + 2} entfernen`}
                  onClick={() =>
                    onChange({
                      ...plan,
                      events: plan.events.filter((_, n) => n !== i + 1),
                    })
                  }
                >
                  <X size={13} />
                </button>
              </div>
              <div className="screenshot-event-schedule">
                <label>
                  <CalendarDays size={13} />
                  <input
                    type="date"
                    aria-label={`Datum von Termin ${i + 2}`}
                    value={event.plannedDate || ""}
                    onChange={(e) =>
                      patchEvent(i + 1, { plannedDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  <Clock3 size={13} />
                  <input
                    type="time"
                    aria-label={`Uhrzeit von Termin ${i + 2}`}
                    value={
                      event.time === plan.events[0].time
                        ? draft.time
                        : event.time || ""
                    }
                    onChange={(e) =>
                      patchEvent(i + 1, { time: e.target.value })
                    }
                  />
                </label>
                <label>
                  <input
                    type="number"
                    min="1"
                    max="10080"
                    aria-label={`Dauer von Termin ${i + 2} in Minuten`}
                    value={
                      event.duration === plan.events[0].duration
                        ? draft.duration || ""
                        : event.duration || ""
                    }
                    onChange={(e) =>
                      patchEvent(i + 1, {
                        duration: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <span>Min.</span>
                </label>
              </div>
              {event.description &&
                event.description !== plan.events[0].description && (
                  <textarea
                    aria-label={`Notiz von Termin ${i + 2}`}
                    value={event.description}
                    onChange={(e) =>
                      patchEvent(i + 1, { description: e.target.value })
                    }
                  />
                )}
            </div>
          ))}
        </details>
      )}
      {rule ? (
        <div className="screenshot-recurrence" data-imported>
          <div className="screenshot-repeat-heading">
            <span>
              <Repeat2 size={14} /> Wiederholung
            </span>
            <button
              type="button"
              aria-label="Erkannte Wiederholung entfernen"
              onClick={() =>
                onChange({
                  ...plan,
                  recurrence: undefined,
                  warnings: plan.warnings.filter(
                    (w) => !w.startsWith("Kein Enddatum"),
                  ),
                })
              }
            >
              <X size={13} />
            </button>
          </div>
          <div className="screenshot-repeat-controls">
            <select
              aria-label="Wiederholungsrhythmus"
              value={rule.frequency}
              onChange={(e) =>
                onChange({
                  ...plan,
                  recurrence: {
                    ...rule,
                    frequency: e.target.value as typeof rule.frequency,
                  },
                })
              }
            >
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </select>
            <label>
              Alle{" "}
              <input
                type="number"
                min="1"
                max="12"
                aria-label="Wiederholungsintervall"
                value={rule.interval}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    recurrence: {
                      ...rule,
                      interval: Math.max(
                        1,
                        Math.min(12, Number(e.target.value) || 1),
                      ),
                    },
                  })
                }
              />
              {rule.frequency === "daily"
                ? "Tage"
                : rule.frequency === "weekly"
                  ? "Wochen"
                  : "Monate"}
            </label>
          </div>
          {rule.frequency === "weekly" && (
            <div className="repeat-days">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day, index) => (
                <button
                  type="button"
                  key={day}
                  aria-pressed={rule.weekdays.includes(index)}
                  aria-label={`Wiederholung ${day}`}
                  onClick={() =>
                    onChange({
                      ...plan,
                      recurrence: {
                        ...rule,
                        weekdays: rule.weekdays.includes(index)
                          ? rule.weekdays.filter((d) => d !== index)
                          : [...rule.weekdays, index],
                      },
                    })
                  }
                >
                  {day}
                </button>
              ))}
            </div>
          )}
          <div className="screenshot-repeat-controls">
            <label>
              Bis{" "}
              <input
                type="date"
                aria-label="Enddatum der erkannten Wiederholung"
                min={draft.plannedDate || undefined}
                value={rule.until}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    warnings: plan.warnings.filter(
                      (w) => !w.startsWith("Kein Enddatum"),
                    ),
                    recurrence: {
                      ...rule,
                      until: e.target.value,
                      inferredEnd: false,
                    },
                  })
                }
              />
            </label>
            <label>
              Max.{" "}
              <input
                type="number"
                aria-label="Anzahl der erkannten Termine"
                min="1"
                max="366"
                placeholder="—"
                value={rule.count || ""}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    recurrence: {
                      ...rule,
                      count: e.target.value
                        ? Math.max(1, Math.min(366, Number(e.target.value)))
                        : undefined,
                    },
                  })
                }
              />
            </label>
          </div>
          <div className="screenshot-date-preview">
            {occurrences.slice(0, 6).map((event, i) => (
              <span key={i}>
                {event.plannedDate
                  ? parseDate(event.plannedDate).toLocaleDateString("de-DE", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Datum offen"}
                {event.time ? ` · ${event.time}` : ""}
              </span>
            ))}
            {occurrences.length > 6 && (
              <span>+{occurrences.length - 6} weitere</span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="screenshot-repeat-add"
          disabled={!draft.plannedDate}
          onClick={() => {
            const start = draft.plannedDate!;
            onChange({
              ...plan,
              recurrence: {
                frequency: "weekly",
                interval: 1,
                weekdays: [(parseDate(start).getDay() + 6) % 7],
                until: dateKey(addDays(parseDate(start), 56)),
                inferredEnd: true,
              },
              warnings: [
                ...plan.warnings,
                "Kein Enddatum erkannt – zunächst 8 Wochen vorgeschlagen.",
              ],
            });
          }}
        >
          <Repeat2 size={13} /> Wiederholen
        </button>
      )}
    </section>
  );
}
