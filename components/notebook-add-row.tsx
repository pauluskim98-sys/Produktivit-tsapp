"use client";

import { useRef, useState } from "react";
import { useDialog } from "./use-dialog";

export default function NotebookAddRow({onSave,onClose,initialName}:{
  onSave:(name:string,all:boolean)=>void;onClose:()=>void;initialName?:string;
}) {
  const [all,setAll]=useState(false);
  const renaming=initialName!==undefined;
  const title=renaming?"Zeile benennen":"Zeile hinzufügen";
  const [name,setName]=useState(initialName ?? "");
  const options=useRef<(HTMLButtonElement|null)[]>([]);
  useDialog(true,"notebook-add-row");
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <form className="modal notebook-tab-settings notebook-add-row-dialog" role="dialog" aria-modal="true" aria-label={title}
      onSubmit={event=>{event.preventDefault();onSave(name.trim(),all);}}
      onKeyDown={event=>{
        if(event.key==="Escape"){event.stopPropagation();onClose();return;}
        if(!renaming && (event.key==="ArrowUp" || event.key==="ArrowDown")){
          event.preventDefault();
          const next=event.key==="ArrowDown";
          setAll(next);options.current[next?1:0]?.focus();
        }
      }}>
      <h2>{title}</h2>
      <label>Zeilenname<input data-initial-focus={renaming || undefined} placeholder="Optional" value={name} maxLength={120} onChange={event=>setName(event.target.value)}/></label>
      {renaming ? <div className="notebook-settings-actions"><button type="submit" className="primary-button">Speichern</button></div> : <div className="notebook-row-scope">
        {[false,true].map((scope,index)=><button key={String(scope)} ref={node=>{options.current[index]=node;}}
          type="submit" className="secondary-button" data-initial-focus={!scope || undefined} aria-pressed={all===scope}
          onFocus={()=>setAll(scope)} onClick={event=>{event.preventDefault();onSave(name.trim(),scope);}}>
          {scope?"Alle Spalten":"Nur diese Spalte"}
        </button>)}
      </div>}
    </form>
  </div>;
}
