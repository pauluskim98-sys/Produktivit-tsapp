export interface SavedAddress {
  id: string;
  name: string;
  address: string;
}
const normalized = (s: string) =>
  s.toLocaleLowerCase("de-DE").normalize("NFD").replace(/\p{M}/gu, "").trim();
export function matchingAddresses(entries: SavedAddress[], query: string) {
  const q = normalized(query);
  const score = (e: SavedAddress) =>
    normalized(e.name).startsWith(q)
      ? 0
      : normalized(e.address).startsWith(q)
        ? 1
        : 2;
  return entries
    .filter((e) => !q || normalized(e.name + " " + e.address).includes(q))
    .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, "de"));
}
export function validAddress(entry: unknown): SavedAddress {
  const e = entry as SavedAddress;
  if (
    !e ||
    typeof e.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(e.id) ||
    typeof e.name !== "string" ||
    !e.name.trim() ||
    e.name.length > 100 ||
    typeof e.address !== "string" ||
    !e.address.trim() ||
    e.address.length > 1000
  )
    throw new Error("Bitte Name und Adresse angeben.");
  return { id: e.id, name: e.name.trim(), address: e.address.trim() };
}
