"use client";
import { useEffect, useRef, useState } from "react";
import { displayTypedDate, normalizeTypedDate } from "@/lib/date-input";

export default function DateInput({
  value,
  onChange,
  label,
  imported,
}: {
  value: string;
  onChange: (date: string) => void;
  label: string;
  imported?: boolean;
}) {
  const [text, setText] = useState(() => displayTypedDate(value));
  const focused = useRef(false);
  const year = value.slice(0, 4) || String(new Date().getFullYear());
  useEffect(() => {
    if (!focused.current) setText(displayTypedDate(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="text"
      aria-label={label}
      placeholder="TT.MM.JJJJ"
      data-imported={imported}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (
          /^\d{1,2}[./]\d{1,2}[./]\d{4}$|^\d{4}-\d{2}-\d{2}$/.test(next) ||
          next === ""
        ) {
          const date = normalizeTypedDate(next, year);
          if (date !== null) onChange(date);
        }
      }}
      onBlur={() => {
        focused.current = false;
        const date = normalizeTypedDate(text, year);
        setText(displayTypedDate(date === null ? value : date));
        if (date !== null && date !== value) onChange(date);
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
