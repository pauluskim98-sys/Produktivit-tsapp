import type { Todo } from "./types";
import { dateKey, isDateKey } from "./dates.ts";

export function taskDay(todo: Pick<Todo,"tags"|"plannedDate"|"createdAt">) {
  if(todo.plannedDate)return todo.plannedDate;
  if(!todo.tags.includes("h:day") || todo.tags.includes("stored"))return null;
  const explicit=todo.tags.find((tag)=>tag.startsWith("d:") && isDateKey(tag.slice(2)))?.slice(2);
  const created=new Date(todo.createdAt);
  return explicit || (Number.isFinite(created.valueOf()) ? dateKey(created) : null);
}
export function plannerPeriodTags(tags:string[], period:string, day:string) {
  const sameDay = period==="day" && tags.includes("h:day") ? tags.find((t)=>t.startsWith("d:") && isDateKey(t.slice(2))) : undefined;
  return [...tags.filter((t)=>!/^h:(day|week|month|year)$/.test(t) && !t.startsWith("d:")),`h:${period}`,...(period==="day"?[sameDay || `d:${day}`]:[])];
}

const noteOriginPrefix="note-origin:";
export function parkedNoteTag(noteDate:string){
  return `n:${noteDate.startsWith("note:")?noteDate.split(":").at(-1):noteDate}`;
}
export function parkTask(todo:Todo,noteDate:string):Todo {
  const origin=todo.tags.find((tag)=>tag.startsWith(noteOriginPrefix));
  const day=taskDay(todo);
  return {...todo,plannedDate:null,time:"",tags:[
    ...todo.tags.filter((tag)=>tag!=="stored" && tag!=="auto:day" && !tag.startsWith("n:") && !tag.startsWith(noteOriginPrefix)),
    "stored",parkedNoteTag(noteDate),...(origin?[origin]:day?[`${noteOriginPrefix}${day}@${todo.time}`]:[]),
  ]};
}
export function restoreParkedTask(todo:Todo,today:string,target?:{day:string;time:string;duration:Todo["duration"]}):Todo {
  const origin=todo.tags.find((tag)=>tag.startsWith(noteOriginPrefix))?.slice(noteOriginPrefix.length);
  const [oldDay,oldTime]=origin?.split("@") || [];
  const day=target?.day || (isDateKey(oldDay) ? oldDay : today);
  const time=target?.time ?? (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(oldTime || "")?oldTime:"");
  const tags=todo.tags.filter((tag)=>tag!=="stored" && !tag.startsWith("n:") && !tag.startsWith(noteOriginPrefix) && !tag.startsWith("d:"));
  return {...todo,plannedDate:day,time,duration:target ? target.duration : todo.duration,
    tags:plannerPeriodTags(tags,"day",day)};
}
export function isFlexibleTask(todo:Pick<Todo,"plannedDate"|"time"|"tags">) {
  return !todo.time && (!todo.plannedDate || (todo.tags?.includes("auto:day") && todo.tags.includes(`d:${todo.plannedDate}`)));
}
