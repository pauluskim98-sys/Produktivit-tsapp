import { addDays, dateKey, isDateKey, parseDate } from "./dates.ts";
import { parseAppointmentInput } from "./appointment-input.ts";
import { cleanScreenshotText } from "./ocr-text.ts";
import type { Todo } from "./types.ts";
import { normalizeClockNotation } from "./clock-notation.ts";

export type ScreenshotEvent = {
  title: string;
  plannedDate?: string;
  time?: string;
  duration?: number;
  location?: string;
};
export type ScreenshotRecurrence = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  weekdays: number[];
  until: string;
  count?: number;
  inferredEnd: boolean;
};
export type ScreenshotImport = {
  events: ScreenshotEvent[];
  recurrence?: ScreenshotRecurrence;
  warnings: string[];
};
const weekdays = [
  "montag",
  "dienstag",
  "mittwoch",
  "donnerstag",
  "freitag",
  "samstag",
  "sonntag",
];
const months =
  "Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
const datePattern = new RegExp(
  `\\b(?:\\d{4}-\\d{2}-\\d{2}|(?:0?[1-9]|[12]\\d|3[01])[./](?:0?[1-9]|1[0-2])(?:[./](?:(?:20\\d{2}|\\d{2})\\b)?)?(?!\\d)|\\d{1,2}\\.?\\s+(?:${months})(?:\\s+20\\d{2})?)`,
  "gi",
);
const metadata =
  /^(?:Adresse|Anschrift|Ort|Location|Telefon|Tel\.?|Mobil|Phone|Datum|Uhrzeit|Beginn|Zeit|Termine|Termindaten|Wiederholung)\s*:?\s*$/i;
const noteLine =
  /^(?:Notiz|Hinweis|Beschreibung|Info|Raum|Treffpunkt|Einlass|Anmeldung)\s*:|\b(?:mitbringen|bitte|anmelden|Eintritt|kostenlos)\b/i;
