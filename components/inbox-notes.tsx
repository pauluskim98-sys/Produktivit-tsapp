"use client";
import { useAutosaveText } from "./use-autosave-text";
import PlannerNotepad from "./planner-notepad";
import { useEffect } from "react";
import type { NotebookLesson, NotebookMood } from "@/lib/notebook-layout";
import type { Todo } from "@/lib/types";
import { appendNotebookRow, noteWithTasks, withNotebookHeading, withNotebookLesson, withNotebookMood, withoutLegacyNoteTodos } from "./planner-notepad";
import type { NotePreferences } from "@/lib/note-todos";
export default function InboxNotes({
  value,
  onSave,
  label = "Notizen",
  onStep,
  noteDate,
  actions,
  tasks,
  onTaskOpen,
  registerStore,
  registerLegacyDelete,
  todoMode,
  rows,
  columnHeader,
  onFocusColumn,
  preferences,
  titled,
  focusTitle,
}: {
  value: string;
  label?: string;
  onStep?: (direction:number)=>void;
  noteDate: string;
  actions?: React.ReactNode;
  tasks: Todo[];
  onTaskOpen: (id:string)=>void;
  registerStore?: (store:((tasks:Todo[])=>Promise<void>)|null)=>void;
  registerLegacyDelete?: (remove:((ids:string[])=>Promise<{before:string;after:string}>)|null)=>void;
  todoMode?:boolean;
  rows?:number;
  onFocusColumn?:()=>void;
  columnHeader?:{legacyTitle?:string;showHint?:boolean};
  preferences:NotePreferences;
  titled?:boolean;
  focusTitle?:boolean;
  onSave: (text: string) => Promise<void>;
}) {
  const { text, setText, flush, error } = useAutosaveText(value, onSave, `lifemap-notebook-draft:${noteDate}`);
  useEffect(()=>{
    registerStore?.(async(tasks)=>{
      setText(noteWithTasks(text,tasks,titled));
      if(!await flush())throw new Error("Notiz konnte nicht gespeichert werden.");
    });
    registerLegacyDelete?.(async(ids)=>{
      const after=withoutLegacyNoteTodos(text,noteDate,ids,todoMode);
      setText(after);
      if(!await flush()){
        setText(text);
        throw new Error("To-dos konnten nicht gelöscht werden.");
      }
      return {before:text,after};
    });
    return () => {
      registerStore?.(null);
      registerLegacyDelete?.(null);
    };
  });
  useEffect(() => {
    const save = (event: Event) => {
      (event as CustomEvent<Promise<boolean>[]>).detail.push(flush());
    };
    document.addEventListener("lifemap-save-notebook", save);
    return () => document.removeEventListener("lifemap-save-notebook", save);
  }, [flush]);
  useEffect(()=>{
    const change=(event:Event)=>{
      type Change = {keys:string[]} & ({kind:"mood";value:NotebookMood} | {kind:"lesson";value:NotebookLesson} | {kind:"row"|"heading";value:string});
      const detail=(event as CustomEvent<Change>).detail;
      if(!detail.keys.includes(noteDate))return;
      const updated=detail.kind==="mood" ? withNotebookMood(text,detail.value,detail.value.date) :
        detail.kind==="lesson" ? withNotebookLesson(text,detail.value) :
        detail.kind==="heading" ? withNotebookHeading(text,detail.value,columnHeader?.legacyTitle) :
        appendNotebookRow(text,detail.value,columnHeader?.legacyTitle,rows);
      if(updated.length>10000){window.dispatchEvent(new CustomEvent("raum-history-error",{detail:"Die Notiz ist voll."}));return;}
      setText(updated);
      void flush();
    };
    window.addEventListener("lifemap-notebook-change",change);
    return ()=>window.removeEventListener("lifemap-notebook-change",change);
  },[noteDate,text,setText,flush,columnHeader,rows]);
  return (
    <section className="inbox-notes" onFocusCapture={onFocusColumn}>
      <PlannerNotepad label={label} value={text} onChange={setText} onBlur={flush} onStep={onStep} noteDate={noteDate} actions={actions} tasks={tasks} onTaskOpen={onTaskOpen} todoMode={todoMode} rows={rows} columnHeader={columnHeader} sharedUpload preferences={preferences} titled={titled} focusTitle={focusTitle}/>
      {error && <small role="status">{error}</small>}
    </section>
  );
}
