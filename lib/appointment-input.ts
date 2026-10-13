import { addressFromText, phonesFromText } from "./addresses.ts";
import { addDays, dateKey, isDateKey, parseDate } from "./dates.ts";

/** Extract explicit German dates/times; keep unrecognised details as text. */
export function parseAppointmentInput(
  text: string,
  base = dateKey(new Date()),
) {
  const location = addressFromText(text);
  let cleaned = location
    ? text
        .replace(location, " ")
        .replace(/(?:Adresse|Anschrift|Ort|Location)\s*:\s*(?=\n|$)/gi, "")
    : text;
  let plannedDate: string | undefined,
    time: string | undefined,
    duration: number | undefined;
  const takeDate = (match: RegExpMatchArray | null, key: string) => {
    if (!match || !isDateKey(key)) return false;
    plannedDate = key;
    cleaned = cleaned.replace(match[0], " ");
    return true;
  };
  const key = (day: string, month: string, year?: string) =>
    `${year ? (year.length === 2 ? `20${year}` : year) : base.slice(0, 4)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  let match = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (match) takeDate(match, `${match[1]}-${match[2]}-${match[3]}`);
  else {
    match = cleaned.match(/\b(\d{1,2})[./](\d{1,2})[./](?:(\d{4}|\d{2})\b)?/);
    if (match) takeDate(match, key(match[1], match[2], match[3]));
    else {
      const months = [
        "januar",
        "februar",
        "märz",
        "april",
        "mai",
        "juni",
        "juli",
        "august",
        "september",
        "oktober",
        "november",
        "dezember",
      ];
      match = cleaned.match(
        /\b(\d{1,2})\.?\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s+(\d{4}))?\b/i,
      );
      if (match)
        takeDate(
          match,
          key(
            match[1],
            String(months.indexOf(match[2].toLowerCase()) + 1),
            match[3],
          ),
        );
      else {
        match = cleaned.match(
          /\b(übermorgen|morgen|heute|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b/i,
        );
        if (match) {
          const value = match[1].toLowerCase();
          const weekdays = [
            "sonntag",
            "montag",
            "dienstag",
            "mittwoch",
            "donnerstag",
            "freitag",
            "samstag",
          ];
          const days =
            value === "heute"
              ? 0
              : value === "morgen"
                ? 1
                : value === "übermorgen"
                  ? 2
                  : (weekdays.indexOf(value) - parseDate(base).getDay() + 7) %
                    7;
          takeDate(match, dateKey(addDays(parseDate(base), days)));
        }
      }
    }
  }
  // Explicit colon times or an hour accompanied by “Uhr”; bare numbers stay titles.
  const clock = "(?:[01]?\\d|2[0-3])(?::[0-5]\\d)";
  match = cleaned.match(
    new RegExp(
      `\\b(${clock})(?:\\s*Uhr)?(?:\\s*(?:–|—|-|bis)\\s*(${clock}|(?:[01]?\\d|2[0-3])\\s*Uhr))?(?:\\s*Uhr)?`,
      "i",
    ),
  );
  if (!match) match = cleaned.match(/\b((?:[01]?\d|2[0-3]))\s*Uhr\b/i);
  if (match) {
    const toTime = (s: string) => {
      const [h, m = "00"] = s.replace(/\s*Uhr/i, "").split(":");
      return `${h.padStart(2, "0")}:${m}`;
    };
    time = toTime(match[1]);
    if (match[2]) {
      const minutes = (s: string) => {
        const [h, m] = toTime(s).split(":").map(Number);
        return h * 60 + m;
      };
      duration =
        (minutes(match[2]) - minutes(match[1]) + 1440) % 1440 || undefined;
    }
    cleaned = cleaned.replace(match[0], " ");
  }
  // Drop date/time labels and the weekday accompanying a concrete date.
  cleaned = cleaned.replace(
    /(?:Datum|Date|Uhrzeit|Beginn|Zeit)\s*:\s*(?=\n|$)/gi,
    "",
  );
  if (plannedDate)
    cleaned = cleaned.replace(
      /\b(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b,?/gi,
      "",
    );
  cleaned = cleaned.replace(/\b(?:am|um|von)\s+(?=\s|[,;\n]|$)/gi, "");
  cleaned = cleaned.replace(/\b(?:am|um|von)\s*(?=[,;\n]|$)/gi, "");
  const phones = phonesFromText(cleaned);
  for (const phone of phones) cleaned = cleaned.replace(phone, " ");
  cleaned = cleaned.replace(
    /(?:Telefon|Tel\.?|Phone|Mobil)\s*:\s*(?=\n|$)/gi,
    "",
  );
  const lines = cleaned
    .split(/\r?\n/)
    .map((s) =>
      s.replace(/\s+/g, " ").replace(/^[\s,;|–—-]+|[\s,;|–—-]+$/g, ""),
    )
    .filter(
      (s) =>
        Boolean(s) && !/^(?:Datum|Date|Uhrzeit|Beginn|Zeit)\s*:\s*$/i.test(s),
    );
  const title = lines
    .map((line) => line.replace(/^(?:Titel|Veranstaltung|Event)\s*:\s*/i, ""))
    .join("\n")
    .slice(0, 500);
  const description = [
    ...(location ? [`Adresse: ${location}`] : []),
    ...phones.map((phone) => `Telefon: ${phone}`),
  ].join("\n");
  return { title, description, plannedDate, time, duration, location };
}
