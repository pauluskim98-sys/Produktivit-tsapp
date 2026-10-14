"use client";
import { CalendarDays, Hourglass, Play } from "lucide-react";
import DateInput from "./date-input";
import TimeInput from "./time-input";
import DurationHours from "./duration-hours";

export default function ScheduleFields({
  date,
  time,
  duration,
  onChange,
  showDate = true,
  labels = ["Termindatum", "Terminbeginn", "Dauer in Stunden"],
  imported = {},
  groupLabel = "Datum und Uhrzeit",
}: {
  date?: string;
  time: string;
  duration: number;
  showDate?: boolean;
  labels?: [string, string, string];
  groupLabel?: string;
  imported?: { date?: boolean; time?: boolean; duration?: boolean };
  onChange: (patch: {
    plannedDate?: string;
    time?: string;
    duration?: number;
  }) => void;
}) {
  return (
    <fieldset
      className={`schedule-picker schedule-fields-common ${showDate ? "" : "schedule-time-only"}`}
      aria-label={groupLabel}
    >
      {showDate && (
        <label className="schedule-field">
          <CalendarDays size={14} aria-hidden="true" />
          <DateInput
            label={labels[0]}
            value={date || ""}
            imported={imported.date}
            onChange={(plannedDate) => onChange({ plannedDate })}
          />
        </label>
      )}
      <label className="schedule-field">
        <Play size={14} aria-hidden="true" />
        <TimeInput
          label={labels[1]}
          value={time}
          imported={imported.time}
          onChange={(time) => onChange({ time })}
        />
      </label>
      <label className="schedule-field" data-imported={imported.duration}>
        <Hourglass size={14} aria-hidden="true" />
        <DurationHours
          label={labels[2]}
          minutes={duration}
          onChange={(duration) => onChange({ duration })}
        />
      </label>
    </fieldset>
  );
}
