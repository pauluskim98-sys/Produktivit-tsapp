import { accountRoute } from "@/lib/account-route";
import { db } from "@/lib/db";
import { sameOrigin, errorResponse, validTodo } from "@/lib/validation";
import { templateSettings } from "@/lib/task-templates";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function init() {
  db.exec("CREATE TABLE IF NOT EXISTS TaskTemplate (category TEXT NOT NULL, title TEXT NOT NULL, uses INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(category,title))");
  const columns = db.prepare("PRAGMA table_info(TaskTemplate)").all() as {name:string}[];
  if (!columns.some(column => column.name === "settings"))
    db.exec("ALTER TABLE TaskTemplate ADD COLUMN settings TEXT");
}
async function handleGET() {
  init();
  const rows = db.prepare("SELECT category,title,uses,settings FROM TaskTemplate ORDER BY uses DESC,title COLLATE NOCASE").all() as {category:string;title:string;uses:number;settings:string|null}[];
  return Response.json(rows.map(row => ({...row, settings:row.settings ? JSON.parse(row.settings) : null})));
}
async function handlePOST(request: Request) {
  try {
    sameOrigin(request);
    init();
    const { category, title, used, todo } = await request.json();
    if (typeof category !== "string" || !category.trim() || category.length > 38 || typeof title !== "string" || !title.trim() || title.length > 500)
      throw new Error("Vorlage prüfen.");
    const settings = todo ? JSON.stringify(templateSettings(validTodo(todo))) : null;
    db.prepare("INSERT INTO TaskTemplate(category,title,uses,settings) VALUES(?,?,?,?) ON CONFLICT(category,title) DO UPDATE SET uses=uses+excluded.uses, settings=COALESCE(excluded.settings,TaskTemplate.settings)")
      .run(category, title.trim(), used === true ? 1 : 0, settings);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
export const GET = accountRoute(handleGET);
export const POST = accountRoute(handlePOST);
