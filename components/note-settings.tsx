"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useDialog } from "./use-dialog";
import { defaultNotePreferences, noteFonts, noteFontCss, notePeriods, notePeriodNames, type NoteFont, type NotePreferences } from "@/lib/note-todos";

export default function NoteSettings({value,onSave,onClose}:{value:NotePreferences;onSave:(value:NotePreferences)=>void;onClose:()=>void}){
  const [draft,setDraft]=useState(value);
  useDialog(true,"notepad-settings");
  return <div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="modal note-settings" role="dialog" aria-modal="true" aria-label="Notizfeld-Einstellungen">
      <div className="modal-heading"><h2>Notizfeld</h2><button type="button" data-close aria-label="Schließen" onClick={onClose}><X size={18}/></button></div>
      <form onSubmit={(event)=>{event.preventDefault();onSave(draft);}}>
        <label>Oberkante im Kalender <select value={draft.height} onChange={(event)=>setDraft({...draft,height:Number(event.target.value)})}>
          {Array.from({length:12},(_,i)=>i+8).map((hour)=><option key={hour} value={hour}>{hour}:00</option>)}
        </select></label>
        <label>Standardschrift <select value={draft.font} onChange={(event)=>setDraft({...draft,font:event.target.value as NoteFont})}>
          {Object.entries(noteFonts).map(([id,name])=><option key={id} value={id} style={{fontFamily:noteFontCss[id as NoteFont]}}>{name}</option>)}
        </select></label>
        <label>Schriftgröße <select value={draft.size} onChange={(event)=>setDraft({...draft,size:Number(event.target.value)})}>
          {[12,14,16,18,20,24].map((size)=><option key={size}>{size}</option>)}
        </select></label>
        <fieldset><legend>Spalten der To-do-Liste</legend>{notePeriods.map((period)=><label key={period}>
          <input type="checkbox" checked={draft.columns.includes(period)}
            disabled={draft.columns.length===1 && draft.columns.includes(period)}
            onChange={(event)=>setDraft({...draft,columns:notePeriods.filter((item)=>item===period?event.target.checked:draft.columns.includes(item))})}/>
          {notePeriodNames[period]}
        </label>)}</fieldset>
        <div className="note-settings-actions"><button type="submit">Speichern</button>
          <button type="button" onClick={()=>setDraft(defaultNotePreferences)}>Standardwerte</button></div>
      </form>
    </section>
  </div>;
}
