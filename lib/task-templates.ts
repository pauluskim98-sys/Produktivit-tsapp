import type { Todo } from "./types";

export type TaskTemplate = {
  category: string;
  title: string;
  uses: number;
  settings?: Partial<Todo> | null;
};

export function templateSettings(todo: Todo): Partial<Todo> {
  return {
    description: todo.description,
    descriptionRuns:todo.descriptionRuns,
    notes: todo.notes,
    priority: todo.priority,
    reminder: todo.reminder,
    location: todo.location,
    travelBefore: todo.travelBefore,
    travelAfter: todo.travelAfter,
    travelMode: todo.travelMode,
    color: todo.color,
    plannedDate: todo.plannedDate,
    time: todo.time,
    deadline: todo.deadline,
    duration: todo.duration,
    tags: todo.tags.filter(tag => !/^(auto:|h:|d:|q:|note-origin:|note-todo:|stored$|k:)/.test(tag)),
    subtasks: todo.subtasks.map(task => ({ ...task, done: false })),
  };
}

export function applyTaskTemplate(current: Todo, template: TaskTemplate, preserveSlot: boolean): Todo {
  const settings = template.settings ?? {};
  const categories = [...new Set([...current.tags, ...(settings.tags ?? []), "c:" + template.category])];
  return {
    ...current,
    ...settings,
    id: current.id,
    createdAt: current.createdAt,
    position: current.position,
    seriesId: current.seriesId,
    done: current.done,
    title: template.title,
    tags: categories,
    subtasks: settings.subtasks?.map(task => ({ ...task, id: crypto.randomUUID(), done: false })) ?? current.subtasks,
    ...(preserveSlot ? { plannedDate: current.plannedDate, time: current.time, duration: current.duration ?? settings.duration ?? null } : {}),
  };
}
