import { accountRoute } from "@/lib/account-route";
import { db } from "@/lib/db";
import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function init() {
  db.exec("CREATE TABLE IF NOT EXISTS TaskTemplate (category TEXT NOT NULL, title TEXT NOT NULL, uses INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(category,title))");
}
async function handleGET() {
  init();
  return Response.json(db.prepare("SELECT category,title,uses FROM TaskTemplate ORDER BY uses DESC,title COLLATE NOCASE").all());
}
async function handlePOST(request: Request) {
  try {
    sameOrigin(request); init();
    const { category, title, used } = await request.json();
    if (typeof category !== "string" || category.length > 100 || typeof title !== "string" || !title.trim() || title.length > 500) throw new Error("Vorlage prüfen.");
    db.prepare("INSERT INTO TaskTemplate(category,title,uses) VALUES(?,?,?) ON CONFLICT(category,title) DO UPDATE SET uses=uses+excluded.uses").run(category, title.trim(), used === true ? 1 : 0);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

export const GET = accountRoute(handleGET);
export const POST = accountRoute(handlePOST);
