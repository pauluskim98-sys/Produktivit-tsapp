import { accountRoute } from "@/lib/account-route";
import { db, USER } from "@/lib/db";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { emptyBoard, validateBoard } from "@/lib/sketchboard";
export const dynamic = "force-dynamic";
function prepare() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS Sketchboard (userId TEXT PRIMARY KEY, content TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)",
  );
  db.prepare(
    "INSERT OR IGNORE INTO Sketchboard(userId,content) VALUES (?,?)",
  ).run(USER, JSON.stringify(emptyBoard()));
}
export const GET = accountRoute(async () => {
  prepare();
  const row = db
    .prepare("SELECT content,revision FROM Sketchboard WHERE userId=?")
    .get(USER) as { content: string; revision: number };
  return Response.json(
    { board: JSON.parse(row.content), revision: row.revision },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const PUT = accountRoute(async (request) => {
  try {
    sameOrigin(request);
    const raw = await request.text();
    if (raw.length > 8_000_000)
      throw new Error("Die Zeichenfläche ist zu groß.");
    const { board, revision } = JSON.parse(raw);
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new Error("Ungültiger Speicherstand.");
    const valid = validateBoard(board);
    prepare();
    const result = db
      .prepare(
        "UPDATE Sketchboard SET content=?,revision=revision+1 WHERE userId=? AND revision=?",
      )
      .run(JSON.stringify(valid), USER, revision);
    if (!result.changes)
      return Response.json(
        {
          error:
            "Die LifeMap wurde in einem anderen Fenster geändert. Bitte lade sie neu; deine Änderungen kannst du vorher exportieren.",
        },
        { status: 409 },
      );
    return Response.json({ revision: revision + 1 });
  } catch (error) {
    return errorResponse(error);
  }
});
