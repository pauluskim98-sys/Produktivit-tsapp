"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { addDays, dateKey, parseDate } from "@/lib/dates";
import { periodRange } from "@/lib/calendar-interactions";
import { moodColors, moodLabels, type NotebookLesson, type NotebookMood } from "@/lib/notebook-layout";
import type { NotePreferences } from "@/lib/note-todos";
import PlannerNotepad, { readNoteLines } from "./planner-notepad";
import { useAutosaveText } from "./use-autosave-text";
import { useDialog } from "./use-dialog";

type Bookmark = { id:string; date:string; title:string };
const dateLabel = (date:string) => parseDate(date).toLocaleDateString("de-DE");
const journalKey=(date:string)=>`journal:${date}`;

function JournalEditor({value,date,preferences,save}: {
  value:string;date:string;preferences:NotePreferences;save:(text:string)=>Promise<void>;
}) {
  const {text,setText,flush,error}=useAutosaveText(value,save,`lifemap-journal-draft:${date}`);
  return <>
    <PlannerNotepad value={text} onChange={setText} onBlur={flush} preferences={preferences}
      label={`Tagebuch am ${dateLabel(date)}`} compact/>
    {error && <p role="alert">{error}</p>}
  </>;
}

export default function NotebookJournal({date,notes,moods,lessons,weekdayNote,preferences,onDate,onClose,onSave,onOpenNote}:{
  date:string;notes:Record<string,string>;moods:Record<string,NotebookMood>;lessons:NotebookLesson[];
  weekdayNote?:{key:string;content:string};
  preferences:NotePreferences;onDate:(date:string)=>void;onClose:()=>void;
  onSave:(key:string,value:string)=>Promise<void>;onOpenNote:(key:string)=>void;
}) {
  const [query,setQuery]=useState("");
  const [section,setSection]=useState<"page"|"moods"|"lessons">("page");
  const [preview,setPreview]=useState<"week"|"month"|"year"|null>(null);
  const [bookmark,setBookmark]=useState<string|null>(null);
  const [menu,setMenu]=useState<string|null>(null);
  const [error,setError]=useState("");
  useDialog(true,"journal");
  const bookmarks=useMemo(()=>{
    try {
      const list=JSON.parse(notes["journal-bookmarks"]||"[]");
      return (Array.isArray(list)?list.filter(item=>item && typeof item.id==="string" && typeof item.title==="string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) && periodRange(item.date)):[]) as Bookmark[];
    } catch {return [];}
  },[notes]);
  const pages=useMemo(()=>Object.entries(notes).flatMap(([key,content])=>{
    if(!content || key==="journal-bookmarks" || key.startsWith("note-folder:"))return [];
    const lines=readNoteLines(content);
    const text=lines.flatMap(line=>[line.heading,line.text,line.mood?.reason,line.lesson?.text]).filter(Boolean).join(" ").trim();
    return text?[{key,date:key.match(/\d{4}-\d{2}-\d{2}$/)?.[0],text}]:[];
  }),[notes]);
  const search=query.trim().toLocaleLowerCase("de");
  const entries=search?pages.filter(page=>page.text.toLocaleLowerCase("de").includes(search)).slice(0,100):[];
  const selected=parseDate(date);
  const weekText=weekdayNote && readNoteLines(weekdayNote.content).map(line=>line.text).filter(Boolean).join("\n");
  const choose=(next:string)=>{onDate(next);setSection("page");setPreview(null);setQuery("");};
  const saveBookmarks=(next:Bookmark[])=>void onSave("journal-bookmarks",JSON.stringify(next)).catch(err=>setError(err.message));
  const shown=preview ? periodRange(`${preview}:${date}`) : null;
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="modal notebook-journal" role="dialog" aria-modal="true" aria-label="Tagebuch" data-escape-layer
      onClick={()=>setMenu(null)} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();if(preview)setPreview(null);else if(menu)setMenu(null);else onClose();}}}>
      <header className="journal-header">
        <BookOpen size={20}/><h2>Tagebuch</h2>
        <label className="journal-search"><Search size={15}/><input placeholder="Tagebuch durchsuchen" aria-label="Tagebuch durchsuchen" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <button type="button" data-close aria-label="Tagebuch schließen" onClick={onClose}><X size={18}/></button>
      </header>
      <div className="journal-body">
        <main className="journal-page">
          {search ? <div className="journal-results">
            {entries.map(entry=><button type="button" key={entry.key} onClick={()=>{
              if(entry.key.startsWith("journal:") && entry.date)choose(entry.date);
              else onOpenNote(entry.key);
            }}><strong>{entry.date?dateLabel(entry.date):"Notiz"}</strong><span>{entry.text.slice(0,180)}</span></button>)}
            {!entries.length && <p>Keine passenden Einträge.</p>}
          </div> : section==="moods" ? <div className="journal-results">
            {Object.values(moods).sort((a,b)=>b.date.localeCompare(a.date)).map(mood=>
              <button key={mood.date} type="button" onClick={()=>choose(mood.date)}>
                <strong style={{color:moodColors[mood.score]}}>{dateLabel(mood.date)} · {moodLabels[mood.score]}</strong><span>{mood.reason}</span>
              </button>)}
          </div> : section==="lessons" ? <div className="journal-results">
            {lessons.map((lesson,index)=><button key={`${lesson.date}:${index}`} type="button" onClick={()=>choose(lesson.date)}>
              <strong>{dateLabel(lesson.date)}</strong><span>{lesson.text}</span>
            </button>)}
          </div> : <>
            <div className="journal-date" onMouseLeave={()=>setPreview(null)}>
              <button type="button" aria-label="Vorheriger Tag" onClick={()=>choose(dateKey(addDays(selected,-1)))}><ChevronLeft size={16}/></button>
              {(["week","month","year"] as const).map((period,index)=>
                <button key={period} type="button" onMouseEnter={()=>setPreview(period)} onFocus={()=>setPreview(period)}
                  onClick={()=>setPreview(period)}>{index===0?selected.getDate()+".":index===1?selected.toLocaleDateString("de-DE",{month:"long"}):selected.getFullYear()}</button>)}
              <button type="button" aria-label="Nächster Tag" onClick={()=>choose(dateKey(addDays(selected,1)))}><ChevronRight size={16}/></button>
              {shown && <div className="journal-date-grid" data-period={preview}>
                {preview==="year" ? Array.from({length:12},(_,i)=>new Date(selected.getFullYear(),i,1)).map(month=>
                  <div key={dateKey(month)} className="journal-mini-month"><strong>{month.toLocaleDateString("de-DE",{month:"short"})}</strong>
                    {periodRange(`month:${dateKey(month)}`)?.days.map(day=><button key={day} type="button" title={dateLabel(day)} onClick={()=>choose(day)}>{Number(day.slice(-2))}</button>)}
                  </div>) : shown.days.map(day=><button key={day} type="button" aria-current={day===date?"date":undefined} onClick={()=>choose(day)}>
                    {preview==="week"?parseDate(day).toLocaleDateString("de-DE",{weekday:"short"})+" ":""}{Number(day.slice(-2))}
                  </button>)}
              </div>}
            </div>
            <JournalEditor key={date} value={notes[journalKey(date)]||""} date={date} preferences={preferences} save={text=>onSave(journalKey(date),text)}/>
            {weekText && weekdayNote && <button className="journal-source" type="button" onClick={()=>onOpenNote(weekdayNote.key)}>{weekText}</button>}
            {moods[date] && <p className="journal-day-mood" style={{color:moodColors[moods[date].score]}}>{moodLabels[moods[date].score]} · {moods[date].reason}</p>}
            {lessons.filter(lesson=>lesson.date===date).map((lesson,index)=><p className="journal-day-lesson" key={index}>{lesson.text}</p>)}
            {pages.filter(page=>page.date===date && page.key!==journalKey(date)).map(page=>
              <button className="journal-source" type="button" key={page.key} onClick={()=>onOpenNote(page.key)}>{page.text.slice(0,160)}</button>)}
          </>}
        </main>
        <aside className="journal-stickers" aria-label="Markiersticker">
          <button type="button" onClick={()=>{setSection("moods");setQuery("");}}>Moodtracker</button>
          <button type="button" onClick={()=>{setSection("lessons");setQuery("");}}>Lektionen</button>
          {bookmarks.map(item=><div key={item.id} className="journal-sticker">
            <button type="button" onClick={()=>choose(item.date)} onContextMenu={event=>{event.preventDefault();setMenu(item.id);}}>{item.title||dateLabel(item.date)}</button>
            {menu===item.id && <button type="button" role="menuitem" onClick={()=>saveBookmarks(bookmarks.filter(other=>other.id!==item.id))}>Sticker löschen</button>}
          </div>)}
          {bookmark===null?<button type="button" aria-label="Markiersticker hinzufügen" onClick={()=>setBookmark("")}><Plus size={16}/></button>:
            <form onSubmit={event=>{event.preventDefault();saveBookmarks([...bookmarks,{id:crypto.randomUUID(),date,title:bookmark.trim()}]);setBookmark(null);}}>
              <input autoFocus aria-label="Stickertitel" placeholder={dateLabel(date)} value={bookmark} maxLength={80} onChange={event=>setBookmark(event.target.value)}/>
              <button type="submit" aria-label="Sticker speichern">✓</button>
            </form>}
        </aside>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  </div>;
}
