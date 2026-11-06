import { accountRoute } from "@/lib/account-route";
import { db, transaction, USER } from "@/lib/db";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { eventTitleKey } from "@/lib/calendar/overrides";
import { historyValues, mutationResponse } from "@/lib/mutation-history";
import { changeNativeCalendar, nativeCalendarData } from "@/lib/native-calendar";

export const dynamic="force-dynamic";
const kinds=["event","series","title","group","group-title"];
function text(value:unknown,max:number) {return typeof value==="string"?value.trim().slice(0,max):"";}
function color(value:unknown) {return typeof value==="string" && /^#[\da-f]{6}$/i.test(value)?value:"";}
function rule(id:string,kind:string,key:string) {
  return db.prepare("SELECT label,title,color,hidden FROM CalendarRule WHERE connectionId=? AND kind=? AND key=?").get(id,kind,key) ?? null;
}
function setRule(id:string,kind:string,key:string,value:unknown) {
  if(value===null){db.prepare("DELETE FROM CalendarRule WHERE connectionId=? AND kind=? AND key=?").run(id,kind,key);return;}
  const row=value as {label:string;title:string;color:string;hidden:number};
  if(!row || typeof row.label!=="string" || typeof row.title!=="string" ||
    (row.color!=="" && !color(row.color)) || ![0,1].includes(row.hidden))throw new Error("Ungültige Kalenderregel.");
  db.prepare("INSERT INTO CalendarRule(connectionId,kind,key,label,title,color,hidden) VALUES(?,?,?,?,?,?,?) ON CONFLICT(connectionId,kind,key) DO UPDATE SET label=excluded.label,title=excluded.title,color=excluded.color,hidden=excluded.hidden").run(id,kind,key,row.label,row.title,row.color,row.hidden);
}
export const GET=accountRoute(async(request)=>{
  const id=new URL(request.url).searchParams.get("id")||"";
  if(id==="lifemap")return Response.json(nativeCalendarData());
  return Response.json({
    rules:db.prepare("SELECT r.* FROM CalendarRule r JOIN CalendarConnection c ON c.id=r.connectionId WHERE c.id=? AND c.userId=? ORDER BY r.kind,r.label").all(id,USER),
    types:db.prepare("SELECT e.title,COUNT(*) AS count FROM CalendarEvent e JOIN CalendarConnection c ON c.id=e.connectionId WHERE c.id=? AND c.userId=? GROUP BY e.title ORDER BY e.title COLLATE NOCASE").all(id,USER),
  });
});
export const POST=accountRoute(async(request)=>{
  try {
    sameOrigin(request);
    const body=await request.json();
    return transaction(()=>{
      const id=text(body.action==="history-change"?body.change?.id:body.id,120);
      if(id==="lifemap")return changeNativeCalendar(body);
      const connection=db.prepare("SELECT name,color FROM CalendarConnection WHERE id=? AND userId=?").get(id,USER);
      if(!connection)throw new Error("Kalender nicht gefunden.");
      const setConnection=(name:string,shade:string)=>db.prepare("UPDATE CalendarConnection SET name=?,color=? WHERE id=? AND userId=?").run(name,shade,id,USER);
      if(body.action==="history-change"){
        const {change,redo}=body;
        if(change.kind==="connection"){
          const value=historyValues(change,redo,connection) as typeof connection;
          const name=text(value?.name,80), shade=text(value?.color,20);
          if(!name || !/^#[0-9a-f]{3,8}$/i.test(shade))throw new Error("Ungültige Kalendereinstellung.");
          setConnection(name,shade);
        }else{
          const kind=text(change.kind,12),keys=change.keys;
          if(!kinds.includes(kind) || !Array.isArray(keys) || keys.length>500 ||
            !keys.every((key)=>typeof key==="string" && key.length>=1 && key.length<=240))throw new Error("Ungültige Kalenderregeln.");
          const current=keys.map((key)=>rule(id,kind,key));
          const values=historyValues(change,redo,current);
          if(!Array.isArray(values) || values.length!==keys.length)throw new Error("Ungültige Kalenderregeln.");
          keys.forEach((key,index)=>setRule(id,kind,key,values[index]));
        }
        return Response.json({ok:true});
      }
      if(body.action==="rename-connection" || body.action==="connection") {
        const name=text(body.name,80), shade=body.action==="connection"?color(body.color):String(connection.color);
        if(!name || !shade)throw new Error("Bitte Name und Farbe eingeben.");
        setConnection(name,shade);
        return mutationResponse({ok:true},{id,kind:"connection",before:connection,after:{name,color:shade}});
      }
      if(body.action==="group-members"){
        const label=text(body.label,100), shade=color(body.color);
        if(!label || !shade || !Array.isArray(body.titles) || !body.titles.length || body.titles.length>500)throw new Error("Bitte Gruppe und Terminarten wählen.");
        const types=new Set(db.prepare("SELECT DISTINCT title FROM CalendarEvent WHERE connectionId=?").all(id).map((row)=>eventTitleKey(String(row.title))));
        const keys=[...new Set<string>(body.titles.map((title:unknown)=>eventTitleKey(text(title,240))))].sort();
        if(keys.some((key)=>!key || !types.has(key)))throw new Error("Eine Terminart wurde nicht gefunden.");
        const kind="group-title", before=keys.map((key)=>rule(id,kind,key));
        const count=Number(db.prepare("SELECT COUNT(*) AS n FROM CalendarRule WHERE connectionId=?").get(id)?.n);
        if(count+before.filter((item)=>item===null).length>2000)throw new Error("Dieser Kalender hat bereits zu viele lokale Regeln.");
        keys.forEach((key)=>setRule(id,kind,key,{label,title:"",color:shade,hidden:0}));
        return mutationResponse({ok:true},{id,kind,keys,before,after:keys.map((key)=>rule(id,kind,key))});
      }
      let kind:string,key:string,label:string,title="",shade="",hidden=0;
      if(["remove","restore","deletion-history"].includes(body.action)){
        kind=text(body.kind,12);key=text(body.key,240);
        if(!kinds.includes(kind) || !key)throw new Error("Regel nicht gefunden.");
        const before=rule(id,kind,key);
        if(body.action==="deletion-history"){
          if(!before || typeof body.redo!=="boolean" || before.hidden===(body.redo?1:0))throw new Error("Diese Terminregel wurde inzwischen geändert.");
          setRule(id,kind,key,{...before,hidden:body.redo?1:0});
          return Response.json({ok:true});
        }
        if(body.action==="remove")setRule(id,kind,key,null);
        else if(before)setRule(id,kind,key,{...before,hidden:0});
        return mutationResponse({ok:true},{id,kind,keys:[key],before:[before],after:[rule(id,kind,key)]});
      }
      if(body.action==="group"){
        kind="group";key=eventTitleKey(text(body.match,240));label=text(body.label,100);shade=color(body.color);
        if(!key || !label || !shade)throw new Error("Bitte Gruppe, Titelsuchtext und Farbe eingeben.");
      }else if(body.action==="event"){
        const event=db.prepare("SELECT id,title,seriesId FROM CalendarEvent WHERE id=? AND connectionId=?").get(text(body.eventId,120),id);
        if(!event)throw new Error("Termin nicht gefunden.");
        hidden=body.hidden===true?1:0;
        kind=body.scope==="series"?"series":body.scope==="title"?"title":"event";
        key=kind==="series"?String(event.seriesId):kind==="title"?eventTitleKey(String(event.title)):String(event.id);
        label=String(event.title);
        if(!key)throw new Error("Bitte den Kalender aktualisieren, damit die Serie erkannt wird.");
        if(kind==="title" && (!hidden || event.seriesId || key.length>240))throw new Error("Diese Termine können nicht nach Titel entfernt werden.");
        if(!hidden){title=text(body.title,300);shade=color(body.color);}
      }else throw new Error("Unbekannte Kalenderänderung.");
      const before=rule(id,kind,key);
      if(!before && Number(db.prepare("SELECT COUNT(*) AS n FROM CalendarRule WHERE connectionId=?").get(id)?.n)>=2000)throw new Error("Dieser Kalender hat bereits zu viele lokale Regeln.");
      setRule(id,kind,key,{label,title:hidden?(before?.title ?? ""):title,color:hidden?(before?.color ?? ""):shade,hidden});
      return mutationResponse({ok:true,...(hidden && !before?.hidden?{deletedRule:{id,kind,key}}:{})},
        {id,kind,keys:[key],before:[before],after:[rule(id,kind,key)]});
    });
  }catch(error){return errorResponse(error);}
});
