import { isDateKey } from "./dates.ts";

export function normalizeTypedDate(text: string, year: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (isDateKey(trimmed)) return trimmed;
  const match =
    /^(\d{1,2})\s*[./]\s*(\d{1,2})(?:\s*[./]\s*(\d{4}|\d{2}))?\.?$/.exec(
      trimmed,
    );
  if (!match) return null;
  const typedYear = match[3]
    ? match[3].length === 2
      ? `20${match[3]}`
      : match[3]
    : year;
  const key = `${typedYear}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return isDateKey(key) ? key : null;
}

export function displayTypedDate(key: string): string {
  return isDateKey(key) ? key.split("-").reverse().join(".") : "";
}
