import {
  todoistStatus,
  syncTodoist,
  disconnectTodoist,
} from "@/lib/todoist-sync";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { getTodos } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(todoistStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (body.action === "disconnect") {
      disconnectTodoist();
      return Response.json(todoistStatus());
    }
    if (body.action !== "connect" && body.action !== "sync")
      throw new Error("Unbekannte Todoist-Aktion.");
    if (
      body.action === "connect" &&
      (typeof body.token !== "string" ||
        !/^[-_a-zA-Z0-9]{20,500}$/.test(body.token))
    )
      throw new Error("Bitte ein gültiges Todoist-API-Token eingeben.");
    const count = await syncTodoist(
      body.action === "connect" ? body.token : undefined,
    );
    return Response.json({ ...todoistStatus(), count, todos: getTodos() });
  } catch (e) {
    return errorResponse(e);
  }
}
