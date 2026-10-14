/** One rendered item may represent several tasks (collapsed calendar dots/rows). */
export function representedTaskIds(
  single: string | undefined,
  grouped: string | undefined,
): string[] {
  let ids: unknown = [];
  try {
    ids = grouped ? JSON.parse(grouped) : [];
  } catch {}
  return [
    ...new Set([
      ...(single ? [single] : []),
      ...(Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string" && !!id)
        : []),
    ]),
  ];
}
