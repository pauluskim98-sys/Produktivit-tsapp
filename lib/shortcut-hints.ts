export const SHORTCUT_HINT_KEY = "lifemap-shortcut-hints";
export type ShortcutPreference = {
  version: 1;
  enabled: boolean;
  days: number;
  expiresAt: number | null;
};
export function hintDays(value: number) {
  return Math.max(1, Math.min(365, Math.round(value) || 7));
}
export function shortcutPreference(
  enabled: boolean,
  days: number,
  now = Date.now(),
): ShortcutPreference {
  days = hintDays(days);
  return {
    version: 1,
    enabled,
    days,
    expiresAt: enabled ? now + days * 86400000 : null,
  };
}
export function readShortcutPreference(
  raw: string | null,
): ShortcutPreference | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      typeof value.enabled !== "boolean" ||
      !Number.isInteger(value.days) ||
      value.days < 1 ||
      value.days > 365 ||
      (value.enabled &&
        (!Number.isFinite(value.expiresAt) || value.expiresAt <= 0)) ||
      (!value.enabled && value.expiresAt !== null)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function shortcutsActive(
  value: ShortcutPreference | null,
  now = Date.now(),
) {
  return Boolean(
    value?.enabled && value.expiresAt !== null && value.expiresAt > now,
  );
}
