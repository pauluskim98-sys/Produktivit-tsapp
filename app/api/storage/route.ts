import { db, transaction } from "@/lib/db";
import { storageReady, storageItems, checkStorageParent } from "@/lib/storage";
import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  storageReady();
  const id = new URL(request.url).searchParams.get("file");
  if (!id)
    return Response.json(
      { items: storageItems() },
      { headers: { "Cache-Control": "no-store" } },
    );
  const row = db
    .prepare(
      "SELECT name,mime,content FROM StorageItem WHERE id=? AND kind='file' AND deleted=0",
    )
    .get(id) as { name: string; mime: string; content: Uint8Array } | undefined;
  if (!row)
    return Response.json({ error: "Datei nicht gefunden." }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline =
    !download &&
    /^image\/(?:png|jpeg|gif|webp)$|^audio\/(?:mpeg|wav|ogg|mp4|x-m4a|flac)$|^video\/(?:mp4|webm|ogg|quicktime)$|^application\/pdf$|^text\/plain$/.test(
      row.mime,
    );
  const bytes = new Uint8Array(row.content),
    size = bytes.length;
  const headers: Record<string, string> = {
    "Content-Type": inline ? row.mime : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
  };
  const range = request.headers.get("range");
  if (range) {
    const m = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!m || (!m[1] && !m[2]))
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1]
      ? m[2]
        ? Math.min(size - 1, Number(m[2]))
        : size - 1
      : size - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start > end ||
      start >= size
    )
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(bytes, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    storageReady();
    if (
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      if (Number(request.headers.get("content-length")) > 30_000_000)
        throw new Error("Bitte höchstens 25 MB pro Upload.");
      const form = await request.formData(),
        parentId = String(form.get("parentId") || "") || null;
      checkStorageParent(parentId);
      const files = form
        .getAll("files")
        .filter((x): x is File => x instanceof File);
      if (
        !files.length ||
        files.length > 20 ||
        files.reduce((n, f) => n + f.size, 0) > 25_000_000
      )
        throw new Error("Bitte maximal 20 Dateien und zusammen 25 MB wählen.");
      const entries = await Promise.all(
        files.map(async (f) => ({
          id: crypto.randomUUID(),
          name: f.name.slice(0, 200) || "Datei",
          mime: (
            f.type ||
            (
              {
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                webp: "image/webp",
                gif: "image/gif",
                mp4: "video/mp4",
                webm: "video/webm",
                mov: "video/quicktime",
                mp3: "audio/mpeg",
                wav: "audio/wav",
                m4a: "audio/mp4",
                pdf: "application/pdf",
                txt: "text/plain",
              } as Record<string, string>
            )[f.name.split(".").pop()?.toLowerCase() || ""] ||
            "application/octet-stream"
          ).slice(0, 100),
          content: Buffer.from(await f.arrayBuffer()),
          size: f.size,
        })),
      );
      transaction(() => {
        for (const e of entries)
          db.prepare(
            "INSERT INTO StorageItem(id,parentId,name,kind,mime,size,createdAt,content) VALUES(?,?,?,'file',?,?,?,?)",
          ).run(
            e.id,
            parentId,
            e.name,
            e.mime,
            e.size,
            new Date().toISOString(),
            e.content,
          );
      });
      return Response.json({
        items: storageItems(),
        added: entries.map((e) => e.id),
      });
    }
    const b = await request.json();
    if (b.action === "folder") {
      if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 200)
        throw new Error("Bitte einen Ordnernamen eingeben.");
      checkStorageParent(b.parentId || null);
      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO StorageItem(id,parentId,name,kind,createdAt) VALUES(?,?,?,'folder',?)",
      ).run(id, b.parentId || null, b.name.trim(), new Date().toISOString());
      return Response.json({ items: storageItems(), added: [id] });
    }
    const row = db.prepare("SELECT id FROM StorageItem WHERE id=?").get(b.id);
    if (!row) throw new Error("Eintrag nicht gefunden.");
    if (b.action === "rename") {
      if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 200)
        throw new Error("Bitte einen Namen eingeben.");
      db.prepare("UPDATE StorageItem SET name=? WHERE id=?").run(
        b.name.trim(),
        b.id,
      );
    } else if (b.action === "move") {
      checkStorageParent(b.parentId || null, b.id);
      db.prepare("UPDATE StorageItem SET parentId=? WHERE id=?").run(
        b.parentId || null,
        b.id,
      );
    } else if (b.action === "delete" || b.action === "restore")
      db.prepare("UPDATE StorageItem SET deleted=? WHERE id=?").run(
        b.action === "delete" ? 1 : 0,
        b.id,
      );
    else throw new Error("Unbekannte Ablage-Aktion.");
    return Response.json({ items: storageItems() });
  } catch (e) {
    return errorResponse(e);
  }
}
