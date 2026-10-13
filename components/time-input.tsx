"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeClockTime } from "@/lib/time-input";

export default function TimeInput({
  value,
  onChange,
  label,
  imported,
}: {
  value: string;
  onChange: (time: string) => void;
  label: string;
  imported?: boolean;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  function commit() {
    const time = normalizeClockTime(text);
    if (time === null) setText(value);
    else {
      setText(time);
      if (time !== value) onChange(time);
    }
  }
  return (
    <input
      type="text"
      inputMode="text"
      aria-label={label}
      placeholder="09:00"
      maxLength={5}
      data-imported={imported}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        // Complete times update immediately; partial typing stays local.
        if (/^\d{1,2}[:.]\d{2}$/.test(next) || next === "") {
          const time = normalizeClockTime(next);
          if (time !== null) onChange(time);
        }
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
