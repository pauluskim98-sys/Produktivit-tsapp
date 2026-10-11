import type { Todo } from "./types";
import { validTodo } from "./validation.ts";
export interface PlanItem {
  title: string;
  plannedDate: string | null;
  time: string;
  duration: number | null;
  color: NonNullable<Todo["color"]>;
  description: string;
}
export function validatePlanItems(
  value: unknown,
  start: string,
  end: string,
): Todo[] {
  if (!Array.isArray(value) || value.length > 80)
    throw new Error(
      "Ein Plan darf höchstens 80 Aufgaben enthalten. Bitte das Ziel in kleinere Abschnitte teilen.",
    );
  return value.map((v, i) => {
    if (!v || typeof v !== "object") throw new Error("Ungültiger Vorschlag.");
    const t = validTodo({
      id: crypto.randomUUID(),
      title: v.title,
      plannedDate: v.plannedDate,
      time: v.time,
      duration: v.duration,
      color: v.color,
      description: v.description,
      notes: "",
      done: false,
      priority: "none",
      deadline: null,
      tags: [],
      subtasks: [],
      position: i,
      createdAt: new Date().toISOString(),
    });
    if (t.plannedDate && (t.plannedDate < start || t.plannedDate > end))
      throw new Error(
        "Ein Vorschlag liegt außerhalb des gewählten Zeitraums. Bitte erneut planen.",
      );
    if (t.time && (!t.plannedDate || !t.duration))
      throw new Error("Ein Zeitblock benötigt Tag und Dauer.");
    return t;
  });
}
export const planSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          plannedDate: { type: ["string", "null"] },
          time: { type: "string" },
          duration: { type: ["integer", "null"] },
          color: {
            type: "string",
            enum: ["green", "blue", "purple", "orange", "pink"],
          },
          description: { type: "string" },
        },
        required: [
          "title",
          "plannedDate",
          "time",
          "duration",
          "color",
          "description",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["answer", "items"],
  additionalProperties: false,
};
