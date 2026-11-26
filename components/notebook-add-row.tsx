"use client";

import { useRef, useState } from "react";
import { useDialog } from "./use-dialog";

export default function NotebookAddRow({onSave,onClose}:{
  onSave:(name:string,all:boolean)=>void;onClose:()=>void;
}) {
  const [all,setAll]=useState(false);
  const [name,setName]=useState("");
  const options=useRef<(HTMLButtonElement|null)[]>([]);
  useDialog(true,"notebook-add-row");
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <form className="modal notebook-add-row-dialog" role="dialog" aria-modal="true" aria-label="Zeile hinzufügen"
      onSubmit={event=>{event.preventDefault();onSave(name.trim(),all);}}
      onKeyDown={event=>{
        if(event.key==="Escape"){event.stopPropagation();onClose();}
        if(event.key==="ArrowUp" || event.key==="ArrowDown"){
          event.preventDefault();
          const next=event.key==="ArrowDown";
          setAll(next);options.current[next?1:0]?.focus();
        }
      }}>
      <h2>Zeile hinzufügen</h2>
      <input aria-label="Zeilenname" placeholder="Zeilenname (optional)" value={name} maxLength={120} onChange={event=>setName(event.target.value)}/>
      <div className="notebook-row-scope">
        {[false,true].map((scope,index)=><button key={String(scope)} ref={node=>{options.current[index]=node;}}
          type="submit" data-initial-focus={!scope || undefined} aria-pressed={all===scope}
          onFocus={()=>setAll(scope)} onClick={event=>{event.preventDefault();onSave(name.trim(),scope);}}>
          {scope?"Alle Spalten":"Nur diese Spalte"}
        </button>)}
      </div>
    </form>
  </div>;
}
