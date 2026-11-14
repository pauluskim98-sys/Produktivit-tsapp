"use client";

import ColorSwatches from "@/components/color-swatches";
import { useRef, useState } from "react";
import type { CalendarRule } from "@/lib/calendar/overrides";
import { eventTitleKey } from "@/lib/calendar/overrides";

export type EventType = {title:string;count:number};
export default function CalendarGroups({types,rules,busy,onGroup,onRule,onRemove,onRestore}:{
  types:EventType[];rules:CalendarRule[];busy:boolean;
  onGroup:(group:{label:string;color:string},titles:string[])=>void;
  onRule:(group:{label:string;color:string},match:string)=>void;
  onRemove:(rule:CalendarRule)=>void;
  onRestore:(rule:CalendarRule)=>void;
}) {
  const [selected,setSelected]=useState<string[]>([]);
  const [lasso,setLasso]=useState(false);
  const [rect,setRect]=useState<{left:number;top:number;width:number;height:number}|null>(null);
  const start=useRef<{x:number;y:number;title?:string}|null>(null);
  const dragTitles=useRef<string[]>([]);
  const [name,setName]=useState("");
  const [shade,setShade]=useState("#557caa");
  const [filter,setFilter]=useState("");
  const [pattern,setPattern]=useState("");
  const match=eventTitleKey(pattern);
  const search=eventTitleKey(filter);
  const visible=types.filter((type)=>eventTitleKey(type.title).includes(search));
  const groups=[...new Map(rules.filter((rule)=>rule.kind==="group" || rule.kind==="group-title")
    .map((rule)=>[rule.label,{label:rule.label,color:rule.color}])).values()];
  const toggle=(title:string)=>setSelected((items)=>items.includes(title)?items.filter((item)=>item!==title):[...items,title]);
  const bounds=(x:number,y:number)=>{
    const point=start.current!;
    return {left:Math.min(point.x,x),top:Math.min(point.y,y),width:Math.abs(point.x-x),height:Math.abs(point.y-y)};
  };
  function drop(event:React.DragEvent,group:{label:string;color:string}) {
    if(!dragTitles.current.length || busy || !group.label.trim())return;
    event.preventDefault();
    onGroup(group,dragTitles.current);
    dragTitles.current=[];
    setSelected([]);
  }
  return <section className="calendar-group-workspace" aria-label="Terminarten und Gruppen">
    <section className="calendar-type-list">
      <header><h3>Terminarten</h3><button type="button" aria-pressed={lasso} onClick={()=>setLasso(!lasso)}>Auswahl (A)</button></header>
      <label className="calendar-type-filter">Aufgaben und Termine suchen <input type="search" value={filter} onChange={(event)=>setFilter(event.target.value)} placeholder="Nach Titel suchen …"/></label>
      <div className={`calendar-types ${lasso?"is-selecting":""}`} tabIndex={0}
        onKeyDown={(event)=>{if(event.key.toLowerCase()==="a" && !event.ctrlKey && !event.metaKey && !event.altKey){event.preventDefault();event.stopPropagation();setLasso(!lasso);}}}
        onPointerDown={(event)=>{
          if(!lasso || event.button!==0)return;
          event.preventDefault();
          start.current={x:event.clientX,y:event.clientY,title:(event.target as Element).closest<HTMLElement>("[data-event-type]")?.dataset.eventType};
          event.currentTarget.setPointerCapture(event.pointerId);
          setRect(bounds(event.clientX,event.clientY));
        }}
        onPointerMove={(event)=>{if(start.current)setRect(bounds(event.clientX,event.clientY));}}
        onPointerUp={(event)=>{
          if(!start.current)return;
          const area=bounds(event.clientX,event.clientY);
          if(area.width<4 && area.height<4){if(start.current.title)toggle(start.current.title);}
          else setSelected([...event.currentTarget.querySelectorAll<HTMLElement>("[data-event-type]")].filter((item)=>{
            const b=item.getBoundingClientRect();
            return b.right>=area.left && b.left<=area.left+area.width && b.bottom>=area.top && b.top<=area.top+area.height;
          }).map((item)=>item.dataset.eventType!));
          start.current=null;setRect(null);setLasso(false);
        }}
        onPointerCancel={()=>{start.current=null;setRect(null);}}
      >
        {visible.map(({title,count})=><div key={title}><button type="button" data-event-type={title} draggable={!lasso} aria-pressed={selected.includes(title)}
          onClick={()=>toggle(title)}
          onDragStart={(event)=>{
            const items=selected.includes(title)?selected:[title];
            dragTitles.current=items;setSelected(items);
            event.dataTransfer.effectAllowed="move";
            event.dataTransfer.setData("text/plain",items.join("\n"));
          }}
          onDragEnd={()=>{dragTitles.current=[];}}
        ><span>{title}</span><small>{count}</small></button>
          {rules.filter((rule)=>!rule.kind.startsWith("group") && eventTitleKey(rule.label)===eventTitleKey(title)).map((rule)=>
            <div className="calendar-group-member" key={`${rule.kind}:${rule.key}`}><small>{rule.kind==="series"?"Serie":rule.kind==="title"?"Gleichnamige Termine":"Einzeltermin"}</small>
              <button type="button" disabled={busy} onClick={()=>rule.hidden?onRestore(rule):onRemove(rule)}>{rule.hidden?"Wieder einblenden":"Änderung entfernen"}</button></div>)}
        </div>)}
        {!visible.length && <p>Keine passenden Terminarten vorhanden.</p>}
      </div>
    </section>
    <section className="calendar-group-list">
      <h3>Gruppen</h3>
      <div className="calendar-group-new"
        onDragOver={(event)=>{if(name.trim() && dragTitles.current.length)event.preventDefault();}}
        onDrop={(event)=>drop(event,{label:name.trim(),color:shade})}>
        <label>Neue Gruppe <input value={name} onChange={(event)=>setName(event.target.value)} maxLength={100}/></label>
        <label>Titel enthält <input value={pattern} onChange={(event)=>setPattern(event.target.value)} placeholder="Optional, z. B. Vorlesung" maxLength={240}/></label>
        <label>Farbe <ColorSwatches name="calendar-groups-0" value={shade} onChange={(event)=>setShade(event.target.value)} /></label>
        <button type="button" disabled={busy || !name.trim() || !selected.length} onClick={()=>{onGroup({label:name.trim(),color:shade},selected);setSelected([]);}}>Auswahl zuordnen</button>
        {match && <button type="button" disabled={busy || !name.trim()} onClick={()=>onRule({label:name.trim(),color:shade},match)}>Passende Titel gruppieren</button>}
      </div>
      {groups.map((group)=><div className="calendar-group-target" key={group.label}
        onDragOver={(event)=>{if(dragTitles.current.length)event.preventDefault();}} onDrop={(event)=>drop(event,group)}>
        <strong><i style={{background:group.color}}/>{group.label}</strong>
        {rules.filter((rule)=>rule.label===group.label && rule.kind.startsWith("group")).map((rule)=><div className="calendar-group-member" key={`${rule.kind}:${rule.key}`}>
          <span>{rule.kind==="group"?`Titel enthält „${rule.key}“`:types.find((type)=>eventTitleKey(type.title)===rule.key)?.title || rule.key}</span>
          <button type="button" title="Aus Gruppe entfernen" aria-label="Aus Gruppe entfernen" disabled={busy} onClick={()=>onRemove(rule)}>×</button>
        </div>)}
        <button type="button" disabled={busy || !selected.length} onClick={()=>{onGroup(group,selected);setSelected([]);}}>Auswahl zuordnen</button>
      </div>)}
    </section>
    {rect && <div className="selection-rectangle" style={{position:"fixed",...rect}}/>}
  </section>;
}
