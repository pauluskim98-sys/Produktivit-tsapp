"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight, GripVertical, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { addDays, dateKey, parseDate } from "@/lib/dates";
import { periodRange } from "@/lib/calendar-interactions";
import { moodColors, moodLabels, type NotebookLesson, type NotebookMood } from "@/lib/notebook-layout";
import type { NotePreferences } from "@/lib/note-todos";
import PlannerNotepad, { readNoteLines, serializeNoteLines } from "./planner-notepad";
import { useAutosaveText } from "./use-autosave-text";
import ColorSwatches from "./color-swatches";
import { journalFieldKey, journalFieldsFor, journalLayoutKey, journalMoodKey, journalPageKey, readJournalLayout, type JournalField } from "@/lib/journal-layout";
import NotebookMoodPicker from "./notebook-mood";
import { sliceNoteRuns } from "@/lib/note-format";

type Bookmark = { id:string; date:string; title:string; color?:string };
const stickerColors=["#f5da85","#f4b7ad","#c9e1bb","#b7d9f5","#d9c4ec"];
const blankSurface=(target:Element)=>target.matches(".notebook-journal,.journal-header,.journal-body,.journal-page,.journal-stickers,.journal-results");

const dateLabel = (date:string) => parseDate(date).toLocaleDateString("de-DE");


function JournalEditor({value,date,preferences,save,dateControls}: {
  value:string;date:string;preferences:NotePreferences;dateControls:ReactNode;save:(text:string)=>Promise<void>;
}) {
  const headedValue=useMemo(()=>{
    const [first,...rest]=readNoteLines(value);
    const newline=first.text.indexOf("\n");
    if(newline<0)return value;
    return serializeNoteLines([
      {text:first.text.slice(0,newline),box:false},
      {...first,text:first.text.slice(newline+1),runs:first.runs && sliceNoteRuns(first.runs,newline+1,first.text.length)},
      ...rest,
    ]);
  },[value]);
  const {text,setText,flush,error}=useAutosaveText(headedValue,save,`lifemap-journal-draft:${date}`);
  return <div className="journal-writing" onClick={event=>{
    const target=event.target as Element;
    if(target.closest("input,textarea,button,a,[contenteditable],[role=menu]"))return;
    const title=event.currentTarget.querySelector<HTMLInputElement>(".notebook-title");
    if(title && !title.value.trim()){title.focus();return;}
    const field=Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".rich-note-field")).at(-1);
    if(!field)return;
    field.focus();
    const caret=document.createRange();
    caret.selectNodeContents(field);
    caret.collapse(false);
    const selection=window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
  }}>
    <PlannerNotepad value={text} onChange={setText} onBlur={flush} preferences={{...preferences,size:preferences.size+3}}
      label={`Tagebuch am ${dateLabel(date)}`} compact titled titleTrailing={dateControls}/>
    {error && <p role="alert">{error}</p>}
  </div>;
}

function JournalFieldEditor({field,value,noteKey,onSave}:{
  field:JournalField;value:string;noteKey:string;onSave:(key:string,value:string)=>Promise<void>;
}) {
  const {text,setText,flush,error}=useAutosaveText(value,text=>onSave(noteKey,text),`lifemap-${noteKey}-draft`);
  return <label className="journal-custom-field">
    <strong>{field.title}</strong>
    <textarea rows={3} value={text} maxLength={10000} onChange={event=>setText(event.target.value)} onBlur={()=>void flush()}/>
    {error && <span role="alert">{error}</span>}
  </label>;
}

