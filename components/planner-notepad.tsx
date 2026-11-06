"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import type { Todo } from "@/lib/types";
import PeriodTask from "./period-task";
import RichNoteLine, { type NoteRun } from "./rich-note-line";
import type { NotePreferences } from "@/lib/note-todos";
import { parkedNoteTag } from "@/lib/planner-day";
import { record } from "@/lib/client-history";
import { NoteTodoCheck } from "./note-todo-board";
type Line = { text:string; box:boolean; done?:boolean; size?:number; bold?:boolean; italic?:boolean; color?:string; taskId?:string; runs?:NoteRun[] };
const prefix="lifemap-lines:v1\n";
const blank=(text="",box=false):Line=>({text,box});
export function readNoteLines(value:string):Line[] {
  if(value.startsWith(prefix)) { try { const data=JSON.parse(value.slice(prefix.length)); if(Array.isArray(data)&&data.length&&data.every((l)=>l && typeof l.text==="string")) return data; } catch {} }
  return value.split(/\r?\n/).map((text)=>blank(text));
}
export function legacyNoteTodoId(noteDate:string,index:number){
  return `note-checkbox:${noteDate}:${index}`;
}
export function withoutLegacyNoteTodos(value:string,noteDate:string,ids:string[]){
  const remaining=readNoteLines(value).filter((line,index)=>!line.box || line.taskId || !ids.includes(legacyNoteTodoId(noteDate,index)));
  return prefix+JSON.stringify(remaining.length?remaining:[blank()]);
}
function LegacyTodoLine({id,line,noteDate,index,onToggle,onMove}:{id:string;line:Line;noteDate:string;index:number;onToggle:()=>void;onMove:(index:number)=>void}){
  const drag=useDraggable({id,data:{legacyTodo:{id,noteDate,index,title:line.text,done:!!line.done}}});
  const drop=useDroppable({id:`drop:${id}`,data:{kind:"legacy-note-row",noteDate,index,onMove,priority:true}});
  return <div ref={drop.setNodeRef} data-task-id={id} className={`note-todo-row legacy-note-todo${drop.isOver?" note-todo-over":""}`}>
    <button type="button" ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners} aria-pressed={!!line.done}
      style={{opacity:drag.isDragging?.35:1}} onClick={onToggle}><NoteTodoCheck done={!!line.done}/>
      <span className={line.done?"note-todo-done":undefined}>{line.text}</span>
    </button>
  </div>;
}
export function noteWithTasks(value:string,todos:Todo[],titled=false) {
  const lines=readNoteLines(value).filter((line,index)=>(titled && index===0) || line.text || line.taskId);
  const next=prefix+JSON.stringify([...lines,...todos.filter((todo)=>!lines.some((line)=>line.taskId===todo.id)).map((todo)=>({text:todo.title,box:false,taskId:todo.id}))]);
  if(next.length>10000)throw new Error("Die Notiz ist voll.");return next;
}
export default function PlannerNotepad({ value, onChange, onBlur, label, autoFocus=false, compact=false, onStep, noteDate, actions, tasks, onTaskOpen, todoPanel, preferences, titled=false, focusTitle=false }: { value: string; onChange: (value: string) => void; onBlur: () => unknown; label: string; autoFocus?:boolean; compact?:boolean; onStep?:(direction:number)=>void; noteDate?:string; actions?:React.ReactNode; tasks?:Todo[]; onTaskOpen?:(id:string)=>void; todoPanel?:React.ReactNode; preferences?:NotePreferences; titled?:boolean; focusTitle?:boolean }) {
  const latest = useRef(value); latest.current = value;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu,setMenu] = useState<number|null>(null);
  const [todoWidth,setTodoWidth]=useState(57);
  const widthRef=useRef(57);
  const split=useRef<HTMLDivElement>(null);
  const resize=useRef<{pointer:number;x:number;width:number}|null>(null);
  useEffect(()=>{
    if(!todoPanel)return;
    const restore=()=>{
      const width=Number(localStorage.getItem("lifemap-note-todo-width"));
      if(width>=28 && width<=76)changeTodoWidth(width);
    };
    restore();
    window.addEventListener("lifemap-note-width",restore);
    return ()=>window.removeEventListener("lifemap-note-width",restore);
  },[Boolean(todoPanel)]);
  function changeTodoWidth(width:number){
    const next=Math.round(Math.max(28,Math.min(76,width)));
    widthRef.current=next;
    setTodoWidth(next);
    return next;
  }
  function saveWidth(before:number,next:number){
    if(before===next)return;
    const apply=async(width:number)=>{
      localStorage.setItem("lifemap-note-todo-width",String(width));
      window.dispatchEvent(new Event("lifemap-note-width"));
    };
    void apply(next);
    record({undo:()=>apply(before),redo:()=>apply(next)});
  }
  const dropId=useId();
  const drop=useDroppable({id:`notepad:${dropId}`,disabled:!noteDate,data:{kind:"note-storage",date:noteDate,value,save:async(content:string)=>{onChange(content);if(await onBlur()===false)throw new Error("Notiz konnte nicht gespeichert werden.");}}});
  const formatRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(menu===null)return;
    const dismiss=(e:PointerEvent)=>{if(e.target instanceof Node && !formatRef.current?.contains(e.target))setMenu(null);};
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")setMenu(null);};
    document.addEventListener("pointerdown",dismiss,true);document.addEventListener("keydown",escape,true);
    return ()=>{document.removeEventListener("pointerdown",dismiss,true);document.removeEventListener("keydown",escape,true);};
  },[menu]);
  const fields=useRef<(HTMLTextAreaElement|null)[]>([]);
  const lines=readNoteLines(value);
  if(lines.every((line)=>line.taskId || (todoPanel && line.box)))lines.push(blank());
  if(titled && lines.length===1)lines.push(blank());
  function commit(next:Line[]) { const serialized=prefix+JSON.stringify(next); if(serialized.length>10000) {setError("Die Notiz ist voll.");return;} setError("");onChange(serialized); }
  function patch(i:number, update:Partial<Line>) { commit(lines.map((l,j)=>i===j?{...l,...update}:l)); }
  function insert(i:number, before:string, after:string) { commit([...lines.slice(0,i),{...lines[i],text:before},blank(after,lines[i].box),...lines.slice(i+1)]); requestAnimationFrame(()=>{fields.current[i+1]?.focus();fields.current[i+1]?.setSelectionRange(0,0);}); }
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("parentId", ""); files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/storage", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const links = result.added.map((id: string) => { const item = result.items.find((item: { id: string }) => item.id === id); return `[${item?.name || "Datei"}](/api/storage?file=${encodeURIComponent(id)})`; });
      commit([...readNoteLines(latest.current), ...links.map((link:string)=>blank(link))]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const attachments = Array.from(lines.map((l)=>l.text).join("\n").matchAll(/\[([^\]]+)\]\((\/api\/storage\?file=[a-zA-Z0-9%-]+)\)/g));
  const renderLine=(line:Line,i:number)=>{
        if(titled && i===0)return <input key={i} className="notebook-title" aria-label="Notiztitel" placeholder="Titel" maxLength={150} value={line.text} onBlur={onBlur}
          ref={focusTitle?(element)=>{if(element && !element.dataset.titleReady){element.dataset.titleReady="true";element.focus();element.select();}}:undefined}
          onChange={(event)=>patch(0,{text:event.target.value})} onKeyDown={(event)=>{
            if(event.key==="Enter" && !event.nativeEvent.isComposing){
              event.preventDefault();
              event.currentTarget.parentElement?.querySelector<HTMLElement>(".rich-note-field")?.focus();
            }
          }}/>;
        if(line.taskId && tasks && onTaskOpen){
          const todo=tasks.find((item)=>item.id===line.taskId && item.tags.includes("stored") && noteDate && item.tags.includes(parkedNoteTag(noteDate)));
          return todo ? <div key={todo.id} data-note-task={todo.id}><PeriodTask todo={todo} compact onOpen={onTaskOpen}/></div> : null;
        }
        if(preferences && !line.box && !line.taskId)return <RichNoteLine key={i} text={line.text}
          runs={line.runs || ((line.size || line.bold || line.italic || line.color) ? [{text:line.text,size:line.size,bold:line.bold,italic:line.italic,color:line.color}] : undefined)}
          label={`${label}, Zeile ${i+1}`} preferences={preferences} autoFocus={autoFocus && i===0} compact={compact}
          onChange={(text,runs)=>patch(i,{text,runs})} onBlur={onBlur} onFiles={(files)=>void upload(files)}/>;
        const legacyId=todoPanel && noteDate && line.box ? legacyNoteTodoId(noteDate,i) : undefined;
        if(legacyId && noteDate)return <LegacyTodoLine key={i} id={legacyId} line={line} noteDate={noteDate} index={i}
          onToggle={()=>patch(i,{done:!line.done})}
          onMove={(from)=>{
            if(from===i || !lines[from]?.box)return;
            const next=[...lines];
            next.splice(i,0,...next.splice(from,1));
            commit(next);
          }}/>;
        return <div className="note-line" key={i} onContextMenu={(e)=>{e.preventDefault();e.stopPropagation();setMenu(menu===i?null:i);}}>
        {line.box && <input type="checkbox" aria-label={`Zeile ${i+1} abhaken`} checked={!!line.done} onChange={(e)=>patch(i,{done:e.target.checked})} onKeyDown={(e)=>{if(e.key==="Backspace"){e.preventDefault();e.stopPropagation();patch(i,{box:false,done:false});fields.current[i]?.focus();}}}/>}
        <textarea autoFocus={autoFocus && i===0} ref={(el)=>{fields.current[i]=el;}} rows={1} aria-label={`${label}, Zeile ${i+1}`} value={line.text} placeholder={!line.text && (i===0 || todoPanel) ? (line.box?"To-do hinzufügen …":"Notiz schreiben …") : ""} onBlur={onBlur}
          style={{fontSize:line.size||(compact?11:14),fontWeight:line.bold?700:400,fontStyle:line.italic?"italic":"normal",color:line.color,textDecoration:line.done?"line-through":"none"}}
          onChange={(e)=>patch(i,{text:e.target.value})} onKeyDown={(e)=>{if(e.nativeEvent.isComposing)return; const el=e.currentTarget;
            if(e.key==="Enter" && !e.shiftKey){e.preventDefault();e.stopPropagation();insert(i,line.text.slice(0,el.selectionStart),line.text.slice(el.selectionEnd));}
            if(e.key==="Backspace" && line.box && el.selectionStart===0 && el.selectionEnd===0){e.preventDefault();e.stopPropagation();patch(i,{box:false,done:false});return;}
            if(e.key==="Backspace" && !line.text && i>0){e.preventDefault();e.stopPropagation();commit(lines.filter((_,j)=>i!==j));requestAnimationFrame(()=>fields.current[i-1]?.focus());}
          }} onPaste={(e)=>{if(e.clipboardData.files.length){e.preventDefault();void upload(Array.from(e.clipboardData.files));return;} const text=e.clipboardData.getData("text");if(!/\r?\n/.test(text))return;e.preventDefault();const el=e.currentTarget;const pasted=text.split(/\r?\n/);commit([...lines.slice(0,i),{...line,text:line.text.slice(0,el.selectionStart)+pasted[0]},...pasted.slice(1).map((t,j)=>blank(t+(j===pasted.length-2?line.text.slice(el.selectionEnd):""),line.box)),...lines.slice(i+1)]);}} />
        {menu===i && <div ref={formatRef} className="note-format selection-toolbar" aria-label="Zeile formatieren">
          <label>Größe <select value={line.size||14} onChange={(e)=>patch(i,{size:Number(e.target.value)})}>{[12,14,16,20,24,30].map((n)=><option key={n}>{n}</option>)}</select></label>
          <button type="button" aria-pressed={!!line.bold} onClick={()=>patch(i,{bold:!line.bold})}>Fett</button>
          <button type="button" aria-pressed={!!line.italic} onClick={()=>patch(i,{italic:!line.italic})}>Kursiv</button>
          <label>Farbe <input type="color" value={line.color||"#28392f"} onChange={(e)=>patch(i,{color:e.target.value})}/></label>
          <button type="button" onClick={()=>patch(i,{box:!line.box,done:false})}>{line.box?"Kästchen entfernen":"Kästchen einfügen"}</button>
          <button type="button" onClick={()=>setMenu(null)}>Schließen</button>
        </div>}
      </div>;
  };
  return <div className={`planner-notepad ${compact?"compact-notepad":""}`} onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }} onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); } }}>
    <div className="notepad-content">
    <div ref={(element)=>{split.current=element;drop.setNodeRef(element);}} className={`note-checklist ${drop.isOver ? "storage-over" : ""} ${todoPanel?"note-split":""}`} aria-label={label}
      style={todoPanel?{"--note-todo-width":`${todoWidth}%`} as React.CSSProperties:undefined}>
      {onStep && <div className="note-period-arrows"><button type="button" aria-label="Vorherige Notiz" onClick={()=>onStep(-1)}><ChevronLeft size={15}/></button><button type="button" aria-label="Nächste Notiz" onClick={()=>onStep(1)}><ChevronRight size={15}/></button></div>}
      {todoPanel ? <>
        <div className="note-text-column" onClick={(event)=>{
          if(event.target!==event.currentTarget)return;
          const fields=event.currentTarget.querySelectorAll<HTMLElement>(".rich-note-field");
          const field=fields[fields.length-1];
          if(!field)return;
          field.focus();
          const range=document.createRange();
          range.selectNodeContents(field);range.collapse(false);
          const selection=window.getSelection();
          selection?.removeAllRanges();selection?.addRange(range);
        }}>{lines.map((line,index)=>!line.box || line.taskId ? renderLine(line,index) : null)}</div>
        <div className="note-splitter" tabIndex={0} role="separator" aria-label="Breite der To-do-Liste" aria-orientation="vertical" aria-valuemin={28} aria-valuemax={76} aria-valuenow={todoWidth}
          onPointerDown={(event)=>{
            if(event.button!==0)return;
            event.preventDefault();
            resize.current={pointer:event.pointerId,x:event.clientX,width:todoWidth};
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event)=>{
            const drag=resize.current,width=split.current?.clientWidth;
            if(drag?.pointer===event.pointerId && width)changeTodoWidth(drag.width+(drag.x-event.clientX)*100/width);
          }}
          onLostPointerCapture={()=>{
            if(resize.current)saveWidth(resize.current.width,widthRef.current);
            resize.current=null;
          }}
          onKeyDown={(event)=>{
            if(!["ArrowLeft","ArrowRight"].includes(event.key))return;
            event.preventDefault();
            const next=changeTodoWidth(todoWidth+(event.key==="ArrowLeft"?3:-3));
            saveWidth(todoWidth,next);
          }}/>
        <section className="note-todo-column">
          {todoPanel}
          {lines.map((line,index)=>line.box && !line.taskId && (line.text || line.done) ? renderLine(line,index) : null)}
        </section>
      </> : lines.map(renderLine)}

    </div>
    <div className="note-attachments">{attachments.map((match,index) => <a key={index} href={match[2]} target="_blank" rel="noreferrer">{ /\.(png|jpe?g|gif|webp)$/i.test(match[1]) ? <img src={match[2]} alt={match[1]} /> : match[1]}</a>)}</div>
    </div>
    {(actions || !compact) && <div className="note-actions">
      {!compact && <label className="note-upload"><Paperclip size={14} /> Datei oder Bild anhängen<input aria-label="Datei oder Bild anhängen" type="file" multiple onChange={(e) => { void upload(Array.from(e.target.files || [])); e.target.value = ""; }} /></label>}
      {actions}
    </div>}
    {busy && <p role="status">Wird gespeichert …</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
