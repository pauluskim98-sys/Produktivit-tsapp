export function hoursToMinutes(text: string): number | null {
  if (!/^\d+(?:[.,]\d*)?$/.test(text.trim())) return null;
  const hours = Number(text.trim().replace(",", "."));
  return Number.isFinite(hours) && hours > 0 && hours <= 24
    ? Math.max(1, Math.round(hours * 60))
    : null;
}
