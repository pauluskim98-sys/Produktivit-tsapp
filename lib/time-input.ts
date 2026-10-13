/** Accept typed clock times without silently clamping invalid hours or minutes. */
export function normalizeClockTime(text: string): string | null {
  const value = text.trim();
  if (!value) return "";
  const match = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
