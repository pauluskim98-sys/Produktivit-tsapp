import { addressFromText, phonesFromText } from "./addresses.ts";
import { addDays, dateKey, isDateKey, parseDate } from "./dates.ts";
import { normalizeClockNotation } from "./clock-notation.ts";

/** Extract explicit German dates/times; keep unrecognised details as text. */
export function parseAppointmentInput(
  text: string,
  base = dateKey(new Date()),
  relativeBase = base,
) {
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
      text = text.replace(length[0], " ");
    }
  }
  text = normalizeClockNotation(text);
  text = text.replace(/\bum\s+([01]?\d|2[0-3])(?![\d:./])(?:\s*(?:bis|[-–—])\s*([01]?\d|2[0-3])(?![\d:./]))?/gi,
    (_, start:string, end?:string)=>`${start}:00${end?`–${end}:00`:""}`);
  const location = addressFromText(text);
  let cleaned = location
    ? text
        .replace(location, " ")
        .replace(/(?:Adresse|Anschrift|Ort|Location)\s*:\s*(?=\n|$)/gi, "")
    : text;
  let plannedDate: string | undefined,
    time: string | undefined,
    duration: number | undefined = explicitDuration;
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
    match = cleaned.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2})\b|\.(?!\d)|(?=\s|$))/);
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
          match = Array.from(cleaned.matchAll(/(?<![\p{L}\p{N}_])(übermorgen|morgen|heute|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So)\b\.?/giu)).find((candidate)=>{
            if(!/^(so|do)$/.test(candidate[1]))return true;
            const index=candidate.index||0;
            return candidate[0].endsWith(".") || /\bam\s*$/i.test(cleaned.slice(0,index)) || /^\s*(?:um\s+)?\d/.test(cleaned.slice(index+candidate[0].length));
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
                  : (weekdays.findIndex((day)=>day===value || day.slice(0,2)===value) -
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
    cleaned = cleaned.replace(match[0], " ");
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
      cleaned = cleaned.replace(end[0], " ");
    }
  }
  // Drop date/time labels and the weekday accompanying a concrete date.
  cleaned = cleaned.replace(
    /(?:Datum|Date|Uhrzeit|Beginn|Start|Ende|Endzeit|Schluss|Zeit)\s*:?\s*(?=\n|$)/gi,
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

const recurringDays=["montag","dienstag","mittwoch","donnerstag","freitag","samstag","sonntag"];
const weekdayPattern=recurringDays.map((day)=>`${day}s?|${day.slice(0,2)}\\.?`).join("|");
const recurringList=new RegExp(`\\b(?:immer|jede[nrms]?|wöchentlich(?:\\s+am)?)\\s+((?:${weekdayPattern})(?![\\p{L}\\p{N}])(?:\\s*(?:,|/|und|&)\\s*(?:${weekdayPattern})(?![\\p{L}\\p{N}]))*)`,"giu");
export function parseRecurringAppointmentInput(text:string, base=dateKey(new Date()), relativeBase=base) {
  const days=new Set<number>();
  const addWeekdays=(list:string)=>{
    for(const item of list.matchAll(new RegExp(`\\b(${weekdayPattern})(?![\\p{L}\\p{N}])`,"giu"))){
      const name=item[1].toLowerCase().replace(/\.$/,"");
      const index=recurringDays.findIndex((day)=>name===day || name===day+"s" || name===day.slice(0,2));
      if(index>=0)days.add(index);
    }
  };
  const cleaned=text
    .replace(/\b(?:jeden\s+tag|alle\s+tage|täglich)\b/gi,()=>{for(let i=0;i<7;i++)days.add(i);return " ";})
    .replace(/\b(?:werktags|unter\s+der\s+woche)\b/gi,()=>{for(let i=0;i<5;i++)days.add(i);return " ";})
    .replace(recurringList,(_,list:string)=>{addWeekdays(list);return " ";})
    .replace(new RegExp(`\\b(?:${recurringDays.map((day)=>day+"s").join("|")})(?:\\s*(?:,|/|und|&)\\s*(?:${recurringDays.map((day)=>day+"s").join("|")}))*\\b`,"gi"),(list)=>{addWeekdays(list);return " ";})
    .replace(/(?<!\bfür\s)(?<!\bwie\s)\bimmer\b(?!\s+wieder\b)/gi,()=>{if(!days.size)for(let i=0;i<7;i++)days.add(i);return " ";});
  const weekly=/\bwöchentlich\b/i.test(cleaned);
  const parsed=parseAppointmentInput(cleaned.replace(/\bwöchentlich\b/gi," "),base,relativeBase);
  if(weekly && !days.size)days.add((parseDate(parsed.plannedDate || base).getDay()+6)%7);
  if(!days.size)return {...parsed,repeatDays:[] as number[]};
  const first=parseDate(parsed.plannedDate || base);
  for(let offset=0;offset<7;offset++){
    const day=addDays(first,offset);
    if(days.has((day.getDay()+6)%7))return {...parsed,plannedDate:dateKey(day),repeatDays:[...days].sort()};
  }
  return {...parsed,repeatDays:[...days].sort()};
}
