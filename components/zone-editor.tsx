"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toMinutes, toTime } from "@/lib/schedule";
import { type CalendarZone, type ZoneRepeat } from "@/lib/calendar-zones";
import { baseLifeTabs, lifeTabs } from "@/lib/life-tabs";
import { addDays, dateKey, monday, parseDate } from "@/lib/dates";
import { RepeatPicker, RepeatDays, RepeatWeeks } from "./repeat-picker";
import TimeInput from "./time-input";

export default function ZoneEditor({ zone, existing, onSave, onDelete, onClose }: {
  zone: CalendarZone; existing: boolean;
  onSave: (zone:CalendarZone)=>Promise<void>; onDelete:()=>Promise<void>; onClose:()=>void;
}) {
  const [draft,setDraft]=useState(zone);
  const [tabs,setTabs]=useState<string[][]>(baseLifeTabs);
  const [busy,setBusy]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [error,setError]=useState("");
  const first=zone.days[0];
  const weekStart=monday(parseDate(first));
  const weekday=(day:string)=>(parseDate(day).getDay()+6)%7;
  const matchingWeeks=[4,8,12,26,52].find((weeks)=>dateKey(addDays(parseDate(first),weeks*7-1))===draft.until) || (draft.until?0:8);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/life",{signal:controller.signal}).then(async(response)=>{
      if(response.ok)setTabs(lifeTabs(await response.json()));
    }).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  async function submit(remove=false, zone=draft) {
    setBusy(true);setError("");
    try { if(remove)await onDelete();else await onSave(zone);onClose(); }
    catch(error){setError((error as Error).message);} finally {setBusy(false);}
  }
  return <div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget && !busy)onClose();}}>
    <section className="modal zone-editor" role="dialog" aria-modal="true" aria-label={existing?"Zone bearbeiten":"Neue Zone"}>
      <div className="modal-heading"><h2>{existing?"Zone bearbeiten":"Neue Zone"}</h2><button type="button" data-close aria-label="Schließen" onClick={onClose}><X size={18}/></button></div>
      <p>{draft.days.map((day)=>new Date(`${day}T12:00`).toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"numeric"})).join(", ")} · {toTime(draft.start)}–{draft.end===1440?"24:00":toTime(draft.end)}</p>
      <form onSubmit={(event)=>{event.preventDefault();void submit();}}>
        <label>Name <input required autoFocus maxLength={100} placeholder="z. B. Lernzeit" value={draft.name} onChange={(event)=>setDraft({...draft,name:event.target.value})}/></label>
        <label>Farbe <input type="color" value={draft.color} onChange={(event)=>setDraft({...draft,color:event.target.value})}/></label>
        <label><input type="checkbox" checked={draft.outline} onChange={(event)=>setDraft({...draft,outline:event.target.checked})}/> Nur gestrichelter Rand</label>
        <RepeatPicker legend="Wöchentlich wiederholen">
          <label>Uhrzeit <TimeInput label="Uhrzeit der Wiederholungen" value={toTime(draft.start)} onChange={(time)=>{
            const duration=draft.end-draft.start;
            const start=Math.max(0,Math.min(1440-duration,toMinutes(time)));
            if(Number.isFinite(start))setDraft({...draft,start,end:start+duration});
          }}/></label>
          <RepeatDays selected={draft.days.map(weekday)} onChange={(days)=>{
            if(!days.length)return;
            const selected=days.map((index)=>{
              const existing=draft.days.find((day)=>weekday(day)===index);
              const next=dateKey(addDays(weekStart,index));
              return existing || (next<first?dateKey(addDays(weekStart,index+7)):next);
            }).sort();
            setDraft({...draft,repeat:"weekly",days:selected,until:draft.until && draft.until<selected.at(-1)!?"":draft.until});
          }}/>
          <div className="zone-repeat-controls">
            <RepeatWeeks value={matchingWeeks} custom onChange={(weeks)=>setDraft({...draft,repeat:"weekly",until:weeks?dateKey(addDays(parseDate(first),weeks*7-1)):""})}/>
            <button type="button" className="secondary-button" disabled={busy || !draft.name.trim()} onClick={()=>void submit(false,{
              ...draft,repeat:"weekly",until:draft.until || dateKey(addDays(parseDate(first),matchingWeeks*7-1)),
            })}>Wiederholungen anlegen</button>
          </div>
          <details><summary>Weitere Rhythmen</summary>
            <label>Rhythmus <select value={draft.repeat} onChange={(event)=>{const repeat=event.target.value as ZoneRepeat;setDraft({...draft,repeat,until:repeat==="none"?"":draft.until});}}>
              <option value="none">Einmalig</option><option value="daily">Täglich</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option>
            </select></label>
            {draft.repeat!=="none" && <label>Wiederholen bis <input type="date" min={draft.days.at(-1)} value={draft.until} onChange={(event)=>setDraft({...draft,until:event.target.value})}/></label>}
          </details>
        </RepeatPicker>
        <fieldset><legend>Reiter für Auto planen</legend>
          {tabs.filter(([id])=>!["todo","weather"].includes(id)).map(([id,label])=><label key={id}><input type="checkbox" checked={draft.categories.includes(id)}
            onChange={(event)=>setDraft({...draft,categories:event.target.checked?[...draft.categories,id]:draft.categories.filter((category)=>category!==id)})}/>{label}</label>)}
        </fieldset>
        <div className="zone-editor-actions">
          <button type="submit" disabled={busy}>Zone speichern</button>
          {existing && <button type="button" disabled={busy} onClick={()=>confirmDelete?void submit(true):setConfirmDelete(true)}>{confirmDelete?"Alle Vorkommen löschen":"Zone löschen"}</button>}
        </div>
        {error && <small role="alert">{error}</small>}
      </form>
    </section>
  </div>;
}
