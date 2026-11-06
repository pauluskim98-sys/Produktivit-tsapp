import { accountRoute } from "@/lib/account-route";
import { db, transaction } from "@/lib/db";
import { historyValues, mutationResponse } from "@/lib/mutation-history";
import { validZone, type CalendarZone } from "@/lib/calendar-zones";
import { errorResponse, sameOrigin } from "@/lib/validation";

export const dynamic = "force-dynamic";
function zones(): CalendarZone[] {
  db.exec("CREATE TABLE IF NOT EXISTS CalendarZone (id TEXT PRIMARY KEY, content TEXT NOT NULL)");
  return db.prepare("SELECT content FROM CalendarZone ORDER BY rowid").all().map((row)=>JSON.parse(String(row.content)));
}

export const GET = accountRoute(async()=>Response.json(zones()));
export const POST = accountRoute(async(request)=>{
  try {
    sameOrigin(request);
    const body = await request.json();
    return transaction(()=>{
    const current = zones();
    const id=body.action==="save"?body.zone?.id:body.action==="history-change"?body.change?.id:body.id;
    if(typeof id!=="string" || !/^[\w-]{1,80}$/.test(id))throw new Error("Ungültige Zone.");
    const before=current.find((item)=>item.id===id) ?? null;
    let value:unknown;
    if(body.action==="delete")value=null;
    else if(body.action==="save")value=body.zone;
    else if(body.action==="history-change")value=historyValues(body.change,body.redo,before);
    else throw new Error("Unbekannte Zonenänderung.");
    const after=value===null?null:validZone(value);
    if(after){
      if(after.id!==id || (current.length>=250 && !before))throw new Error("Zone konnte nicht gespeichert werden.");
      db.prepare("INSERT INTO CalendarZone(id,content) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content").run(id,JSON.stringify(after));
    }else db.prepare("DELETE FROM CalendarZone WHERE id=?").run(id);
    const data={zones:zones()};
    return body.action==="history-change"?Response.json(data):mutationResponse(data,{id,before,after});
    });
  } catch(error){return errorResponse(error);}
});
