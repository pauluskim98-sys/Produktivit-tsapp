"use client";
import { useAutosaveText } from "./use-autosave-text";
import PlannerNotepad from "./planner-notepad";
import { useEffect } from "react";
import type { NotebookMood } from "@/lib/notebook-layout";
import type { Todo } from "@/lib/types";
import { noteWithTasks, withNotebookMood, withoutLegacyNoteTodos } from "./planner-notepad";
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
      const after=withoutLegacyNoteTodos(text,noteDate,ids);
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
    const mood=(event:Event)=>{
      const {key,value}=(event as CustomEvent<{key:string;value:NotebookMood}>).detail;
      if(key!==noteDate)return;
      const updated=withNotebookMood(text,value,titled);
      if(updated.length>10000){window.dispatchEvent(new CustomEvent("raum-history-error",{detail:"Die Notiz ist voll."}));return;}
      setText(updated);
      void flush();
    };
    window.addEventListener("lifemap-notebook-mood",mood);
    return ()=>window.removeEventListener("lifemap-notebook-mood",mood);
  },[noteDate,text,setText,flush,titled]);
  return (
    <section className="inbox-notes">
      <PlannerNotepad label={label} value={text} onChange={setText} onBlur={flush} onStep={onStep} noteDate={noteDate} actions={actions} tasks={tasks} onTaskOpen={onTaskOpen} todoMode={todoMode} rows={rows} preferences={preferences} titled={titled} focusTitle={focusTitle}/>
      {error && <small role="status">{error}</small>}
    </section>
  );
}
