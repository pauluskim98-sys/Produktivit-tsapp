import { db, USER } from "@/lib/db";
import { isDateKey } from "@/lib/dates";
import { sameOrigin, errorResponse } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { date, content } = await request.json();
    if (
      !isDateKey(date) ||
      typeof content !== "string" ||
      content.length > 10000
    )
      throw new Error("Ungültige Tagesnotiz.");
    db.prepare(
      "INSERT INTO DayNote (date,userId,content) VALUES (?,?,?) ON CONFLICT(date) DO UPDATE SET content=excluded.content",
    ).run(date, USER, content);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
