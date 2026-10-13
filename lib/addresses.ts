export function addressFromText(text: string): string {
  const explicit = text
    .match(/(?:Adresse|Anschrift|Ort|Location)\s*:\s*([^\n]+)/i)?.[1]
    ?.trim();
  if (explicit) return explicit;
  return (
    text
      .match(
        /(?:[\p{L}.'-]+\s+(?=(?:straße|strasse|str\.|weg|platz|allee|gasse)\b))?[\p{L}.'-]*(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|ufer|damm)\s+\d+[a-z]?(?:\s*[-/]\s*\d+[a-z]?)?(?:,?\s+\d{5}\s+[\p{L}.'-]+(?:\s+[\p{L}.'-]+)?|,\s*[\p{L}.'-]+)?/iu,
      )?.[0]
      ?.trim() || ""
  );
}
export function mapsAddress(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Telephone numbers require a local leading zero or an international prefix. */
export function phonesFromText(text: string): string[] {
  return [
    ...new Set(
      (
        text.match(/(?:\+\d{1,3}|0\d{2,5})[ ()/.-]*\d(?:[ ()/.-]*\d){4,12}/g) ||
        []
      )
        .map((number) => number.trim())
        .filter(
          (number) =>
            number.replace(/\D/g, "").length >= 7 &&
            !/^0?\d[./]\d{1,2}[./]\d{4}$/.test(number),
        ),
    ),
  ];
}
export function phoneLink(number: string) {
  return `tel:${number.replace(/[^+\d]/g, "")}`;
}
