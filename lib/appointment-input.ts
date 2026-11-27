import { addressFromText, phonesFromText } from "./addresses.ts";
import { addDays, dateKey, isDateKey, parseDate } from "./dates.ts";
import { normalizeClockNotation } from "./clock-notation.ts";

type AppointmentSpan = { start: number; end: number; kind: "date" | "time" };

const monthNames = [
  "januar|jan|jänner|jaenner",
  "februar|feb",
  "märz|maerz|mär|mrz",
  "april|apr",
  "mai",
  "juni|jun",
  "juli|jul",
  "august|aug",
  "september|sept|sep",
  "oktober|okt",
  "november|nov",
  "dezember|dez",
].map((names) => names.split("|"));
const namedDate = new RegExp(
  `(?<![\\p{L}\\d./])(\\d{1,2})(?:\\.\\s*|\\s+)(${monthNames.flat().join("|")})(?![\\p{L}])` +
    `(?:\\.?[ \\t]+(\\d{4}|\\d{2})(?![\\p{L}\\d:./]|[ \\t]*(?:Uhr|h)\\b)|\\.(?!\\d))?`,
  "iu",
);
const omit = (text: string) => text.replace(/[^\r\n]/g, " ");

/** Extract explicit German dates/times; keep unrecognised details as text. */
export function parseAppointmentInput(
  text: string,
  base = dateKey(new Date()),
  relativeBase = base,
) {
  const spans: AppointmentSpan[] = [];
  const positions = Array.from({ length: text.length }, (_, start) => ({
    start,
    end: start + 1,
  }));
  function track(index: number, raw: string, value: string) {
    const source = {
      start: positions[index].start,
      end: positions[index + raw.length - 1].end,
    };
    positions.splice(
      index,
      raw.length,
      ...Array.from({ length: value.length }, () => source),
    );
  }
  let explicitDuration: number | undefined;
  const length =
    text.match(
      /\b(?:(?:für|Dauer\s*:?|Länge\s*:?)\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(Minuten?|Min\.?|Std\.?|Stunden?)\b\.?/i,
    ) ||
    text.match(/\b(?:für|Dauer\s*:?)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(h)\b/i);
  if (length) {
    const minutes = Math.round(
      Number(length[1].replace(",", ".")) *
        (/^(?:Std|Stund|h)/i.test(length[2]) ? 60 : 1),
    );
    if (minutes >= 1 && minutes <= 10080) {
      explicitDuration = minutes;
      text = text.replace(length[0], omit);
    }
  }
  text = normalizeClockNotation(text, track);
  text = text.replace(
    /\bum\s+([01]?\d|2[0-3])(?![\d:./])(?:\s*(?:bis|[-–—])\s*([01]?\d|2[0-3])(?![\d:./]))?/i,
    (raw, start: string, end: string | undefined, offset: number) => {
      const newText = `${start}:00${end ? `–${end}:00` : ""}`;
      track(offset, raw, newText);
      return newText;
    },
  );
  const location = addressFromText(text);
  let cleaned = location ? text.replace(location, omit) : text;
  const consume = (match: RegExpMatchArray, kind: AppointmentSpan["kind"]) => {
    const index = match.index!;
    const end = index + match[0].length;
    const prefix = cleaned
      .slice(0, index)
      .match(
        kind === "date"
          ? /\b(?:am[ \t]+|(?:Datum|Date)\s*:[ \t]*)$/i
          : /\b(?:um|von|ab)[ \t]+$/i,
      );
    const start = prefix?.index ?? index;
    spans.push({
      start: positions[start].start,
      end: positions[end - 1].end,
      kind,
    });
    cleaned =
      cleaned.slice(0, start) +
      omit(cleaned.slice(start, end)) +
      cleaned.slice(end);
  };
  let plannedDate: string | undefined,
    time: string | undefined,
    duration: number | undefined = explicitDuration;
  const takeDate = (match: RegExpMatchArray | null, key: string) => {
    if (!match || !isDateKey(key)) return false;
    plannedDate = key;
    consume(match, "date");
    return true;
  };
  const key = (day: string, month: string, year?: string) => {
    const suffix = `-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (year) return `${year.length === 2 ? `20${year}` : year}${suffix}`;
    const firstYear = Number(relativeBase.slice(0, 4));
    for (let candidate = firstYear; candidate <= firstYear + 8; candidate++) {
      const date = `${candidate}${suffix}`;
      if (date >= relativeBase && isDateKey(date)) return date;
    }
    return "";
  };
  let match = cleaned.match(
    /(?<![\d./])\b(\d{4})-(\d{1,2})-(\d{1,2})(?![\d./])/,
  );
  if (match) takeDate(match, key(match[3], match[2], match[1]));
  else {
    match = cleaned.match(
      /(?<![\d./])\b(\d{1,2})[ \t]*[./-][ \t]*(\d{1,2})(?:(?:[ \t]*[./-][ \t]*|[ \t]+)(\d{4}|\d{2})(?![\p{L}\d:./]|[ \t]*(?:Uhr|h)\b)|\.(?!\d)|(?=[\s,;!?)]|$))/iu,
    );
    if (match && !(match[0].includes("-") && !match[3]))
      takeDate(match, key(match[1], match[2], match[3]));
    else {
      match = cleaned.match(namedDate);
      if (match)
        takeDate(
          match,
          key(
            match[1],
            String(
              monthNames.findIndex((names) =>
                names.includes(match![2].toLowerCase()),
              ) + 1,
            ),
            match[3],
          ),
        );
      else {
        match =
          Array.from(
            cleaned.matchAll(
              /(?<![\p{L}\p{N}_])(übermorgen|morgen|heute|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So)\b\.?/giu,
            ),
          ).find((candidate) => {
            if (!/^(so|do)$/.test(candidate[1])) return true;
            const index = candidate.index || 0;
            return (
              candidate[0].endsWith(".") ||
              /\bam\s*$/i.test(cleaned.slice(0, index)) ||
              /^\s*(?:um\s+)?\d/.test(
                cleaned.slice(index + candidate[0].length),
              )
            );
          }) || null;
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
                  : (weekdays.findIndex(
                      (day) => day === value || day.slice(0, 2) === value,
                    ) -
                      parseDate(relativeBase).getDay() +
                      7) %
                    7;
          takeDate(match, dateKey(addDays(parseDate(relativeBase), days)));
        }
      }
    }
  }
  // Explicit colon times or an hour accompanied by “Uhr”; bare numbers stay titles.
  const clock = "(?:[01]?\\d|2[0-3])(?::[0-5]\\d)(?![\\d:])";
  const expression = `\\b(${clock})(?:\\s*Uhr)?(?:\\s*(?:–|—|-|bis)\\s*(${clock}|(?:[01]?\\d|2[0-3])(?:\\s*Uhr)?(?![\\d:./])))?(?:\\s*Uhr)?`;
  match =
    cleaned.match(
      new RegExp(`(?:Beginn|Start|Uhrzeit)\\s*:?\\s*${expression}`, "i"),
    ) || cleaned.match(new RegExp(expression, "i"));
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
      duration ??=
        (minutes(match[2]) - minutes(match[1]) + 1440) % 1440 || undefined;
    }
    consume(match, "time");
    const end = cleaned.match(
      new RegExp(
        `\\b(?:Ende|Endzeit|Schluss)\\s*:?\\s*(${clock}|(?:[01]?\\d|2[0-3])\\s*Uhr)`,
        "i",
      ),
    );
    if (end) {
      if (!duration) {
        const [h, m] = toTime(end[1]).split(":").map(Number);
        const [startH, startM] = time.split(":").map(Number);
        duration =
          (h * 60 + m - startH * 60 - startM + 1440) % 1440 || undefined;
      }
      consume(end, "time");
    }
  }
  // Drop date/time labels and the weekday accompanying a concrete date.
  cleaned = cleaned.replace(
    /(?:Adresse|Anschrift|Ort|Location|Datum|Date|Uhrzeit|Beginn|Start|Ende|Endzeit|Schluss|Zeit)\s*:?\s*(?=\n|$)/gi,
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
  return {
    title,
    description,
    plannedDate,
    time,
    duration,
    location,
    spans: spans.sort((a, b) => a.start - b.start),
  };
}

const recurringDays = [
  "montag",
  "dienstag",
  "mittwoch",
  "donnerstag",
  "freitag",
  "samstag",
  "sonntag",
];
const weekdayPattern = recurringDays
  .map((day) => `${day}s?|${day.slice(0, 2)}\\.?`)
  .join("|");
const recurringList = new RegExp(
  `\\b(?:immer|jede[nrms]?|wöchentlich(?:\\s+am)?)\\s+((?:${weekdayPattern})(?![\\p{L}\\p{N}])(?:\\s*(?:,|/|und|&)\\s*(?:${weekdayPattern})(?![\\p{L}\\p{N}]))*)`,
  "giu",
);
export function parseRecurringAppointmentInput(
  text: string,
  base = dateKey(new Date()),
  relativeBase = base,
) {
  const days = new Set<number>();
  const addWeekdays = (list: string) => {
    for (const item of list.matchAll(
      new RegExp(`\\b(${weekdayPattern})(?![\\p{L}\\p{N}])`, "giu"),
    )) {
      const name = item[1].toLowerCase().replace(/\.$/, "");
      const index = recurringDays.findIndex(
        (day) => name === day || name === day + "s" || name === day.slice(0, 2),
      );
      if (index >= 0) days.add(index);
    }
  };
  const cleaned = text
    .replace(/\b(?:jeden\s+tag|alle\s+tage|täglich)\b/gi, (raw) => {
      for (let i = 0; i < 7; i++) days.add(i);
      return omit(raw);
    })
    .replace(/\b(?:werktags|unter\s+der\s+woche)\b/gi, (raw) => {
      for (let i = 0; i < 5; i++) days.add(i);
      return omit(raw);
    })
    .replace(recurringList, (raw, list: string) => {
      addWeekdays(list);
      return omit(raw);
    })
    .replace(
      new RegExp(
        `\\b(?:${recurringDays.map((day) => day + "s").join("|")})(?:\\s*(?:,|/|und|&)\\s*(?:${recurringDays.map((day) => day + "s").join("|")}))*\\b`,
        "gi",
      ),
      (list) => {
        addWeekdays(list);
        return omit(list);
      },
    )
    .replace(/(?<!\bfür\s)(?<!\bwie\s)\bimmer\b(?!\s+wieder\b)/gi, (raw) => {
      if (!days.size) for (let i = 0; i < 7; i++) days.add(i);
      return omit(raw);
    });
  const weekly = /\bwöchentlich\b/i.test(cleaned);
  const parsed = parseAppointmentInput(
    cleaned.replace(/\bwöchentlich\b/gi, omit),
    base,
    relativeBase,
  );
  if (weekly && !days.size)
    days.add((parseDate(parsed.plannedDate || base).getDay() + 6) % 7);
  if (!days.size) return { ...parsed, repeatDays: [] as number[] };
  const first = parseDate(parsed.plannedDate || base);
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(first, offset);
    if (days.has((day.getDay() + 6) % 7))
      return {
        ...parsed,
        plannedDate: dateKey(day),
        repeatDays: [...days].sort(),
      };
  }
  return { ...parsed, repeatDays: [...days].sort() };
}
