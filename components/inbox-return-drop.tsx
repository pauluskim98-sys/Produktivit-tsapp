"use client";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import type { Todo } from "@/lib/types";
export default function InboxReturnDrop({ todos }: { todos: Todo[] }) {
  const { active } = useDndContext();
  const task = todos.find(
    (todo) => todo.id === (active?.data.current?.todoId || active?.id),
  );
  const enabled = Boolean(task?.plannedDate);
  const drop = useDroppable({
    id: "inbox-return",
    data: { kind: "inbox-return" },
    disabled: !enabled,
  });
  return enabled ? (
    <div
      ref={drop.setNodeRef}
      className={`inbox-return-drop ${drop.isOver ? "over" : ""}`}
    >
      <Inbox size={24} />
      <strong>Zurück in die Inbox</strong>
    </div>
  ) : null;
}
