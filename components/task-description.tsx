"use client";
import { useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import RichNoteLine from "./rich-note-line";
import { defaultNotePreferences } from "@/lib/note-todos";
import { sliceNoteRuns, type NoteRun } from "@/lib/note-format";
import type { Todo } from "@/lib/types";

export default function TaskDescription({
  value,
  subtasks,
  runs,
  imported,
  onChange,
}: {
  value: string;
  runs?: NoteRun[];
  subtasks: Todo["subtasks"];
  imported?: boolean;
  onChange: (patch: Partial<Pick<Todo, "description" | "descriptionRuns" | "subtasks">>) => void;
}) {
  const input = useRef<HTMLDivElement>(null);
  const [offerTask, setOfferTask] = useState(false);
  const [plainText, setPlainText] = useState(false);
  const [caret, setCaret] = useState(0);
  const start = caret > 0 ? value.lastIndexOf("\n", caret - 1) + 1 : 0;
  const next = value.indexOf("\n", caret);
  const end = next < 0 ? value.length : next;
  const line = value.slice(start, end).trim();
  const canAdd = offerTask && !plainText && !!line && line.length <= 500;
  const addTask = () => {
    if (!canAdd) return;
    const description = (
      value.slice(0, start) + value.slice(next < 0 ? end : end + 1)
    ).replace(/\n$/, "");
    onChange({
      description,
      descriptionRuns:runs && [...sliceNoteRuns(runs,0,start),...sliceNoteRuns(runs,next<0?end:end+1,value.length)],
      subtasks: [
        ...subtasks,
        { id: crypto.randomUUID(), title: line, done: false },
      ],
    });
    setOfferTask(false);
    setPlainText(false);
    setCaret(description.length);
    input.current?.querySelector<HTMLElement>(".rich-note-field")?.focus();
  };
  return (
    <div className="task-description-box">
      {subtasks.length > 0 && (
        <div className="description-subtasks" aria-label="Unteraufgaben">
          {subtasks.map((task) => (
            <div className="subtask" key={task.id}>
              <button
                type="button"
                className={`task-check ${task.done ? "checked" : ""}`}
                aria-label={`${task.title} abhaken`}
                onClick={() =>
                  onChange({
                    subtasks: subtasks.map((t) =>
                      t.id === task.id ? { ...t, done: !t.done } : t,
                    ),
                  })
                }
              >
                {task.done && <Check size={11} />}
              </button>
              <span className={task.done ? "struck" : ""}>{task.title}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`${task.title} entfernen`}
                onClick={() =>
                  onChange({
                    subtasks: subtasks.filter((t) => t.id !== task.id),
                  })
                }
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`description-entry ${canAdd ? "offers-subtask" : ""}`}>
        {canAdd && (
          <button
            type="button"
            className="description-add-task"
            aria-label="Zeile als Unteraufgabe hinzufügen"
            title="Unteraufgabe hinzufügen · Enter"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addTask}
          >
            <Plus size={16} />
          </button>
        )}
        <div ref={input} className="description-input" data-imported={imported}>
        <RichNoteLine text={value} runs={runs} label="Beschreibung / Unteraufgabe"
          placeholder="Ergänze eine Beschreibung / Unteraufgabe …"
          preferences={defaultNotePreferences} maxLength={10000} onCaret={setCaret}
          onBlur={()=>{}} onFiles={()=>{}}
          onChange={(text,descriptionRuns)=>{
            if(text!==value)setOfferTask(true);
            if(text.endsWith("\n") && !value.endsWith("\n"))setPlainText(false);
            onChange({description:text,descriptionRuns});
          }}
          onKeyDown={(e,start,end) => {
            if (e.nativeEvent.isComposing || e.metaKey || e.ctrlKey || e.altKey)
              return;
            if (canAdd && start===end && ["Backspace", "Delete"].includes(e.key)) {
              e.preventDefault();
              e.stopPropagation();
              setPlainText(true);
            } else if (canAdd && e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              if (!e.repeat) addTask();
            }
          }}
        />
        </div>
      </div>
    </div>
  );
}
