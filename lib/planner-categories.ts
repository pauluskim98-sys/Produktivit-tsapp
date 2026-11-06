import type { TaskColor } from "./task-colors";
export const categoryColors: Record<string, TaskColor> = {
  food: "orange", events: "blue", social: "pink", sport: "green",
  hobbies: "purple", learning: "indigo", work: "slate", goals: "yellow", weather: "teal",
};
export function categoryColor(id: string): TaskColor {
  return categoryColors[id] || (["red", "teal", "yellow", "purple", "blue"] as TaskColor[])[Array.from(id).reduce((n,c) => n + c.charCodeAt(0),0) % 5];
}
