import { accountRoute } from "@/lib/account-route";
import { db, USER } from "@/lib/db";
import { periodRange } from "@/lib/calendar-interactions";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { isNotebookFolder, notebookFolder } from "@/lib/notebook";
async function handlePOST(request: Request) {
  try {
    sameOrigin(request);
    const { date, content } = await request.json();
    if (
      (typeof date !== "string" || (date !== "inbox" && date !== "storage" && !periodRange(date) && !notebookFolder(date) && !isNotebookFolder(date))) ||
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

export const POST = accountRoute(handlePOST);
