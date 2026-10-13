/** Prefer image data over any plain-text representation supplied by the browser. */
export async function pastedImage(data: DataTransfer): Promise<Blob | null> {
  const files = [
    ...Array.from(data.files),
    ...Array.from(data.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file)),
  ];
  const direct = files.find(
    (file) =>
      file.type.startsWith("image/") ||
      /\.(?:png|jpe?g|webp|tiff?)$/i.test(file.name),
  );
  if (direct) return direct;
  const text = data.getData("text/plain");
  const html = data.getData("text/html");
  const embedded = html.match(
    /src=["'](data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+)["']/i,
  )?.[1];
  if (embedded) return (await fetch(embedded)).blob();
  const imageHint =
    data.types.some((type) => type.startsWith("image/")) ||
    /<img\b/i.test(html) ||
    !text.trim() ||
    /^[©®™\uFFFC\s]+$/.test(text);
  if (imageHint && navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((type) => type.startsWith("image/"));
        if (type) return await item.getType(type);
      }
    } catch {
      /* The browser may only expose clipboard data in the paste event. */
    }
  }
  return null;
}

/** Flatten transparent backgrounds and upscale small screenshots for OCR. */
export async function prepareScreenshot(image: Blob): Promise<Blob> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(image);
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error("Das Bild ist zu groß.");
    const scale = Math.min(2, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return image;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob || image), "image/png"),
    );
  } catch {
    return image;
  } finally {
    bitmap?.close();
  }
}
