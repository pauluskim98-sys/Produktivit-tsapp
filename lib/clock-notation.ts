/** Normalize explicit time notation while leaving ambiguous dates untouched. */
export function normalizeClockNotation(
  text: string,
  track?: (index: number, raw: string, value: string) => void,
): string {
  const replace = (
    pattern: RegExp,
    replacement: (...groups: string[]) => string,
  ) => {
    let shift = 0;
    text = text.replace(pattern, (...args) => {
      const [raw, ...groups] = args.slice(0, -2) as string[];
      const value = replacement(raw, ...groups);
      if (value !== raw) track?.(args.at(-2) + shift, raw, value);
      shift += value.length - raw.length;
      return value;
    });
  };
  const hour = "(?:[01]?\\d|2[0-3])";
  const minute = "[0-5]\\d";
  replace(/[：∶]/g, () => ":");
  replace(/\b(\d{1,2})\s*:\s*([0-5])(?![\dOo:])/gi, (raw, h, m) =>
    Number(h) < 24 ? `${h}:0${m}` : raw,
  );
  replace(
    /\b([01]?\d|2[0-3])\s*Uhr\s*([0-5]\d)(?![\d.:/])\b/gi,
    (_, h, m) => `${h}:${m}`,
  );
  replace(
    /\b(um\s+)([01]?\d|2[0-3])\s*\.\s*([0-5]\d)(?![\d.]|\/)/gi,
    (_, prefix, h, m) => `${prefix}${h}:${m}`,
  );

  replace(
    /\b([01]?\d|2[0-3])\s*h(?:\s*([0-5]\d))?\b/gi,
    (_, h: string, m: string | undefined) => `${h}:${m || "00"}`,
  );
  // OCR sometimes confuses zero and O, but only repair them beside a colon.
  replace(
    /\b([0-2]?[\dOo])\s*:\s*([\dOo]{2})(?!\d)/g,
    (raw, h: string, m: string) => {
      const hours = h.replace(/o/gi, "0"),
        minutes = m.replace(/o/gi, "0");
      return /\d/.test(raw) && Number(hours) < 24 && Number(minutes) < 60
        ? `${hours}:${minutes}`
        : raw;
    },
  );
  replace(
    new RegExp(
      `\\b(${hour})\\s*\\.\\s*(${minute})\\s*(–|—|-|bis)\\s*(${hour})\\s*[.:]\\s*(${minute})(?![.\\d])(\\s*Uhr\\b)?`,
      "gi",
    ),
    (
      raw,
      h1: string,
      m1: string,
      separator: string,
      h2: string,
      m2: string,
      unit: string = "",
    ) =>
      unit ||
      Number(m1) === 0 ||
      Number(m1) > 12 ||
      Number(m2) === 0 ||
      Number(m2) > 12
        ? `${h1}:${m1}${separator}${h2}:${m2}${unit}`
        : raw,
  );
  replace(
    new RegExp(`(?<![\\d./-])\\b(${hour})\\s*\\.\\s*(${minute})\\s*(?=Uhr\\b)`, "gi"),
    (_, h, m) => `${h}:${m} `,
  );
  replace(
    new RegExp(`(?<![\\d./-])\\b(${hour})\\.(00|1[3-9]|[2-5]\\d)(?![.\\d])`, "g"),
    (_, h, m) => `${h}:${m}`,
  );
  replace(
    new RegExp(
      `\\b((?:Beginn|Start|Uhrzeit|Ende|Endzeit|Schluss)\\s*:?\\s*)(${hour})\\.(${minute})(?![.\\d])`,
      "gi",
    ),
    (_, prefix, h, m) => `${prefix}${h}:${m}`,
  );
  replace(
    new RegExp(`\\b(${hour})\\s*(–|—|-|bis)\\s*(${hour})\\s*Uhr\\b`, "gi"),
    (_, start, separator, end) => `${start}:00${separator}${end}:00 Uhr`,
  );
  return text;
}
