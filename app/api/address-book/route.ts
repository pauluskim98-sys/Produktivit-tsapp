import { db } from "@/lib/db";
import { validAddress } from "@/lib/address-book";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { isDeepStrictEqual } from "node:util";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function ready() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS AddressBook (id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT NOT NULL)",
  );
}
const entries = () =>
  db
    .prepare(
      "SELECT id,name,address FROM AddressBook ORDER BY name COLLATE NOCASE",
    )
    .all();
export async function GET() {
  ready();
  return Response.json(
    { entries: entries() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    ready();
    const body = await request.json();
    if (
      typeof body.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(body.id) ||
      !("expected" in body)
    )
      throw new Error("Ungültige Adresse.");
    const row =
      db
        .prepare("SELECT id,name,address FROM AddressBook WHERE id=?")
        .get(body.id) || null;
    const current = row ? { ...row } : null;
    if (!isDeepStrictEqual(current, body.expected))
      throw new Error(
        "Diese Adresse wurde inzwischen geändert. Bitte erneut öffnen.",
      );
    if (body.entry === null)
      db.prepare("DELETE FROM AddressBook WHERE id=?").run(body.id);
    else {
      const e = validAddress(body.entry);
      if (e.id !== body.id) throw new Error("Ungültige Adresse.");
      if (!current && entries().length >= 500)
        throw new Error("Das Adressbuch ist voll.");
      db.prepare(
        "INSERT INTO AddressBook(id,name,address) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,address=excluded.address",
      ).run(e.id, e.name, e.address);
    }
    return Response.json(
      { entries: entries() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
