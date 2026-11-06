"use client";
import { useId, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Check } from "lucide-react";
import type { Todo } from "@/lib/types";
import { notePeriod, notePeriodNames, waitingNoteTodo, type NotePeriod } from "@/lib/note-todos";

export function NoteTodoCheck({done}:{done:boolean}){
  return <span aria-hidden="true" className="note-todo-check">{done && <Check size={12}/>}</span>;
}

function NoteTodoRow({todo,onToggle,onOpen,period,important,selected}:{todo:Todo;onToggle:()=>void;onOpen:()=>void;period:NotePeriod;important:boolean;selected:boolean}){
  const id=useId();
  const drag=useDraggable({id:`note-todo:${id}`,data:{todoId:todo.id}});
  const drop=useDroppable({id:`note-row:${id}`,data:{kind:"note-todo",period,important,before:todo.id,priority:true}});
  return <div ref={drop.setNodeRef} data-task-id={todo.id} className={`note-todo-row ${drop.isOver?"note-todo-over":""}`} data-selected={selected || undefined} style={{opacity:drag.isDragging ? .35 : 1}}>
    <button type="button" ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners} onClick={onToggle}
      aria-pressed={todo.done} title={todo.title} onKeyDown={(event)=>{
        if(event.key==="F2"){event.preventDefault();onOpen();}
        else drag.listeners?.onKeyDown?.(event);
      }} onContextMenu={(event)=>{
        if(selected || event.currentTarget.closest(".area-selection-mode"))return;
        event.preventDefault();event.stopPropagation();onOpen();
      }}>
      <NoteTodoCheck done={todo.done}/><span className={todo.done?"note-todo-done":undefined}>{todo.title}</span>
    </button>
  </div>;
}
function Cell({period,important,todos,onAdd,onToggle,onOpen,selected}:{
  period:NotePeriod;important:boolean;todos:Todo[];
  onAdd:(title:string,period:NotePeriod,important:boolean)=>Promise<void>;onToggle:(todo:Todo)=>void;onOpen:(id:string)=>void;selected:string[];
}){
  const id=useId();
  const drop=useDroppable({id:`note-cell:${id}`,data:{kind:"note-todo",period,important}});
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  return <div ref={drop.setNodeRef} className={`note-todo-cell ${drop.isOver?"note-todo-over":""}`}>
    {todos.map((todo)=><NoteTodoRow key={todo.id} todo={todo} period={period} important={important} selected={selected.includes(todo.id)} onOpen={()=>onOpen(todo.id)} onToggle={()=>onToggle(todo)}/>)}
    <form onSubmit={async(event)=>{
      event.preventDefault();if(!text.trim()||busy)return;
      setBusy(true);setError("");
      try{await onAdd(text.trim(),period,important);setText("");}catch(error){setError((error as Error).message);}finally{setBusy(false);}
    }}>
      <input aria-label={`${notePeriodNames[period]} · ${important?"Sehr wichtig":"Normal"} · To-do hinzufügen`} placeholder="+ To-do" value={text} onChange={(event)=>setText(event.target.value)}/>
    </form>
    {error && <small role="alert">{error}</small>}
  </div>;
}
export default function NoteTodoBoard({todos,today,columns,onAdd,onToggle,onOpen,selected}:{
  todos:Todo[];today:string;columns:NotePeriod[];selected:string[];
  onAdd:(title:string,period:NotePeriod,important:boolean)=>Promise<void>;onToggle:(todo:Todo)=>void;onOpen:(id:string)=>void;
}){
  const pending=todos.filter((todo)=>waitingNoteTodo(todo,today)).sort((a,b)=>a.position-b.position);
  return <section className="note-todo-board" aria-label="To-do-Liste">
    <div className="note-todo-grid" style={{gridTemplateColumns:`repeat(${columns.length},minmax(0,1fr))`}}>
      {columns.map((period)=><strong key={period}>{notePeriodNames[period]}</strong>)}
      {[true,false].map((important)=><div className="note-todo-band" key={String(important)}>
        <span className={important?"note-band-important":undefined}>{important?"Sehr wichtig":"Normal"}</span>
        {columns.map((period)=><Cell key={period} period={period} important={important} onAdd={onAdd} onOpen={onOpen} onToggle={onToggle} selected={selected}
          todos={pending.filter((todo)=>notePeriod(todo)===period && (todo.priority==="high")===important)}/>)}
      </div>)}
    </div>
  </section>;
}
