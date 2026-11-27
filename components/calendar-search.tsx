"use client";

import { ArrowUpRight, Flag, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { dateKey, parseDate } from "@/lib/dates";
import { taskDay } from "@/lib/planner-day";
import { eventFlag, taskPriority } from "@/lib/task-colors";
import type { CalendarConnection, CalendarEvent, Todo } from "@/lib/types";

export type CalendarSearchResult = {
  id: string;
  title: string;
  day: string | null;
  time: string;
  calendar: string;
  searchable: string;
  high: boolean;
  event?: CalendarEvent;
};

const normalize = (text: string) =>
  text.toLocaleLowerCase("de").normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");

export default function CalendarSearch({inputRef, query, onQuery, important, onImportant, todos, events, connections, onOpen}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQuery: (query: string) => void;
  important: boolean;
  onImportant: (active: boolean) => void;
  todos: Todo[];
  events: CalendarEvent[];
  connections: CalendarConnection[];
  onOpen: (result: CalendarSearchResult) => void;
}) {
  const [open,setOpen]=useState(false);
  const [index,setIndex]=useState(-1);
  const root=useRef<HTMLDivElement>(null);
  const dateLabel=(day:string|null)=>day ? parseDate(day).toLocaleDateString("de-DE") : "Ohne Datum";
  const results=useMemo(()=>{
    const names=new Map(connections.map(calendar=>[calendar.id,calendar.name]));
    const entries:CalendarSearchResult[]=[
      ...todos.map(todo=>({
        id:todo.id,title:todo.title,day:taskDay(todo),time:todo.time,calendar:"LifeMap",
        searchable:[todo.description,todo.notes,todo.location,...todo.tags].filter(Boolean).join(" "),
        high:taskPriority(todo)==="high",
      })),
      ...events.map(event=>{
        const timestamp=new Date(event.start);
        return {
          id:event.id,title:event.title,day:event.allDay ? event.start.slice(0,10) : dateKey(timestamp),
          time:event.allDay ? "" : timestamp.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}),
          calendar:names.get(event.connectionId) ?? "Importierter Kalender",
          searchable:[event.originalTitle,event.location,event.description].filter(Boolean).join(" "),
          high:eventFlag(event)==="red",event,
        };
      }),
    ];
    const needle=normalize(query.trim());
    const terms=needle.split(/\s+/).filter(Boolean);
    const today=dateKey(new Date());
    const order=(entry:CalendarSearchResult)=>entry.day ? Number(entry.day<today) : 2;
    const matches=entries.filter(entry=>{
      if(important && !entry.high)return false;
      const text=normalize([entry.title,entry.searchable,entry.calendar,dateLabel(entry.day),entry.day,entry.time].join(" "));
      return terms.every(term=>text.includes(term));
    }).sort((a,b)=>
      Number(normalize(b.title).startsWith(needle))-Number(normalize(a.title).startsWith(needle)) ||
      order(a)-order(b) ||
      (order(a)===1 ? (b.day || "").localeCompare(a.day || "") : (a.day || "").localeCompare(b.day || "")) ||
      a.time.localeCompare(b.time) || a.title.localeCompare(b.title,"de"),
    );
    return important || terms.length ? matches : matches.slice(0,8);
  },[todos,events,connections,query,important]);
  const close=()=>{setOpen(false);setIndex(-1);};
  const choose=(row:CalendarSearchResult)=>{close();inputRef.current?.blur();onOpen(row);};

  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{
      if(!root.current?.contains(event.target as Node)){close();onImportant(false);}
    };
    document.addEventListener("pointerdown",dismiss);
    return()=>document.removeEventListener("pointerdown",dismiss);
  },[open,onImportant]);
  useEffect(()=>{
    if(index>=0)document.getElementById(`calendar-result-${index}`)?.scrollIntoView({block:"nearest"});
  },[index]);
  return <div className="calendar-search" ref={root}>
    <div className="search-field">
      <Search size={15}/>
      <input ref={inputRef} role="combobox" aria-label="Aufgaben und Termine suchen" placeholder="Aufgaben und Termine suchen …"
        value={query} aria-autocomplete="list" aria-expanded={open} aria-controls={open?"calendar-search-results":undefined}
        aria-activedescendant={open&&index>=0?`calendar-result-${index}`:undefined}
        onFocus={()=>setOpen(true)}
        onChange={event=>{onQuery(event.target.value);setOpen(true);setIndex(-1);}}
        onKeyDown={event=>{
          if(event.nativeEvent.isComposing)return;
          if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close();onQuery("");onImportant(false);event.currentTarget.blur();}
          if(["ArrowDown","ArrowUp"].includes(event.key) && results.length){
            event.preventDefault();event.stopPropagation();setOpen(true);
            setIndex(current=>current<0?(event.key==="ArrowDown"?0:results.length-1):(current+(event.key==="ArrowDown"?1:results.length-1))%results.length);
          }
          if(event.key==="Enter" && open && results.length){event.preventDefault();event.stopPropagation();choose(results[index] ?? results[0]);}
        }}/>
      {query && <button type="button" aria-label="Suche löschen" onClick={()=>{onQuery("");setIndex(-1);inputRef.current?.focus();}}><X size={13}/></button>}
    </div>
    <button type="button" className="today-button calendar-search-priority" aria-pressed={important}
      aria-label="Hoch priorisierte Aufgaben und Termine anzeigen" title="Hoch priorisierte Aufgaben und Termine"
      onClick={()=>{onImportant(!important);setIndex(-1);onQuery("");if(important)close();else{setOpen(true);inputRef.current?.focus();}}}><Flag size={15}/></button>
    {open && <div className="calendar-search-popover">
      <div className="calendar-search-caption">{important?"Hohe Priorität":query.trim()?"Suchergebnisse":"Vorschläge"}</div>
      <div className="calendar-search-results" id="calendar-search-results" role="listbox" aria-label="Kalender-Suchergebnisse">
        {results.map((result,i)=><button key={`${result.event?"event":"task"}:${result.id}`} type="button" role="option" tabIndex={-1}
          id={`calendar-result-${i}`} aria-selected={i===index} onPointerMove={()=>setIndex(i)} onClick={()=>choose(result)}>
          {result.high?<Flag size={15} className="calendar-search-red"/>:<Search size={14}/>}
          <span><strong>{result.title}</strong><small>{[dateLabel(result.day),result.time,result.calendar].filter(Boolean).join(" · ")}</small></span>
          <ArrowUpRight size={14}/>
        </button>)}
      </div>
      {!results.length && <p>Keine passenden Aufgaben oder Termine.</p>}
    </div>}
  </div>;
}
