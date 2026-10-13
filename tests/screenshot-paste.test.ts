import test from "node:test";
import assert from "node:assert/strict";
import { pastedImage } from "../lib/pasted-image.ts";
import { cleanScreenshotText } from "../lib/ocr-text.ts";
const clipboard = (
  values: Record<string, string>,
  files: Blob[] = [],
  items: unknown[] = [],
) =>
  ({
    files,
    items,
    types: Object.keys(values),
    getData: (type: string) => values[type] || "",
  }) as unknown as DataTransfer;
test("image wins over copyright text", async () => {
  const image = new Blob(["fixture"], { type: "image/png" });
  assert.equal(
    await pastedImage(clipboard({ "text/plain": "©" }, [image])),
    image,
  );
});
test("file clipboard items and embedded images are accepted", async () => {
  const image = new Blob(["fixture"], { type: "image/png" });
  assert.equal(
    await pastedImage(
      clipboard(
        {},
        [],
        [{ kind: "file", type: "image/png", getAsFile: () => image }],
      ),
    ),
    image,
  );
  const result = await pastedImage(
    clipboard({
      "text/html": '<img src="data:image/png;base64,Zml4dHVyZQ==">',
    }),
  );
  assert.equal(result?.type, "image/png");
});
test("normal pasted text stays text", async () => {
  assert.equal(
    await pastedImage(clipboard({ "text/plain": "Yoga morgen 18 Uhr" })),
    null,
  );
});
test("OCR symbols and copyright lines do not become a title", () => {
  assert.equal(
    cleanScreenshotText(
      "©\n® ™\n© 2026 Example\nKonzert\n16.10.2026\n19:00 - 21:00 Uhr\nOrt: Köln",
    ),
    "Konzert\n16.10.2026\n19:00-21:00 Uhr\nOrt: Köln",
  );
  assert.equal(cleanScreenshotText("©\n®\n™"), "");
});

test("numeric screenshot content stays readable, including OCR-spaced dates and times", () => {
  assert.equal(cleanScreenshotText("16.10.2026\n19:30"), "16.10.2026\n19:30");
  assert.equal(
    cleanScreenshotText("16 . 10 . 2026\n19 : 30\n2026\n16"),
    "16.10.2026\n19:30\n2026\n16",
  );
});

test("trademark OCR fragments are removed without losing meaningful text", () => {
  assert.equal(
    cleanScreenshotText("TM ©\ntm c\nWorkshop ™\nVitamin C\n19:30"),
    "Workshop\nVitamin C\n19:30",
  );
});
