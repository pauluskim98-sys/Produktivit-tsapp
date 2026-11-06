"use client";
import { TaskPersonAvatar } from "./person-avatar";
import { useId, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Todo } from "@/lib/types";
import { calendarTitle } from "@/lib/calendar-title";
import CategoryIcon from "./category-icon";
import TaskPicture from "./task-picture";
import { taskFlag } from "@/lib/task-colors";
import TaskImportanceButtons from "./task-importance-buttons";
import { addDays, dateKey, parseDate } from "@/lib/dates";
import { notePeriod } from "@/lib/note-todos";
import { NoteTodoCheck } from "./note-todo-board";
export default function PeriodTask({
  todo,
  onOpen,
  onExtend,
  compact = false,
  abbreviated = false,
  detail,
  selectionIds,
  onImportance,
  onToggle,
}: {
  todo: Todo;
  onOpen: (id: string) => void;
  onExtend?: (todo: Todo, days: string[]) => Promise<void>;
  compact?: boolean;
  abbreviated?: boolean;
  detail?: string;
  selectionIds?: string[];
  onImportance?: (important: boolean) => void;
  onToggle?: (todo:Todo) => void;
}) {
  const scope = useId();
  const drag = useDraggable({
    id: `period:${scope}:${todo.id}`,
    data: { todoId: todo.id },
  });
  const origin = useRef<string | null>(null);
  const [range, setRange] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  function dates(day: string) {
    if (!origin.current) return [];
    const start = origin.current < day ? origin.current : day,
      end = origin.current > day ? origin.current : day;
    const list = [];
    for (
      let d = parseDate(start);
      dateKey(d) <= end && list.length < 366;
      d = addDays(d, 1)
    )
      list.push(dateKey(d));
    return list;
  }
  return (
    <div
      data-task-id={todo.id}
      data-task-flag={taskFlag(todo.priority)}
      data-task-ids={selectionIds ? JSON.stringify(selectionIds) : undefined}
      className={`period-task-row color-${todo.color || "green"} ${compact ? "compact" : ""}`}
      style={{ opacity: drag.isDragging ? 0.3 : 1,"--calendar-group-color":todo.calendarGroupColor } as React.CSSProperties}
    >
      {onToggle && notePeriod(todo) && <button type="button" className="calendar-note-check" aria-label={`${todo.title} abhaken`} aria-pressed={todo.done} onClick={()=>onToggle(todo)}><NoteTodoCheck done={todo.done}/></button>}
      <button
        ref={drag.setNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        data-calendar-task={todo.id}
        className="period-task-content"
        title={detail || `${todo.title}${todo.time ? ` · ${todo.time}` : ""}`}
        style={{ touchAction: "none" }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(todo.id);
        }}
      >
        <TaskPersonAvatar todo={todo} small />
        <TaskPicture todo={todo} />
        <i className="entry-dot" />
        {todo.tags.find((tag) => tag.startsWith("c:")) && <CategoryIcon id={todo.tags.find((tag) => tag.startsWith("c:"))!.slice(2)} />}
        <strong>{abbreviated ? calendarTitle(todo.title) : todo.title}</strong>
        {!compact && <small>{todo.plannedDate}</small>}
      </button>
      {onImportance && <TaskImportanceButtons onChange={onImportance} />}
      {onExtend && todo.plannedDate && (
        <button
          className="period-extend"
          title="Über weitere Tage ziehen"
          aria-label={`${todo.title} auf mehrere Tage erweitern`}
          disabled={saving}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            origin.current = todo.plannedDate;
            e.currentTarget.setPointerCapture(e.pointerId);
            setRange([todo.plannedDate!]);
          }}
          onPointerMove={(e) => {
            if (!origin.current) return;
            const day = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest<HTMLElement>("[data-calendar-date]")
              ?.dataset.calendarDate;
            if (day) setRange(dates(day));
          }}
          onPointerCancel={() => {
            origin.current = null;
            setRange([]);
          }}
          onPointerUp={async (e) => {
            e.stopPropagation();
            const day = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest<HTMLElement>("[data-calendar-date]")
              ?.dataset.calendarDate;
            const list = day ? dates(day) : range;
            origin.current = null;
            setRange([]);
            e.currentTarget.releasePointerCapture(e.pointerId);
            if (list.length > 1) {
              setSaving(true);
              try {
                await onExtend(todo, list);
              } finally {
                setSaving(false);
              }
            }
          }}
        >
          ↔
        </button>
      )}
      {range.length > 1 && (
        <span className="range-preview">
          {range.length} Tage · gleiche Uhrzeit
        </span>
      )}
    </div>
  );
}
