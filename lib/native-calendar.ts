import { db, getTodos } from "@/lib/db";
import { historyValues, mutationResponse } from "@/lib/mutation-history";
import { eventTitleKey, nativeCalendarDefaults, type CalendarRule, type NativeCalendarConfig } from "@/lib/calendar/overrides";

function config():NativeCalendarConfig {
  db.exec("CREATE TABLE IF NOT EXISTS NativeCalendarConfig (id INTEGER PRIMARY KEY, content TEXT NOT NULL)");
  const row=db.prepare("SELECT content FROM NativeCalendarConfig WHERE id=1").get();
  return row ? JSON.parse(String(row.content)) : nativeCalendarDefaults;
}
function eventTypes(){
  const counts=new Map<string,number>();
  for(const todo of getTodos())counts.set(todo.title,(counts.get(todo.title)||0)+1);
  return [...counts].sort(([a],[b])=>a.localeCompare(b,"de")).map(([title,count])=>({title,count}));
}
export function nativeCalendarData() {
  const settings=config();
  return {...settings,types:eventTypes()};
}
const string=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
const shade=(value:unknown)=>typeof value==="string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "";
function valid(value:unknown):NativeCalendarConfig {
  const data=value as NativeCalendarConfig;
  if(!data || !string(data.name,80) || !shade(data.color) || !Array.isArray(data.rules) || data.rules.length>2000)
    throw new Error("Kalendereinstellungen prüfen.");
  const rules=data.rules.map((rule)=>{
    if(!rule || !["group","group-title"].includes(rule.kind) || !string(rule.key,240) || !string(rule.label,100) || !shade(rule.color))
      throw new Error("Kalendergruppe prüfen.");
    return {connectionId:"lifemap",kind:rule.kind,key:string(rule.key,240),label:string(rule.label,100),color:rule.color,title:"",hidden:0} satisfies CalendarRule;
  });
  return {id:"lifemap",name:string(data.name,80),color:data.color,rules};
}
export function changeNativeCalendar(body:any) {
  const before=config();
  let after:NativeCalendarConfig;
  if(body.action==="history-change")after=valid(historyValues(body.change,body.redo,before));
  else if(body.action==="connection" || body.action==="rename-connection")after=valid({
    ...before,name:body.name,color:body.action==="connection"?body.color:before.color,
  });
  else if(body.action==="remove"){
    after={...before,rules:before.rules.filter((rule)=>rule.kind!==body.kind || rule.key!==body.key)};
  }else if(body.action==="group" || body.action==="group-members"){
    const kind=body.action==="group"?"group":"group-title";
    const titles=kind==="group"?[body.match]:body.titles;
    if(!Array.isArray(titles) || !titles.length || titles.length>500)throw new Error("Bitte Terminarten wählen.");
    const keys=[...new Set(titles.map((title)=>eventTitleKey(string(title,240))))];
    if(kind==="group-title"){
      const known=new Set(eventTypes().map((entry)=>eventTitleKey(entry.title)));
      if(keys.some((key)=>!known.has(key)))throw new Error("Eine Terminart wurde nicht gefunden.");
    }
    after=valid({...before,rules:[
      ...before.rules.filter((rule)=>rule.kind!==kind || !keys.includes(rule.key)),
      ...keys.map((key)=>({kind,key,label:body.label,color:body.color})),
    ]});
  }else throw new Error("Unbekannte Kalenderänderung.");
  db.prepare("INSERT INTO NativeCalendarConfig(id,content) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content").run(JSON.stringify(after));
  return body.action==="history-change"?Response.json({ok:true}):mutationResponse({ok:true},{id:"lifemap",before,after});
}
