export type Suggestion = {
  id: string;
  title: string;
  notes: string;
  url: string;
  image?: string;
  source: string;
  tags: string[];
};
/** Stable short key shared with the browser, independent of source-specific IDs. */
export function suggestionKey(item: { id: string; url?: string }) {
  let value = item.id.startsWith("meal-") ? item.id : item.url || item.id;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const name of [...url.searchParams.keys()])
      if (/^(utm_|fbclid$|gclid$)/i.test(name)) url.searchParams.delete(name);
    url.searchParams.sort();
    value = url.href.replace(/\/$/, "");
  } catch {}
  let hash = 2166136261;
  for (const character of value)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
export function unseenSuggestions(
  items: Suggestion[],
  seen: Iterable<string>,
  limit = 8,
) {
  const known = new Set(seen);
  const result: Suggestion[] = [];
  for (const item of items) {
    const key = suggestionKey(item);
    if (known.has(key)) continue;
    known.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
