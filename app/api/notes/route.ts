import { accountRoute } from "@/lib/account-route";
import { db, USER } from "@/lib/db";
import { isJournalKey } from "@/lib/journal-layout";
import { isDateKey } from "@/lib/dates";
import { periodRange } from "@/lib/calendar-interactions";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { dayHeaderNoteKey, isNotebookFolder, notebookFolder, notebookColumnParent } from "@/lib/notebook";
async function handlePOST(request: Request) {
  try {
    sameOrigin(request);
    const { date, content } = await request.json();
    const parent = typeof date === "string" ? notebookColumnParent(date) : undefined;
    const headerDate = typeof date === "string" && date.startsWith(dayHeaderNoteKey("")) ? date.slice(dayHeaderNoteKey("").length) : null;
    if (
      (typeof date !== "string" || (date !== "inbox" && date !== "storage" && !isJournalKey(date) && !isDateKey(headerDate) && !periodRange(date) && !notebookFolder(date) && !isNotebookFolder(date) && !(parent && (periodRange(parent) || notebookFolder(parent))))) ||
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