function JournalLayoutEditor({fields,onChange,onSave,busy}:{
  fields:JournalField[];onChange:(fields:JournalField[])=>void;
  onSave:(scope:"day"|"future")=>void;busy:boolean;
}) {
  const dragged=useRef<string|null>(null);
  const [drop,setDrop]=useState<string|null>(null);
  function move(id:string,index:number) {
    const field=fields.find(field=>field.id===id);
    if(!field)return;
    const next=fields.filter(field=>field.id!==id);
    next.splice(index,0,field);
    onChange(next);
  }
  return <section className="journal-layout-preview" aria-label="Vorschau für das Seitenlayout">
    <h3>Seitenlayout</h3>
    <div className="journal-layout-fixed"><strong>Stimmung</strong><span>Eintrag</span></div>
    {fields.map((field,index)=><div key={field.id} className="journal-layout-field" data-drop={drop===field.id}
      onDragOver={event=>{if(dragged.current && dragged.current!==field.id){event.preventDefault();setDrop(field.id);}}}
      onDrop={event=>{event.preventDefault();if(dragged.current)move(dragged.current,index);setDrop(null);dragged.current=null;}}>
      <div className="journal-layout-field-header">
        <span className="journal-field-grip" title="Feld ziehen" draggable onDragStart={event=>{
          dragged.current=field.id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",field.id);
        }} onDragEnd={()=>{dragged.current=null;setDrop(null);}}><GripVertical size={16}/></span>
        <input aria-label={`Name für Feld ${index+1}`} value={field.title} maxLength={80} placeholder="Feldname"
          onChange={event=>onChange(fields.map(item=>item.id===field.id ? {...item,title:event.target.value} : item))}/>
        <button type="button" aria-label="Feld nach oben" disabled={index===0} onClick={()=>move(field.id,index-1)}><ArrowUp size={14}/></button>
        <button type="button" aria-label="Feld nach unten" disabled={index===fields.length-1} onClick={()=>move(field.id,index+1)}><ArrowDown size={14}/></button>
        <button type="button" aria-label="Feld entfernen" onClick={()=>onChange(fields.filter(item=>item.id!==field.id))}><Trash2 size={14}/></button>
      </div>
      <div className="journal-layout-field-paper" aria-hidden="true"/>
    </div>)}
    <button className="secondary-button" type="button" disabled={fields.length>=30}
      onClick={()=>onChange([...fields,{id:crypto.randomUUID(),title:""}])}><Plus size={15}/> Feld hinzufügen</button>
    <div className="journal-layout-actions">
      <button className="secondary-button" type="button" disabled={busy} onClick={()=>onSave("day")}>Nur für diesen Tag</button>
      <button className="primary-button" type="button" disabled={busy} onClick={()=>onSave("future")}>Ab diesem Tag</button>
    </div>
  </section>;
}

