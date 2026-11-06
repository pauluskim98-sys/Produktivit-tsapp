import { accountRoute } from "@/lib/account-route";
import { db, transaction } from "@/lib/db";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { historyValues, mutationResponse } from "@/lib/mutation-history";
import { isTaskSymbol } from "@/lib/task-picture";
export const dynamic = "force-dynamic";
function init() { db.exec("CREATE TABLE IF NOT EXISTS TaskPicture(id TEXT PRIMARY KEY,url TEXT NOT NULL)"); }
async function handleGET(request: Request) {
  init(); const id = new URL(request.url).searchParams.get("id") || "";
  const row = db.prepare("SELECT url FROM TaskPicture WHERE id=?").get(id);
  return Response.json(row || { url:null });
}
async function handlePOST(request: Request) {
  try {
    sameOrigin(request); init(); const body = await request.json();
    return transaction(()=>{
      const id=body.action==="history-change"?body.change?.id:body.id;
      if(typeof id!=="string" || !id || id.length>100)throw new Error("Bild prüfen.");
      const before=db.prepare("SELECT url FROM TaskPicture WHERE id=?").get(id)?.url ?? null;
      const url=body.action==="history-change"?historyValues(body.change,body.redo,before):body.url;
      if(url===null && body.action==="history-change")db.prepare("DELETE FROM TaskPicture WHERE id=?").run(id);
      else {
        if(typeof url!=="string" || (url!=="" && !/^\/api\/storage\?file=[a-zA-Z0-9%-]+$/.test(url) &&
          !(url.startsWith("icon:") && isTaskSymbol(url.slice(5)))))throw new Error("Bild prüfen.");
        db.prepare("INSERT INTO TaskPicture(id,url) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url").run(id,url);
      }
      return body.action==="history-change"?Response.json({ok:true}):mutationResponse({ok:true},{id,before,after:url});
    });
  } catch (e) { return errorResponse(e); }
}

export const GET = accountRoute(handleGET);
export const POST = accountRoute(handlePOST);
