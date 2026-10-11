import {
  db,
  getTodos,
  getConnections,
  getEvents,
  getMessages,
  USER,
} from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const todos = getTodos();
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos,
    calendars: getConnections(),
    events: getEvents(),
    dayNotes: db
      .prepare("SELECT date,content FROM DayNote WHERE userId=?")
      .all(USER),
    dayMessages: db.prepare("SELECT * FROM DayMessage ORDER BY rowid").all(),
    planningMessages: db
      .prepare("SELECT * FROM PlannerMessage ORDER BY rowid")
      .all(),
    planningProposals: db
      .prepare("SELECT * FROM PlannerProposal ORDER BY createdAt")
      .all(),
    chats: Object.fromEntries(todos.map((t) => [t.id, getMessages(t.id)])),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="raum-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
