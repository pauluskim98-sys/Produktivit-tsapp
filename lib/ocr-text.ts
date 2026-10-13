export function cleanScreenshotText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*(?:©|copyright\b|all rights reserved\b|alle rechte vorbehalten\b)/i.test(
          line,
        ),
    )
    .map((line) =>
      line
        .trim()
        .replace(/[©®™\uFFFC]/g, " ")
        .replace(/\bTM\b/gi, " ")
        .replace(/(\d)\s*([:.\/-])\s*(?=\d)/g, "$1$2")
        .trim(),
    )
    .filter(
      (line) =>
        line &&
        !/^(?:tm|c|r)(?:\s+(?:tm|c|r))*$/i.test(line) &&
        !/^(?:©|copyright\b|all rights reserved\b|alle rechte vorbehalten\b)/i.test(
          line,
        ) &&
        (/[\p{L}]{2,}/u.test(line) || /\d/.test(line)),
    )
    .join("\n");
}
