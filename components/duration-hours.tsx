"use client";
import { useEffect, useRef, useState } from "react";
import { hoursToMinutes } from "../lib/duration-hours.ts";
export default function DurationHours({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const display = () =>
    Number((minutes / 60).toFixed(3)).toLocaleString("de-DE");
  const [text, setText] = useState(display);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(display());
  }, [minutes]);
  return (
    <span className="hours-input">
      <input
        aria-label="Dauer in Stunden"
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => (focused.current = true)}
        onChange={(e) => {
          setText(e.target.value);
          const value = hoursToMinutes(e.target.value);
          if (value !== null) onChange(value);
        }}
        onBlur={() => {
          focused.current = false;
          setText(display());
        }}
      />
      <span>Std.</span>
    </span>
  );
}
