"use client";
import { useId, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import type { Todo } from "@/lib/types";
import { quadrantOf } from "@/lib/eisenhower";
import PeriodTask from "./period-task";

export const taskPeriods = ["day", "week", "month"] as const;
export type TaskPeriod = (typeof taskPeriods)[number];
export const taskPeriodLabels = {day:"Tag",week:"Woche",month:"Monat"};
export function taskPeriod(todo: Todo): TaskPeriod {
  const tag = todo.tags.find((tag) => /^h:(day|week|month)$/.test(tag));
  return tag ? tag.slice(2) as TaskPeriod : todo.tags.includes("h:year") ? "month" : "week";
}
export function taskImportant(todo:Todo) { const q=quadrantOf(todo.tags); return q ? q === "1" || q === "2" : todo.priority === "high" || todo.priority === "medium"; }
type Props = {todos:Todo[]; active:string; onSelect:(p:TaskPeriod)=>void; onOpen:(id:string)=>void; onAdd:(title:string,p:TaskPeriod,important:boolean)=>Promise<void>; onMove:(todo:Todo,p:TaskPeriod,important:boolean)=>Promise<void>};
function Cell({period, important, todos, onOpen, onAdd, onMove}: Omit<Props,"active"|"onSelect"> & {period:TaskPeriod;important:boolean}) {
  const id=useId(), [draft,setDraft]=useState(""), [error,setError]=useState(""), [busy,setBusy]=useState(false), [menu,setMenu]=useState<string>();
  const drop=useDroppable({id:`task-grid:${id}`,data:{kind:"eisenhower",period,quadrant:important ? "1" : "4"}});
  return <div className={`task-grid-cell ${drop.isOver ? "task-grid-over" : ""}`} ref={drop.setNodeRef}>
    <form onSubmit={async(e)=>{e.preventDefault(); const title=draft.trim(); if(!title || busy)return; setDraft("");setBusy(true);setError("");try{await onAdd(title,period,important);}catch(e){setDraft((current)=>current||title);setError((e as Error).message);}finally{setBusy(false);}}}>
      <input aria-label={`${taskPeriodLabels[period]} – ${important ? "Wichtig" : "Unwichtig"}: Aufgabe hinzufügen`} placeholder="+ Aufgabe" value={draft} onChange={(e)=>setDraft(e.target.value)} />
    </form>
    {todos.map((todo)=><div key={todo.id} onContextMenu={(e)=>{if ((e.currentTarget.querySelector(".group-selected"))) return; e.preventDefault(); e.stopPropagation(); setMenu(menu===todo.id ? undefined : todo.id);}}>
      <PeriodTask todo={todo} compact onOpen={onOpen} onImportance={(value)=>void onMove(todo,period,value).catch((e)=>setError(e.message))} />
      {todo.plannedDate && <small>{todo.plannedDate} {todo.time}</small>}
      {menu===todo.id && <div className="eisenhower-menu selection-toolbar">{taskPeriods.flatMap((p)=>[true,false].filter((i)=>p!==period || i!==important).map((i)=><button key={`${p}:${i}`} onClick={()=>{setMenu(undefined);void onMove(todo,p,i).catch((e)=>setError(e.message));}}>{taskPeriodLabels[p]} · {i ? "Wichtig" : "Unwichtig"}</button>))}</div>}
    </div>)}
    {error && <small role="alert">{error}</small>}
  </div>;
}
export default function PeriodTaskGrid({todos,active,onSelect,onPeriodOpen,...actions}:Props & {onPeriodOpen?:(p:TaskPeriod)=>void}) {
  return <div className="period-task-grid">
    <div />{taskPeriods.map((p)=><button key={p} type="button" data-period={p} aria-pressed={active===p} onClick={()=>onSelect(p)} onDoubleClick={()=>onPeriodOpen?.(p)} title="Doppelklick: Kalenderansicht öffnen">{taskPeriodLabels[p]}</button>)}
    {[true,false].map((important)=><div className="period-task-grid-row" key={String(important)}><span className={important?"importance-up":"importance-down"} title={important?"Wichtig":"Unwichtig"} aria-label={important?"Wichtig":"Unwichtig"}>{important?<ArrowUp size={16}/>:<ArrowDown size={16}/>}</span>{taskPeriods.map((period)=><Cell key={period} period={period} important={important} todos={todos.filter((t)=>taskPeriod(t)===period && taskImportant(t)===important)} {...actions}/>)}</div>)}
  </div>;
}
