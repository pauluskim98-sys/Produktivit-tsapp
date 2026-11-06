import type { CalendarEvent } from "../types";
export type CalendarRule = { connectionId:string; kind:"event"|"series"|"title"|"group"|"group-title"; key:string; label:string; title:string; color:string; hidden:number };
export type NativeCalendarConfig = {id:"lifemap";name:string;color:string;rules:CalendarRule[]};
export const nativeCalendarDefaults:NativeCalendarConfig={id:"lifemap",name:"Lifemap",color:"#27845e",rules:[]};
export function nativeGroupColor(title:string,rules:CalendarRule[]) {
  const key=eventTitleKey(title);
  return rules.findLast((rule)=>rule.kind==="group-title" && rule.key===key)?.color ||
    rules.findLast((rule)=>rule.kind==="group" && key.includes(rule.key))?.color;
}
export function eventTitleKey(title: string) {
  return title.trim().toLocaleLowerCase("de-DE");
}
export function hasMatchingCalendarTitle(events: CalendarEvent[], event: CalendarEvent) {
  const key = eventTitleKey(event.originalTitle || event.title);
  return !event.seriesId && !!key && key.length <= 240 && events.some((other) =>
    other.connectionId === event.connectionId && other.id !== event.id && !other.seriesId &&
    eventTitleKey(other.originalTitle || other.title) === key
  );
}
export function applyCalendarRules(events:CalendarEvent[], rules:CalendarRule[]) {
  const byCalendar=new Map<string,CalendarRule[]>();
  for(const rule of rules) {const list=byCalendar.get(rule.connectionId)||[]; list.push(rule);byCalendar.set(rule.connectionId,list);}
  return events.flatMap((event)=>{
    const matches=(byCalendar.get(event.connectionId)||[]).filter((rule)=>{
      if(rule.kind==="event")return rule.key===event.id;
      if(rule.kind==="series")return rule.key===event.seriesId;
      const title=eventTitleKey(event.originalTitle||event.title);
      if(rule.kind==="group-title")return title===rule.key;
      return rule.kind==="title" ? !event.seriesId && title===rule.key : title.includes(rule.key);
    });
    if(matches.some((r)=>r.hidden))return [];
    const ordered=[...matches.filter((r)=>r.kind==="group"),...matches.filter((r)=>r.kind==="group-title"),...matches.filter((r)=>r.kind==="series"),...matches.filter((r)=>r.kind==="event")];
    return [ordered.reduce((e,r)=>({...e,...(r.title?{title:r.title}:{}),...(r.color?{color:r.color}:{}),...(r.kind.startsWith("group")?{group:r.label}:{})}),event)];
  });
}