export default function NotebookJournal({date,notes,moods,lessons,weekdayNote,preferences,onDate,onCalendarPeriod,onClose,onSave,onOpenNote,embedded=false}:{
  embedded?:boolean;
  date:string;notes:Record<string,string>;moods:Record<string,NotebookMood>;lessons:NotebookLesson[];
  weekdayNote?:{key:string;content:string};
  preferences:NotePreferences;onDate:(date:string)=>void;onClose:()=>void;
  onCalendarPeriod:(date:string,view:"week"|"month"|"year")=>void;
  onSave:(key:string,value:string)=>Promise<void>;onOpenNote:(key:string)=>void;
}) {
  const [query,setQuery]=useState("");
  const [section,setSection]=useState<"page"|"week"|"month"|"moods"|"lessons">("page");
  const [layoutDraft,setLayoutDraft]=useState<JournalField[]|null>(null);
  const [savingLayout,setSavingLayout]=useState(false);
  useEffect(()=>setLayoutDraft(null),[date]);
  const [preview,setPreview]=useState<"week"|"month"|"year"|null>(null);
  const [bookmark,setBookmark]=useState<string|null>(null);
  const [bookmarkColor,setBookmarkColor]=useState(stickerColors[0]);
  const [menu,setMenu]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [rename,setRename]=useState<string|null>(null);
  const [docked,setDocked]=useState(false);
  const [position,setPosition]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const drag=useRef<AbortController|null>(null);
  const dragging=useRef(false);
  const stickerForm=useRef<HTMLFormElement>(null);
  const skipBlankClick=useRef(false);
  const journal=useRef<HTMLElement>(null);
  const clickTimer=useRef<number|undefined>(undefined);
  useEffect(()=>{
    if(embedded)return;
    const calendarPointer=(event:PointerEvent)=>{
      if(!dragging.current && event.target instanceof Element && event.target.closest(".calendar-workspace"))setDocked(true);
    };
    document.addEventListener("pointerdown",calendarPointer,true);
    return ()=>{
      document.removeEventListener("pointerdown",calendarPointer,true);
      window.clearTimeout(clickTimer.current);
      drag.current?.abort();
    };
  },[embedded]);
  useEffect(()=>{
    if(bookmark===null)return;
    const dismiss=(event:PointerEvent)=>{
      const target=event.target;
      if(!(target instanceof Element) || stickerForm.current?.contains(target) || target.closest(".color-popup"))return;
      skipBlankClick.current=Boolean(journal.current?.contains(target) && blankSurface(target));
      setBookmark(null);
    };
    document.addEventListener("pointerdown",dismiss,true);
    return ()=>document.removeEventListener("pointerdown",dismiss,true);
  },[bookmark===null]);
  function beginDrag(event:ReactPointerEvent<HTMLElement>){
    if(embedded || event.button!==0 || (event.target as Element).closest("button,input,label") || !journal.current)return;
    event.preventDefault();
    const rect=journal.current.getBoundingClientRect();
    const offsetX=event.clientX-rect.left, offsetY=event.clientY-rect.top, pointer=event.pointerId;
    const startX=event.clientX,startY=event.clientY;
    drag.current?.abort();
    const controller=new AbortController();
    drag.current=controller;
    dragging.current=true;
    const options={signal:controller.signal,capture:true};
    let moved=false;
    const finish=()=>{
      controller.abort();
      dragging.current=false;
      if(moved)window.setTimeout(()=>{skipBlankClick.current=false;},0);
    };
    window.addEventListener("pointermove",move=>{
      if(move.pointerId!==pointer || Math.hypot(move.clientX-startX,move.clientY-startY)<4)return;
      moved=true;
      skipBlankClick.current=true;
      setPosition({
        x:Math.round(Math.min(Math.max(0,innerWidth-rect.width),Math.max(0,move.clientX-offsetX))),
        y:Math.round(Math.min(Math.max(0,innerHeight-rect.height),Math.max(0,move.clientY-offsetY))),
        width:rect.width,height:rect.height,
      });
    },options);
    window.addEventListener("pointerup",finish,options);
    window.addEventListener("pointercancel",finish,options);
    window.addEventListener("blur",finish,options);
  }
  const bookmarks=useMemo(()=>{
    try {
      const list=JSON.parse(notes["journal-bookmarks"]||"[]");
      return (Array.isArray(list)?list.filter(item=>item && typeof item.id==="string" && typeof item.title==="string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) && periodRange(item.date)):[]) as Bookmark[];
    } catch {return [];}
  },[notes]);
  const pages=useMemo(()=>Object.entries(notes).flatMap(([key,content])=>{
    if(!content || key==="journal-bookmarks" || key.startsWith("journal-layout:") || key.startsWith("journal-mood:") || key.startsWith("note-folder:") || key.startsWith("day-header:"))return [];
    const lines=readNoteLines(content);
    const text=lines.flatMap(line=>[line.heading,line.text,line.mood?.reason,line.lesson?.text]).filter(Boolean).join(" ").trim();
    return text?[{key,date:key.match(/\d{4}-\d{2}-\d{2}$/)?.[0],text}]:[];
  }),[notes]);
  const search=query.trim().toLocaleLowerCase("de");
  const entries=search?pages.filter(page=>page.text.toLocaleLowerCase("de").includes(search)).slice(0,100):[];
  const selected=parseDate(date);
  const weekText=weekdayNote && readNoteLines(weekdayNote.content).map(line=>line.text).filter(Boolean).join("\n");
  const fields=journalFieldsFor(notes,date);
  const summary=section==="week" || section==="month" ? periodRange(`${section}:${date}`) : null;
  const choose=(next:string)=>{onDate(next);setSection("page");setPreview(null);setQuery("");setLayoutDraft(null);};
  async function saveLayout(scope:"day"|"future") {
    if(!layoutDraft || savingLayout)return;
    const key=journalLayoutKey(date);
    const previous=readJournalLayout(notes[key]);
    const next=layoutDraft.map((field,index)=>({...field,title:field.title.trim()||`Feld ${index+1}`}));
    setSavingLayout(true);
    try {
      await onSave(key,JSON.stringify(scope==="day"?{...previous,day:next}:{future:next}));
      setLayoutDraft(null);
    } catch(err) {setError((err as Error).message);}
    finally {setSavingLayout(false);}
  }
  const saveMood=(value:NotebookMood|null)=>void onSave(journalMoodKey(date),JSON.stringify(value)).catch(err=>setError(err.message));
  const stepDate=(direction:number)=>{
    if(section==="week" || section==="month"){
      const next=parseDate(summary!.start);
      if(section==="month")next.setMonth(next.getMonth()+direction,1);
      else next.setDate(next.getDate()+7*direction);
      onDate(dateKey(next));setPreview(null);
    }else choose(dateKey(addDays(selected,direction)));
  };
  function singleClick(event:MouseEvent<HTMLButtonElement>, action:()=>void) {
    window.clearTimeout(clickTimer.current);
    if(event.detail===0)action();
    if(event.detail===1)clickTimer.current=window.setTimeout(action,250);
  }
  const enterCalendar=(view:"week"|"month"|"year")=>{
    setPreview(null);setDocked(true);onCalendarPeriod(date,view);
  };
  const saveBookmarks=(next:Bookmark[])=>void onSave("journal-bookmarks",JSON.stringify(next)).catch(err=>setError(err.message));
  const shown=preview ? periodRange(`${preview}:${date}`) : null;
  const dateControls=<div className="journal-date" onMouseLeave={()=>setPreview(null)}>
              <button type="button" aria-label="Vorheriger Tag" onClick={()=>stepDate(-1)}><ChevronLeft size={16}/></button>
              {(["week","month","year"] as const).map((period,index)=>
                <button key={period} type="button"
                  aria-label={`${period==="week"?"Wochen":period==="month"?"Monats":"Jahres"}kalender öffnen`}
                  onMouseEnter={()=>setPreview(period)} onFocus={()=>setPreview(period)}
                  onClick={()=>enterCalendar(period)}>{index===0?selected.getDate()+".":index===1?selected.toLocaleDateString("de-DE",{month:"long"}):selected.getFullYear()}</button>)}
              <button type="button" aria-label="Nächster Tag" onClick={()=>stepDate(1)}><ChevronRight size={16}/></button>
              {shown && <div className="journal-date-grid" data-period={preview}>
                {preview==="year" ? Array.from({length:12},(_,i)=>new Date(selected.getFullYear(),i,1)).map(month=>
                  <div key={dateKey(month)} className="journal-mini-month"><strong>{month.toLocaleDateString("de-DE",{month:"short"})}</strong>
                    {periodRange(`month:${dateKey(month)}`)?.days.map(day=><button key={day} type="button" title={dateLabel(day)} onClick={()=>choose(day)}>{Number(day.slice(-2))}</button>)}
                  </div>) : shown.days.map(day=><button key={day} type="button" aria-current={day===date?"date":undefined} onClick={()=>choose(day)}>
                    {preview==="week"?parseDate(day).toLocaleDateString("de-DE",{weekday:"short"})+" ":""}{Number(day.slice(-2))}
                  </button>)}
              </div>}
            </div>;
  return <div className={embedded?"journal-inline":"journal-layer"} data-docked={docked} data-placed={!!position}>
    <section ref={journal} className="modal notebook-journal"
      style={position && !embedded ? {left:position.x,top:position.y,width:position.width,height:position.height,maxWidth:"calc(100vw - 8px)",maxHeight:"calc(100dvh - 8px)"} : undefined}
      role="region" aria-label="Tagebuch" data-escape-layer
      onPointerEnter={()=>{if(!embedded && !position && !dragging.current)setDocked(false);}}
      onPointerLeave={event=>{
        if(!embedded && !position && !dragging.current && event.relatedTarget instanceof Element && event.relatedTarget.closest(".calendar-workspace"))setDocked(true);
      }}
      onClick={event=>{
        setMenu(null);
        const skip=skipBlankClick.current;skipBlankClick.current=false;
        if(skip || !blankSurface(event.target as Element))return;
        if(bookmark!==null){setBookmark(null);return;}
        if(layoutDraft){setLayoutDraft(null);return;}
        if(!embedded)onClose();
      }} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();if(bookmark!==null)setBookmark(null);else if(layoutDraft)setLayoutDraft(null);else if(preview)setPreview(null);else if(menu)setMenu(null);else if(!embedded)onClose();}}}>
      <header className="journal-header" onPointerDown={beginDrag} title={embedded?undefined:"Tagebuch verschieben"}>
        {!embedded && <BookOpen size={20}/>}<h2>Tagebuch</h2>
        <div className="journal-view-buttons" aria-label="Tagebuchansicht">
          {(["page","week","month"] as const).map((value,index)=><button type="button" key={value}
            aria-pressed={section===value && !search} onClick={()=>{setSection(value);setQuery("");setLayoutDraft(null);}}>
            {["Tag","Woche","Monat"][index]}
          </button>)}
        </div>
        <label className="journal-search"><Search size={15}/><input placeholder="Tagebuch durchsuchen" aria-label="Tagebuch durchsuchen" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <button type="button" className="icon-button" aria-label="Tagebuchlayout einstellen" aria-expanded={!!layoutDraft}
          onClick={()=>{setQuery("");setSection("page");setLayoutDraft(layoutDraft ? null : fields);}}><Settings2 size={17}/></button>
        {!embedded && <button type="button" data-close aria-label="Tagebuch schließen" onClick={onClose}><X size={18}/></button>}
      </header>
      <div className="journal-body">
        <main className="journal-page">
          {search ? <div className="journal-results">
            {entries.map(entry=><button type="button" key={entry.key} onClick={()=>{
              if((entry.key.startsWith("journal:") || entry.key.startsWith("journal-field:")) && entry.date)choose(entry.date);
              else onOpenNote(entry.key);
            }}><strong>{entry.date?dateLabel(entry.date):"Notiz"}</strong><span>{entry.text.slice(0,180)}</span></button>)}
            {!entries.length && <p>Keine passenden Einträge.</p>}
          </div> : layoutDraft ? <JournalLayoutEditor fields={layoutDraft} busy={savingLayout} onChange={setLayoutDraft} onSave={saveLayout}/>
            : summary ? <div className="journal-period">
              {dateControls}
              <h3>{dateLabel(summary.start)} – {dateLabel(summary.end)}</h3>
              {summary.days.map(day=>{
                const dayFields=journalFieldsFor(notes,day).map(field=>({...field,text:notes[journalFieldKey(day,field.id)]})).filter(field=>field.text?.trim());
                const page=pages.find(entry=>entry.key===journalPageKey(day));
                const dayLessons=lessons.filter(lesson=>lesson.date===day);
                const mood=moods[day];
                if(!page && !dayFields.length && !dayLessons.length && !mood)return null;
                return <article key={day}>
                  <button type="button" onClick={()=>choose(day)}>{parseDate(day).toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</button>
                  {mood && <p style={{color:moodColors[mood.score]}}>{[moodLabels[mood.score],mood.reason].filter(Boolean).join(" · ")}</p>}
                  {page && <div className="journal-period-entry">{readNoteLines(notes[page.key]||"").map(line=>line.text).filter(Boolean).join("\n")}</div>}
                  {dayFields.map(field=><div key={field.id} className="journal-period-entry"><strong>{field.title}</strong><p>{field.text}</p></div>)}
                  {dayLessons.map((lesson,index)=><p key={index}>{lesson.text}</p>)}
                </article>;
              })}
              {!summary.days.some(day=>moods[day] || lessons.some(lesson=>lesson.date===day) || pages.some(page=>page.date===day &&
                (page.key.startsWith("journal:") || page.key.startsWith("journal-field:")))) && <p>In diesem Zeitraum gibt es keine Einträge.</p>}
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
            <div className="journal-mood-bar" key={date}>
              <strong>Stimmung</strong>
              <NotebookMoodPicker day={date} value={moods[date]} onSave={saveMood}/>
              {moods[date] && <span className="journal-day-mood" style={{color:moodColors[moods[date].score]}}>
                {[moodLabels[moods[date].score],moods[date].reason].filter(Boolean).join(" · ")}
                <button type="button" aria-label="Stimmung entfernen" onClick={()=>saveMood(null)}><X size={13}/></button>
              </span>}
            </div>
            <JournalEditor key={date} value={notes[journalPageKey(date)]||""} date={date} preferences={preferences} dateControls={dateControls} save={text=>onSave(journalPageKey(date),text)}/>
            {weekText && weekdayNote && <button className="journal-source" type="button" onClick={()=>onOpenNote(weekdayNote.key)}>{weekText}</button>}
            {fields.map(field=>{
              const key=journalFieldKey(date,field.id);
              return <JournalFieldEditor key={key} field={field} noteKey={key} value={notes[key]||""} onSave={onSave}/>;
            })}
            {lessons.filter(lesson=>lesson.date===date).map((lesson,index)=><p className="journal-day-lesson" key={index}>{lesson.text}</p>)}
            {pages.filter(page=>page.date===date && page.key!==journalPageKey(date) && !page.key.startsWith("journal-field:") && page.key!==weekdayNote?.key).map(page=>
              <button className="journal-source" type="button" key={page.key} onClick={()=>onOpenNote(page.key)}>{page.text.slice(0,160)}</button>)}
          </>}
        </main>
        <aside className="journal-stickers" aria-label="Markiersticker">
          <button type="button" onClick={()=>{setSection("moods");setQuery("");}}>Moodtracker</button>
          <button type="button" onClick={()=>{setSection("lessons");setQuery("");}}>Lektionen</button>
          {bookmarks.map(item=><div key={item.id} className="journal-sticker">
            {rename===item.id ? <input autoFocus aria-label="Stickertitel ändern" defaultValue={item.title} placeholder={dateLabel(item.date)} maxLength={80}
              onFocus={event=>event.currentTarget.select()}
              onBlur={event=>{
                const title=event.target.value.trim();
                if(title!==item.title)saveBookmarks(bookmarks.map(other=>other.id===item.id ? {...other,title} : other));
                setRename(null);
              }}
              onKeyDown={event=>{
                if(event.key==="Enter" && !event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.blur();}
                if(event.key==="Escape"){event.stopPropagation();setRename(null);}
              }}/> :
              <button type="button" style={item.color && /^#[0-9a-f]{6}$/i.test(item.color)?{backgroundColor:item.color,color:"#26342b"}:undefined}
                onClick={event=>singleClick(event,()=>choose(item.date))}
                onDoubleClick={()=>{window.clearTimeout(clickTimer.current);setRename(item.id);}}
                onContextMenu={event=>{event.preventDefault();setMenu(item.id);}}>{item.title||dateLabel(item.date)}</button>}
            {menu===item.id && <button type="button" role="menuitem" onClick={()=>saveBookmarks(bookmarks.filter(other=>other.id!==item.id))}>Sticker löschen</button>}
          </div>)}
          {bookmark===null?<button type="button" aria-label="Markiersticker hinzufügen" onClick={()=>{setBookmark("");setBookmarkColor(stickerColors[0]);}}><Plus size={16}/></button>:
            <form ref={stickerForm} className="journal-sticker-form" onSubmit={event=>{
              event.preventDefault();
              saveBookmarks([...bookmarks,{id:crypto.randomUUID(),date,title:bookmark.trim(),color:bookmarkColor}]);
              setBookmark(null);
            }}>
              <input autoFocus aria-label="Stickertitel" placeholder={dateLabel(date)} value={bookmark} maxLength={80} onChange={event=>setBookmark(event.target.value)}/>
              <ColorSwatches name="journal-sticker" value={bookmarkColor} presets={stickerColors} onChange={event=>setBookmarkColor(event.target.value)}/>
              <button type="submit" aria-label="Sticker speichern">✓</button>
            </form>}
        </aside>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  </div>;
}
