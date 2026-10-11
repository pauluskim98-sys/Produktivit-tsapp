import { getApiKey } from "@/lib/ai-config";
import { db, getTodos, getConnections, getEvents, USER } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const notes = db
    .prepare("SELECT date,content FROM DayNote WHERE userId = ?")
    .all(USER) as { date: string; content: string }[];
  return Response.json(
    {
      todos: getTodos(),
      connections: getConnections(),
      events: getEvents(),
      dayNotes: Object.fromEntries(notes.map((n) => [n.date, n.content])),
      aiAvailable: Boolean(getApiKey()),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
