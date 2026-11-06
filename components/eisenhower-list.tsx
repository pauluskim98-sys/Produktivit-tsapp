"use client";
import { useId, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { quadrants, quadrantOf, type Quadrant } from "@/lib/eisenhower";
import type { Todo } from "@/lib/types";
import PeriodTask from "./period-task";

const labels = { "1":"Als Nächstes", "2":"Einplanen", "3":"Kurz erledigen", "4":"Später entscheiden", "":"Noch offen" };
type Props = { todos: Todo[]; expanded: boolean; onOpen: (id:string)=>void; onAdd:(title:string,q?:Quadrant)=>Promise<void>; onMove:(todo:Todo,q?:Quadrant)=>Promise<void> };

function Lane({ quadrant, todos, onOpen, onAdd, onMove }: Omit<Props,"expanded"> & { quadrant?:Quadrant }) {
  const key = useId();
  const [draft,setDraft] = useState("");
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [menu,setMenu] = useState<string|null>(null);
  const drop = useDroppable({id:`eisenhower:${key}`,data:{kind:"eisenhower",quadrant}});
  const label = labels[quadrant || ""];
  return <section ref={drop.setNodeRef} className={`eisenhower-lane ${drop.isOver ? "eisenhower-over" : ""}`}>
    <details open><summary>{quadrant && <span className="eisenhower-number">{quadrant}</span>}{label} <small>{todos.length}</small></summary>
      <form onSubmit={async (e) => { e.preventDefault(); if (!draft.trim() || saving) return; setSaving(true); setError(""); try { await onAdd(draft.trim(),quadrant); setDraft(""); } catch(e) { setError((e as Error).message); } finally { setSaving(false); } }}>
        <input aria-label={`${label}: Aufgabe hinzufügen`} placeholder="Aufgabe hinzufügen" value={draft} disabled={saving} onChange={(e)=>setDraft(e.target.value)} />
      </form>
      {todos.map((todo)=><div key={todo.id} onContextMenu={(e)=>{ if(e.shiftKey) return; e.preventDefault(); e.stopPropagation(); setMenu(menu===todo.id ? null : todo.id); }}>
        <PeriodTask todo={todo} compact onOpen={onOpen} detail={todo.plannedDate ? `${todo.title} · ${todo.plannedDate}${todo.time ? ` · ${todo.time}` : ""}` : undefined} />
        {todo.plannedDate && <small className="eisenhower-date">{todo.plannedDate} {todo.time}</small>}
        {menu===todo.id && <div className="eisenhower-menu selection-toolbar" aria-label="Aufgabe zuordnen">{([...quadrants,undefined]).filter((q)=>q!==quadrant).map((q)=><button key={q || "open"} onClick={()=>{setMenu(null);void onMove(todo,q).catch((e)=>setError(e.message));}}>{q && `${q} · `}{labels[q || ""]}</button>)}</div>}
      </div>)}
      {error && <p role="alert">{error}</p>}
    </details>
  </section>;
}
export default function EisenhowerList({ todos, expanded, ...actions }: Props) {
  const lane = (q?:Quadrant) => <Lane key={q || "open"} quadrant={q} todos={todos.filter((t)=>quadrantOf(t.tags)===q)} {...actions} />;
  return <div className={`eisenhower-list ${expanded ? "eisenhower-wide" : ""}`}>{lane()}<div className="eisenhower-fields">{quadrants.map(lane)}</div></div>;
}
