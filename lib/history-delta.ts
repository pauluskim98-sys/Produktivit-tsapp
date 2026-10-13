// Replay only fields changed by this command, preserving independent updates.
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function applyHistoryDelta(current: any, from: any, to: any): any {
  if (same(from, to)) return current;
  if (
    Array.isArray(from) &&
    Array.isArray(to) &&
    Array.isArray(current) &&
    [...from, ...to].every(
      (x) => x && typeof x === "object" && typeof x.id === "string",
    )
  ) {
    const fromMap = new Map(from.map((x) => [x.id, x])),
      toMap = new Map(to.map((x) => [x.id, x]));
    const result = current
      .map((x) =>
        fromMap.has(x.id)
          ? applyHistoryDelta(x, fromMap.get(x.id), toMap.get(x.id))
          : x,
      )
      .filter((x) => x !== undefined);
    for (const x of to)
      if (!fromMap.has(x.id)) {
        if (current.some((y: any) => y.id === x.id))
          throw new Error("Dieser Eintrag wurde inzwischen geändert.");
        result.push(x);
      }
    for (const x of from)
      if (!current.some((y: any) => y.id === x.id) && !same(x, toMap.get(x.id)))
        throw new Error("Dieser Eintrag wurde inzwischen geändert.");
    return result;
  }
  if (
    from &&
    to &&
    current &&
    !Array.isArray(from) &&
    typeof from === "object" &&
    typeof to === "object" &&
    typeof current === "object"
  ) {
    const next = { ...current };
    for (const k of new Set([...Object.keys(from), ...Object.keys(to)])) {
      if (!same(from[k], to[k])) {
        const value = applyHistoryDelta(current[k], from[k], to[k]);
        if (value === undefined) delete next[k];
        else next[k] = value;
      }
    }
    return next;
  }
  if (!same(current, from))
    throw new Error(
      "Dieser Eintrag wurde inzwischen geändert. Die neue Änderung bleibt erhalten.",
    );
  return to;
}
