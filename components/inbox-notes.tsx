"use client";
import { useAutosaveText } from "./use-autosave-text";
import PlannerNotepad from "./planner-notepad";
import { useEffect } from "react";
import type { Todo } from "@/lib/types";
import { noteWithTasks, withoutLegacyNoteTodos } from "./planner-notepad";
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
  todoPanel,
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
  registerStore: (store:((tasks:Todo[])=>Promise<void>)|null)=>void;
  registerLegacyDelete: (remove:((ids:string[])=>Promise<{before:string;after:string}>)|null)=>void;
  todoPanel:React.ReactNode;
  preferences:NotePreferences;
  titled?:boolean;
  focusTitle?:boolean;
  onSave: (text: string) => Promise<void>;
}) {
  const { text, setText, flush, error } = useAutosaveText(value, onSave);
  useEffect(()=>{
    registerStore(async(tasks)=>{
      setText(noteWithTasks(text,tasks,titled));
      if(!await flush())throw new Error("Notiz konnte nicht gespeichert werden.");
    });
    registerLegacyDelete(async(ids)=>{
      const after=withoutLegacyNoteTodos(text,noteDate,ids);
      setText(after);
      if(!await flush()){
        setText(text);
        throw new Error("To-dos konnten nicht gelöscht werden.");
      }
      return {before:text,after};
    });
    return ()=>{registerStore(null);registerLegacyDelete(null);};
  });
  return (
    <section className="inbox-notes">
      <PlannerNotepad label={label} value={text} onChange={setText} onBlur={flush} onStep={onStep} noteDate={noteDate} actions={actions} tasks={tasks} onTaskOpen={onTaskOpen} todoPanel={todoPanel} preferences={preferences} titled={titled} focusTitle={focusTitle}/>
      {error && <small role="status">{error}</small>}
    </section>
  );
}
