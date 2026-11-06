import type { Todo } from "./types";

export const notePeriods=["day","week","month"] as const;
export type NotePeriod=(typeof notePeriods)[number];
export const notePeriodNames={day:"Heute",week:"Woche",month:"Monat"};
export const noteFonts={system:"Systemschrift",arial:"Arial",georgia:"Georgia",mono:"Monospace"} as const;
export type NoteFont=keyof typeof noteFonts;
export const noteFontCss:Record<NoteFont,string>={system:"system-ui,sans-serif",arial:"Arial,sans-serif",georgia:"Georgia,serif",mono:"monospace"};
export type NotePreferences={height:number;font:NoteFont;size:number;columns:NotePeriod[]};
export const defaultNotePreferences:NotePreferences={height:14,font:"system",size:14,columns:[...notePeriods]};
export function notePeriod(todo:Pick<Todo,"tags">):NotePeriod|undefined {
  return notePeriods.find((period)=>todo.tags.includes(`note-todo:${period}`));
}
export function waitingNoteTodo(todo:Pick<Todo,"tags"|"plannedDate"|"done">,today:string){
  return !!notePeriod(todo) && (!todo.plannedDate || (!todo.done && todo.plannedDate<today));
}
export function putInNoteTodo(todo:Todo,period:NotePeriod,important:boolean,position:number):Todo {
  return {...todo,plannedDate:null,time:"",priority:important?"high":"none",position,
    tags:[...todo.tags.filter((tag)=>!/^note-todo:|^[hdnq]:|^note-origin:/.test(tag) && !["stored","auto:day"].includes(tag)),`note-todo:${period}`]};
}
