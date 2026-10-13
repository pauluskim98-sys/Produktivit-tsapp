"use client";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { useId } from "react";
import { Flag } from "lucide-react";
import type { Todo, Priority } from "@/lib/types";
import PeriodTask from "./period-task";
const rank = { high: 0, medium: 1, low: 2, none: 2 };
function Slot({
  beforeId,
  horizon,
  priority,
}: {
  beforeId: string | null;
  horizon: string;
  priority: Priority;
}) {
  const id = useId();
  const drop = useDroppable({
    id: `order:${id}`,
    data: { kind: "todo-priority", horizon, beforeId, priority },
  });
  return (
    <div
      ref={drop.setNodeRef}
      className={`priority-insert-slot ${drop.isOver ? `over priority-${priority}` : ""}`}
    />
  );
}
function Row({
  todo,
  horizon,
  onOpen,
  onPriority,
}: {
  todo: Todo;
  horizon: string;
  onOpen: (id: string) => void;
  onPriority: (todo: Todo, priority: Priority, horizon: string) => void;
}) {
  const id = useId();
  const drop = useDroppable({
    id: `priority-row:${id}`,
    data: {
      kind: "todo-priority",
      horizon,
      beforeId: todo.id,
      priority: todo.priority === "none" ? "low" : todo.priority,
    },
  });
  return (
    <div
      ref={drop.setNodeRef}
      className={`priority-list-item ${drop.isOver ? "drop-over" : ""}`}
    >
      <PeriodTask todo={todo} compact onOpen={onOpen} />
      <div
        className="priority-row-flags"
        aria-label={`Priorität für ${todo.title}`}
      >
        {(["high", "medium", "low"] as Priority[]).map((priority) => (
          <button
            key={priority}
            type="button"
            className={`priority-flag ${priority}`}
            aria-label={`${todo.title}: ${{ high: "Hohe", medium: "Mittlere", low: "Niedrige", none: "Niedrige" }[priority]} Priorität`}
            aria-pressed={
              todo.priority === priority ||
              (todo.priority === "none" && priority === "low")
            }
            onClick={(event) => {
              event.stopPropagation();
              onPriority(todo, priority, horizon);
            }}
          >
            <Flag size={13} fill="currentColor" />
          </button>
        ))}
      </div>
    </div>
  );
}
export default function PriorityList({
  todos,
  horizon,
  onOpen,
  onPriority,
}: {
  todos: Todo[];
  horizon: string;
  onOpen: (id: string) => void;
  onPriority: (todo: Todo, priority: Priority, horizon: string) => void;
}) {
  const { active } = useDndContext();
  const sorted = [...todos].sort(
    (a, b) => rank[a.priority] - rank[b.priority] || a.position - b.position,
  );
  return (
    <div className={`unified-todo-list ${active ? "is-dragging" : ""}`}>
      {sorted.map((todo) => (
        <div key={todo.id}>
          <Slot
            beforeId={todo.id}
            horizon={horizon}
            priority={todo.priority === "none" ? "low" : todo.priority}
          />
          <Row
            todo={todo}
            horizon={horizon}
            onOpen={onOpen}
            onPriority={onPriority}
          />
        </div>
      ))}
      <Slot
        beforeId={null}
        horizon={horizon}
        priority={sorted.at(-1)?.priority || "low"}
      />
      {!todos.length && (
        <p className="muted">Platz für deine nächsten Vorhaben.</p>
      )}
    </div>
  );
}
