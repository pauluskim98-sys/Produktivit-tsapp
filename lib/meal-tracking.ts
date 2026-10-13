import type { Todo } from "./types.ts";
import type { LifeState, MealLog } from "./life.ts";
export function trackMeals(
  life: LifeState,
  before: Todo[],
  after: Todo[],
  today: string,
): LifeState {
  const old = new Map(before.map((t) => [t.id, t])),
    next = new Map(after.map((t) => [t.id, t]));
  let meals = life.meals.filter((m) => !m.todoId || next.has(m.todoId));
  for (const t of after) {
    if (!t.tags.includes("Essen")) continue;
    const previous = old.get(t.id),
      found = meals.find((m) => m.todoId === t.id);
    if (found) {
      if (previous?.plannedDate !== t.plannedDate)
        meals = meals.map((m) =>
          m.todoId === t.id ? { ...m, day: t.plannedDate || today } : m,
        );
      continue;
    }
    if (previous) continue;
    const text = `${t.title} ${t.description} ${t.notes}`.toLowerCase();
    const meat =
        /\b(beef|chicken|pork|lamb|bacon|ham|sausage|salmon|tuna|fish|hähnchen|rind|schwein|fleisch|lachs|thunfisch|fisch)\b/.test(
          text,
        ),
      veg =
        /\b(vegetarian|vegan|vegetarisch|lentil|chickpea|tofu|linsen|kichererbsen)\b/.test(
          text,
        );
    meals.push({
      id: crypto.randomUUID(),
      todoId: t.id,
      day: t.plannedDate || today,
      name: t.title.slice(0, 200),
      calories: null,
      quality: "unknown",
      diet: meat ? "meat" : veg ? "vegetarian" : "unknown",
    });
  }
  return { ...life, meals };
}
