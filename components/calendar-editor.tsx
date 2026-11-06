"use client";
import { useEffect, useState } from "react";
import type { CalendarConnection, CalendarEvent } from "@/lib/types";
import type { CalendarRule } from "@/lib/calendar/overrides";
import { useDialog } from "./use-dialog";
import { typeTitle } from "./type-title";
import CalendarGroups, { type EventType } from "./calendar-groups";

async function request(body:unknown) {
  const r=await fetch("/api/calendar-edit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result=await r.json();if(!r.ok)throw new Error(result.error || "Kalenderänderung fehlgeschlagen.");
}
export function CalendarOptions({connection,onRefresh,onClose}:{connection:Pick<CalendarConnection,"id"|"name"|"color">;onRefresh:()=>Promise<void>;onClose?:()=>void}) {
  const [rules,setRules]=useState<CalendarRule[]>([]), [open,setOpen]=useState(!!onClose), [name,setName]=useState(connection.name), [color,setColor]=useState(connection.color), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [types,setTypes]=useState<EventType[]>([]);
  async function read(){const r=await fetch(`/api/calendar-edit?id=${encodeURIComponent(connection.id)}`);if(!r.ok)throw new Error("Kalenderregeln konnten nicht geladen werden.");const data=await r.json();setRules(data.rules);setTypes(data.types);}
  useEffect(()=>{
    if(!open)return;
    const refresh=()=>void read().catch((e)=>setError(e.message));
    refresh();window.addEventListener("raum-data-changed",refresh);
    return ()=>window.removeEventListener("raum-data-changed",refresh);
  },[open,connection.id]);
  async function apply(body:object, closeAfter=false){setBusy(true);setError("");try{await request({id:connection.id,...body});await onRefresh();if(closeAfter && onClose)onClose();else await read();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const fields=<>
      <form onSubmit={(e)=>{e.preventDefault();if(!busy)void apply({action:color===connection.color?"rename-connection":"connection",name,color},true);}}><label>Name <input data-title-field value={name} required maxLength={80} onChange={(e)=>setName(e.target.value)}/></label><label>Farbe <input type="color" value={color} onChange={(e)=>setColor(e.target.value)}/></label><button disabled={busy}>Speichern</button></form>
      <CalendarGroups types={types} rules={rules} busy={busy}
        onGroup={(group,titles)=>void apply({action:"group-members",...group,titles})}
        onRule={(group,match)=>void apply({action:"group",...group,match})}
        onRemove={(rule)=>void apply({action:"remove",kind:rule.kind,key:rule.key})}
        onRestore={(rule)=>void apply({action:"restore",kind:rule.kind,key:rule.key})}/>
      {error && <small role="alert">{error}</small>}
    </>;
  if(onClose)return <div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget && !busy)onClose();}}>
    <section className="modal calendar-options" role="dialog" aria-modal="true" aria-label="Kalendereinstellungen" tabIndex={-1} data-initial-focus data-type-title="settings"
      onKeyDown={(event)=>{
        if(typeTitle(event,setName))return;
        if(event.target===event.currentTarget && event.key==="Enter" && !event.repeat){event.preventDefault();event.currentTarget.querySelector("form")?.requestSubmit();}
      }}>
      <div className="modal-heading"><h2>Kalendereinstellungen</h2><button type="button" data-close aria-label="Schließen" onClick={onClose}>×</button></div>
      {fields}
    </section>
  </div>;
  return <details className="calendar-options" onToggle={(event)=>setOpen(event.currentTarget.open)}><summary>Kalender bearbeiten</summary>{open && fields}</details>;
}

export function CalendarEventEditor({event,connection,onClose,onRefresh,deleteOnly=false,matchingTitle=false}:{event:CalendarEvent;connection?:CalendarConnection;onClose:()=>void;onRefresh:()=>Promise<void>;deleteOnly?:boolean;matchingTitle?:boolean}) {
  const [title,setTitle]=useState(event.title), [color,setColor]=useState(event.color||connection?.color||"#557caa"), [scope,setScope]=useState("event"), [deleting,setDeleting]=useState(deleteOnly), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [deleteScope,setDeleteScope]=useState<"event"|"series"|"title">("event");
  const relatedScope=event.seriesId?"series":matchingTitle?"title":null;
  useDialog(true,`imported:${event.id}`);
  async function apply(hidden:boolean,target=scope){setBusy(true);setError("");try{await request({action:"event",id:event.connectionId,eventId:event.id,title,color,scope:target,hidden});await onRefresh();onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget && !busy)onClose();}}><section className="modal calendar-event-editor" role="dialog" aria-modal="true" aria-label="Importierten Termin bearbeiten" tabIndex={-1} data-initial-focus={deleting?undefined:true} data-type-title="event" onKeyDown={(e)=>{
    if(!deleting && typeTitle(e,setTitle))return;
    if(e.target===e.currentTarget && e.key==="Enter" && !e.repeat){e.preventDefault();e.currentTarget.querySelector("form")?.requestSubmit();}
    if(e.key==="Escape"){e.stopPropagation();onClose();}
  }}>
    <div className="modal-heading"><h2>{deleting?"Termin entfernen":"Termin bearbeiten"}</h2><button type="button" data-close aria-label="Schließen" onClick={onClose}>×</button></div>
    {deleting && <p><strong>{event.title}</strong></p>}
    <p>{connection?.name} · {event.allDay ? event.start.slice(0,10) : new Date(event.start).toLocaleString("de-DE",{dateStyle:"medium",timeStyle:"short"})}</p>
    {event.location && <p>{event.location}</p>}
    {event.description && <p className="calendar-event-description">{event.description}</p>}
    {!deleting && <form onSubmit={(e)=>{e.preventDefault();void apply(false);}}>
      <label>Titel <input data-title-field required maxLength={300} value={title} onChange={(e)=>setTitle(e.target.value)}/></label>
      <label>Farbe <input type="color" value={color} onChange={(e)=>setColor(e.target.value)}/></label>
      {event.seriesId && <label>Änderung für <select value={scope} onChange={(e)=>setScope(e.target.value)}><option value="event">Diesen Termin</option><option value="series">Ganze Serie</option></select></label>}
      <button disabled={busy}>Speichern</button><button type="button" disabled={busy} onClick={()=>{setDeleteScope("event");setDeleting(true);}}>Aus Lifemap entfernen</button>
    </form>}
    {deleting && <form className="calendar-delete-choices" onSubmit={(event)=>{event.preventDefault();if(!busy)void apply(true,deleteScope);}}>
      {relatedScope && <fieldset disabled={busy}>
        <legend>Aus Lifemap entfernen</legend>
        {(["event",relatedScope] as const).map((option)=><label key={option}>
          <input type="radio" name="calendar-deletion-scope" value={option} checked={deleteScope===option}
            autoFocus={option==="event"} onChange={()=>setDeleteScope(option)}
            onKeyDown={(event)=>{if(event.key==="Enter" && !event.repeat){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/>
          <span>{option==="event"?"Nur diesen Termin":option==="series"?"Alle Termine dieser Serie":"Alle Termine mit diesem Titel in diesem Kalender"}</span>
        </label>)}
      </fieldset>}
      <button type="submit" disabled={busy} autoFocus={!relatedScope}>Entfernen</button>
      <button type="button" disabled={busy} onClick={()=>deleteOnly?onClose():setDeleting(false)}>Abbrechen</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section></div>;
}
