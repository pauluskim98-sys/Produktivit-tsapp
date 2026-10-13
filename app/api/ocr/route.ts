import { cleanScreenshotText } from "@/lib/ocr-text";
import { createWorker, type Worker } from "tesseract.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { sameOrigin } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let active = false;
export async function POST(request: Request) {
  let worker: Worker | undefined;
  let acquired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    sameOrigin(request);
    if (
      !/^image\/(png|jpeg|webp|tiff)/i.test(
        request.headers.get("content-type") || "",
      )
    )
      return Response.json(
        { error: "Bitte einen Screenshot als PNG oder JPEG einfügen." },
        { status: 400 },
      );
    if (Number(request.headers.get("content-length")) > 8_000_000)
      return Response.json(
        { error: "Das Bild ist zu groß (maximal 8 MB)." },
        { status: 413 },
      );
    if (active)
      return Response.json(
        { error: "Ein Screenshot wird gerade gelesen. Bitte kurz warten." },
        { status: 429 },
      );
    active = acquired = true;
    const image = Buffer.from(await request.arrayBuffer());
    if (!image.length || image.length > 8_000_000)
      return Response.json(
        { error: "Bitte ein Bild mit maximal 8 MB einfügen." },
        { status: 413 },
      );
    const cachePath = path.join(process.cwd(), "data/ocr");
    await mkdir(cachePath, { recursive: true });
    worker = await createWorker("deu+eng", 1, { cachePath });
    const result = await Promise.race([
      worker.recognize(image),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("OCR timeout")), 30000);
      }),
    ]);
    const text = cleanScreenshotText(result.data.text);
    if (!text)
      return Response.json(
        {
          error:
            "Kein lesbarer Text gefunden. Bitte einen deutlicheren Screenshot einfügen.",
        },
        { status: 422 },
      );
    return Response.json(
      { text: text.slice(0, 20000) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Der Screenshot konnte nicht gelesen werden. Bitte erneut versuchen oder den Text einfügen.",
      },
      { status: 422 },
    );
  } finally {
    clearTimeout(timer);
    await worker?.terminate().catch(() => {});
    if (acquired) active = false;
  }
}
