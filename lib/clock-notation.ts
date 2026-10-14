/** Normalize explicit time notation while leaving ambiguous dates untouched. */
export function normalizeClockNotation(text: string): string {
  const hour = "(?:[01]?\\d|2[0-3])";
  const minute = "[0-5]\\d";
  return (
    text
      .replace(/[：∶]/g, ":")
      .replace(
        /\b([01]?\d|2[0-3])\s*h(?:\s*([0-5]\d))?\b/gi,
        (_, h: string, m: string | undefined) => `${h}:${m || "00"}`,
      )
      // OCR sometimes confuses zero and O, but only repair them beside a colon.
      .replace(
        /\b([0-2]?[\dOo])\s*:\s*([\dOo]{2})(?!\d)/g,
        (raw, h: string, m: string) => {
          const hours = h.replace(/o/gi, "0"),
            minutes = m.replace(/o/gi, "0");
          return /\d/.test(raw) && Number(hours) < 24 && Number(minutes) < 60
            ? `${hours}:${minutes}`
            : raw;
        },
      )
      .replace(
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
      )
      .replace(
        new RegExp(`\\b(${hour})\\s*\\.\\s*(${minute})\\s*(?=Uhr\\b)`, "gi"),
        "$1:$2 ",
      )
      .replace(
        new RegExp(`\\b(${hour})\\.(00|1[3-9]|[2-5]\\d)(?![.\\d])`, "g"),
        "$1:$2",
      )
      .replace(
        new RegExp(
          `\\b((?:Beginn|Start|Uhrzeit|Ende|Endzeit|Schluss)\\s*:?\\s*)(${hour})\\.(${minute})(?![.\\d])`,
          "gi",
        ),
        "$1$2:$3",
      )
      .replace(
        new RegExp(`\\b(${hour})\\s*(–|—|-|bis)\\s*(${hour})\\s*Uhr\\b`, "gi"),
        "$1:00$2$3:00 Uhr",
      )
  );
}
