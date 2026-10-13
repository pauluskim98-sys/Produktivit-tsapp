"use client";
import { useId } from "react";
import PersonAvatar from "./person-avatar";
import { useDraggable } from "@dnd-kit/core";
import type { TaskColor } from "@/lib/task-colors";
import type { Friend } from "@/lib/life";
export default function SocialPerson({
  friend,
  color = "green",
  onAdd,
}: {
  friend: Friend;
  color?: TaskColor;
  onAdd: (title: string, tags: string[], notes: string) => Promise<void>;
}) {
  const id = useId(),
    item = {
      color,
      title: `Treffen mit ${friend.name}`,
      tags: [`k:${friend.id}`, "Beziehungen"],
      notes: "",
      source: "Beziehungen",
    };
  const d = useDraggable({ id: `person:${id}`, data: { suggestion: item } });
  return (
    <button
      className="person-name"
      ref={d.setNodeRef}
      {...d.attributes}
      {...d.listeners}
      style={{ touchAction: "none", opacity: d.isDragging ? 0.4 : 1 }}
      onClick={() => void onAdd(item.title, item.tags, item.notes)}
    >
      <PersonAvatar person={friend.id} name={friend.name} small />
      {friend.name}
    </button>
  );
}