function expandShorthand(text: string) {
  const named = new RegExp(
    `((?:\\d{1,2}\\.\\s*(?:,|und|&|/)\\s*)+)(\\d{1,2})\\.?\\s+(${months})(\\s+20\\d{2})?`,
    "gi",
  );
  return text
    .replace(
      named,
      (_, prefix: string, day: string, month: string, year: string = "") =>
        `${(prefix.match(/\d+/g) || []).map((d) => `${d}. ${month}${year}`).join(" / ")} / ${day}. ${month}${year}`,
    )
    .replace(
      /((?:\d{1,2}\.\s*(?:,|und|&|\/)\s*)+)(\d{1,2})[./](\d{1,2})[./](20\d{2}|\d{2})?/g,
      (_, prefix: string, day: string, month: string, year: string = "") =>
        `${(prefix.match(/\d+/g) || []).map((d) => `${d}.${month}.${year}`).join(" / ")} / ${day}.${month}.${year}`,
    );
}
function meaningful(line: string, base: string) {
  const withoutSchedule = line
    .replace(datePattern, " ")
    .replace(
      /\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*Uhr)?(?:\s*(?:–|—|-|bis)\s*(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*Uhr)?)?/gi,
      " ",
    );
  const parsed = parseAppointmentInput(withoutSchedule, base)
    .title.replace(
      /\b(?:wöchentlich|täglich|monatlich|weekly|daily|monthly)\b/gi,
      "",
    )
    .replace(/^[\s/,&|–—-]+|[\s/,&|–—-]+$/g, "")
    .trim();
  return parsed &&
    !metadata.test(parsed) &&
    !/^(?:jeden?|jede[nrs]?|alle)\b/i.test(parsed)
    ? parsed
    : "";
}
function durationFromText(text: string): number | undefined {
  const match = text.match(
    /\b(\d+(?:[,.]\d+)?)\s*(Stunden?|Std\.?|Minuten?|Min\.?)\b/i,
  );
  if (!match) return undefined;
  const value = Math.round(
    Number(match[1].replace(",", ".")) *
      (/^(?:St|Std)/i.test(match[2]) ? 60 : 1),
  );
  return value > 0 && value <= 10080 ? value : undefined;
}
/** Conservative local extraction: explicit dates/times and stated rhythms only. */
export function parseScreenshotImport(
  raw: string,
  base = dateKey(new Date()),
): ScreenshotImport {
  const text = expandShorthand(
    normalizeClockNotation(cleanScreenshotText(raw)),
  );
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matches = [...text.matchAll(datePattern)].flatMap((match) => {
    const rawDate = /^\d{1,2}[./]\d{1,2}$/.test(match[0])
      ? match[0] + "."
      : match[0];
    const plannedDate = parseAppointmentInput(rawDate, base).plannedDate;
    if (!plannedDate) return [];
    const before = text.slice(0, match.index);
    return [
      {
        raw: match[0],
        index: match.index!,
        plannedDate,
        line: before.split("\n").length - 1,
        until: /\b(?:bis|until|endet\s+am)\s*(?:einschließlich\s*)?$/i.test(
          before,
        ),
      },
    ];
  });
  const rhythm =
    /\b(?:wöchentlich|weekly|täglich|daily|monatlich|monthly|jede[nrs]?\s+(?:Woche|Tag|Monat|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)|alle\s+(?:\d+|zwei|drei|vier)\s+(?:Wochen|Tage|Monate))\b/i.test(
      text,
    );
  const frequency =
    /\b(?:monatlich|monthly|jede[nrs]?\s+Monat|alle\s+(?:\d+|zwei|drei|vier)\s+Monate)\b/i.test(
      text,
    ) && rhythm
      ? "monthly"
      : /\b(?:täglich|daily|jeden?\s+Tag|alle\s+\d+\s+Tage)\b/i.test(text)
        ? "daily"
        : "weekly";
  const intervalText = text.match(
    /\balle\s+(\d+|zwei|drei|vier)\s+(?:Wochen|Tage|Monate)/i,
  )?.[1];
  const interval = Math.max(
    1,
    Math.min(
      12,
      intervalText
        ? Number(
            ({ zwei: 2, drei: 3, vier: 4 } as Record<string, number>)[
              intervalText.toLowerCase()
            ] || intervalText,
          )
        : 1,
    ),
  );
  const days = weekdays.flatMap((day, i) =>
    new RegExp(`\\b${day}(?:s)?\\b`, "i").test(text) ? [i] : [],
  );
  const until = rhythm
    ? matches.find((item) => item.until)?.plannedDate
    : undefined;
  // In prose such as “den Termin vom 19.10 auf Mittwoch 21.10” the
  // first date is the superseded appointment, not another occurrence.
  const superseded = new Set<number>();
  for (let i = 0; i < matches.length - 1; i++) {
    const source = matches[i],
      target = matches[i + 1];
    const between = text.slice(source.index + source.raw.length, target.index);
    const prefix = text.slice(Math.max(0, source.index - 100), source.index);
    if (
      /^\s*(?:auf|stattdessen(?:\s+am)?|jetzt(?:\s+am)?|nun(?:\s+am)?)\s*(?:(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*)?$/i.test(
        between,
      ) &&
      /(?:vom|von|Termin|verschieb|verleg)\b[^\n]*$/i.test(prefix)
    )
      superseded.add(source.index);
  }
  const anchors = matches
    .filter((item) => !superseded.has(item.index) && (!rhythm || !item.until))
    .slice(0, 366);
  const firstLine = anchors[0]?.line ?? lines.length;
  const globalTitle =
    lines
      .slice(0, firstLine)
      .map((line) => meaningful(line, base))
      .find((line) => line && !noteLine.test(line)) || "";
  const allParsed = parseAppointmentInput(text, base);
  const fallbackTitle =
    lines
      .map((line) => meaningful(line, base))
      .find((line) => line && !noteLine.test(line)) || "";
  const segments: string[] = [];
  const events: ScreenshotEvent[] = anchors.map((anchor, i) => {
    const nextLine =
      anchors.find((item, index) => index > i && item.line > anchor.line)
        ?.line ?? lines.length;
    const previousLine = i ? anchors[i - 1].line : -1;
    const preceding =
      anchor.line > previousLine && anchor.line > 0
        ? meaningful(lines[anchor.line - 1], base)
        : "";
    const ownLine = lines[anchor.line].replace(datePattern, " ");
    const nextAnchor = anchors[i + 1];
    const endIndex =
      nextAnchor?.line === anchor.line
        ? nextAnchor.index
        : text.indexOf("\n", anchor.index);
    const afterDate = text.slice(
      anchor.index + anchor.raw.length,
      endIndex < 0 ? undefined : endIndex,
    );
    const ownParsed = parseAppointmentInput(afterDate, base);
    const ownTitle = meaningful(ownLine, base).replace(
      /^[\s/,&|–—-]+|[\s/,&|–—-]+$/g,
      "",
    );
    const title =
      ownTitle && !noteLine.test(ownTitle)
        ? ownTitle
        : preceding && !noteLine.test(preceding)
          ? preceding
          : globalTitle;
    const segment =
      nextAnchor?.line === anchor.line
        ? text.slice(anchor.index, nextAnchor.index)
        : lines.slice(anchor.line, nextLine).join("\n");
    segments.push(segment);
    const parsed = parseAppointmentInput(segment, base);
    const labeledText = segment.match(
      /(?:Beginn|Start|Uhrzeit)\s*:?\s*([^\n]+)/i,
    )?.[1];
    const labeled = labeledText
      ? parseAppointmentInput(labeledText, base)
      : undefined;
    const candidateTitle = title || fallbackTitle || "";
    const eventTitle =
      superseded.size &&
      /^(?:Das ist|Sollen|Vorschlag|Und den|Den vom|Termin vom|Hallo|Guten Tag)/i.test(
        candidateTitle,
      )
        ? "Termin"
        : candidateTitle;
    // A time shared by multiple dates is valid only when there is one common
    // schedule. Never borrow the first event's time for another event.
    const clocks = [...text.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)];
    const globalSchedule =
      /(?:Beginn|Start|Uhrzeit|Uhr|\d\s*h\b)/i.test(
        raw.slice(0, raw.search(/\d{1,2}[./]\d{1,2}|\d{4}-\d{2}-\d{2}/)),
      ) &&
      clocks.length > 0 &&
      clocks.every((c) => c.index! < anchors[0].index);
    return {
      title: eventTitle,
      plannedDate: anchor.plannedDate,
      time:
        labeled?.time ||
        ownParsed.time ||
        parsed.time ||
        (globalSchedule ? allParsed.time : undefined),
      duration:
        (labeled?.time ? parsed.duration : ownParsed.duration) ||
        labeled?.duration ||
        parsed.duration ||
        durationFromText(segment) ||
        (globalSchedule
          ? allParsed.duration || durationFromText(text)
          : undefined),
      location: parsed.location || allParsed.location,
    };
  });
  if (!events.length) {
    const inferredDate = allParsed.plannedDate || (rhythm ? base : undefined);
    events.push({
      title: globalTitle || fallbackTitle || "",
      plannedDate: inferredDate,
      time: allParsed.time,
      duration: allParsed.duration || durationFromText(text),
      location: allParsed.location,
    });
  }
  const titles = new Set(events.map((event) => event.title));
  // For independent appointments use only that appointment's address.
  // Other screenshot text (notes, phones, descriptions) is never imported.
  if (titles.size > 1)
    events.forEach((event, index) => {
      event.location = parseAppointmentInput(
        segments[index] || text,
        base,
      ).location;
    });
  const unique = events.filter(
    (event, i) =>
      events.findIndex(
        (other) =>
          other.plannedDate === event.plannedDate &&
          other.time === event.time &&
          other.title === event.title,
      ) === i,
  );
  let recurrence: ScreenshotRecurrence | undefined;
  const warnings: string[] = [];
  if (superseded.size)
    warnings.push(
      "Terminverschiebung erkannt – nur die neuen Daten werden übernommen. Titel bitte prüfen.",
    );
  if (rhythm && unique[0].plannedDate) {
    const start = unique[0].plannedDate;
    const countText = text.match(
      /\b(\d+)\s*(?:Termine|Treffen|Einheiten|Wiederholungen)\b/i,
    )?.[1];
    const weeksText = text.match(
      /\b(?:für|über|insgesamt)\s+(\d+)\s+Wochen\b/i,
    )?.[1];
    const inferredEnd = !until && !countText && !weeksText;
    const horizon = weeksText
      ? Math.min(52, Number(weeksText))
      : countText
        ? 52
        : 8;
    recurrence = {
      frequency,
      interval,
      weekdays:
        frequency === "daily"
          ? [0, 1, 2, 3, 4, 5, 6]
          : days.length
            ? days
            : [(parseDate(start).getDay() + 6) % 7],
      until: until || dateKey(addDays(parseDate(start), horizon * 7)),
      count: countText ? Math.min(366, Number(countText)) : undefined,
      inferredEnd,
    };
    if (inferredEnd)
      warnings.push("Kein Enddatum erkannt – zunächst 8 Wochen vorgeschlagen.");
    if (until && until < start) {
      recurrence = undefined;
      warnings.push(
        "Das erkannte Enddatum liegt vor dem ersten Termin. Bitte prüfen.",
      );
    }
  }
  if (!unique[0].time) warnings.push("Keine eindeutige Uhrzeit erkannt.");
  if (!unique[0].title.trim()) warnings.push("Bitte einen Titel ergänzen.");
  return { events: unique, recurrence, warnings };
}
export function screenshotOccurrences(
  plan: ScreenshotImport,
  primary: Todo,
): ScreenshotEvent[] {
  const first = plan.events[0];
  const root: ScreenshotEvent = {
    title: primary.title,
    location: primary.location,
    plannedDate: primary.plannedDate || undefined,
    time: primary.time || undefined,
    duration: primary.duration || undefined,
  };
  const result = [
    root,
    ...plan.events.slice(1).map((event) => ({
      ...event,
      title: event.title === first.title ? primary.title : event.title,
      time: event.time === first.time ? primary.time || undefined : event.time,
      duration:
        event.duration === first.duration
          ? primary.duration || undefined
          : event.duration,
      location:
        event.location === first.location ? primary.location : event.location,
    })),
  ];
  const rule = plan.recurrence;
  if (rule && root.plannedDate && isDateKey(rule.until)) {
    const start = parseDate(root.plannedDate);
    if (rule.frequency === "monthly") {
      for (
        let n = rule.interval;
        n <= 120 && result.length < 366;
        n += rule.interval
      ) {
        const date = new Date(
          start.getFullYear(),
          start.getMonth() + n,
          start.getDate(),
          12,
        );
        if (dateKey(date) > rule.until) break;
        if (date.getDate() === start.getDate())
          result.push({ ...root, plannedDate: dateKey(date) });
      }
    } else {
      for (let n = 1; n <= 366 && result.length < 366; n++) {
        const date = addDays(start, n),
          key = dateKey(date);
        if (key > rule.until) break;
        const day = (date.getDay() + 6) % 7;
        const week = Math.floor((n + ((start.getDay() + 6) % 7)) / 7);
        if (
          rule.frequency === "daily"
            ? n % rule.interval === 0
            : week % rule.interval === 0 && rule.weekdays.includes(day)
        )
          result.push({ ...root, plannedDate: key });
      }
    }
  }
  const unique = result.filter(
    (event, i) =>
      result.findIndex(
        (other) =>
          other.plannedDate === event.plannedDate &&
          other.time === event.time &&
          other.title === event.title,
      ) === i,
  );
  const ordered = [
    unique[0],
    ...unique
      .slice(1)
      .sort(
        (a, b) =>
          (a.plannedDate || "").localeCompare(b.plannedDate || "") ||
          (a.time || "").localeCompare(b.time || ""),
      ),
  ];
  return rule?.count ? ordered.slice(0, Math.max(1, rule.count)) : ordered;
}
/** Build an atomic set of tasks; equal titles form a manageable series. */
export function screenshotTasks(
  primary: Todo,
  events: ScreenshotEvent[],
  id: () => string,
  existing = false,
): Todo[] {
  const tasks = events.map((event, i) => ({
    ...primary,
    id: existing && i === 0 ? primary.id : id(),
    title: event.title || primary.title,
    location: event.location || "",
    plannedDate: event.plannedDate || primary.plannedDate,
    time: event.time || "",
    duration: event.time ? event.duration || 60 : null,
    done: i === 0 ? primary.done : false,
    position: primary.position + i,
    subtasks: primary.subtasks.map((subtask) => ({
      ...subtask,
      id: existing && i === 0 ? subtask.id : id(),
      done: i === 0 ? subtask.done : false,
    })),
  }));
  return tasks.map((task) => {
    const same = tasks.filter(
      (other) =>
        other.title.trim().toLowerCase() === task.title.trim().toLowerCase(),
    );
    return {
      ...task,
      seriesId:
        same.length > 1
          ? same[0].id === tasks[0].id
            ? primary.seriesId || tasks[0].id
            : same[0].id
          : existing && task.id === primary.id
            ? primary.seriesId || ""
            : "",
    };
  });
}
