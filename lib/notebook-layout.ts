export type NotebookFeatures = { todo?: boolean; weekdays?: boolean; mood?: boolean; lessons?: boolean };
export type NotebookColumn = {
  id: string;
  width?: number;
  title?: string;
  features?: NotebookFeatures;
  color?: string;
  design?: NotebookLayout["design"];
  planning?: boolean;
};
export type NotebookLayout = {
  title?: string;
  rows?: number;
  kind: "note" | "todo" | "weekly";
  features?: NotebookFeatures;
  view: "" | "week" | "month" | "year";
  color: string;
  design: "plain" | "lined" | "grid";
  columns: NotebookColumn[];
};

export function notebookFeatures(layout: NotebookLayout, column?: NotebookColumn) {
  const weekdays = column?.features?.weekdays ?? layout.features?.weekdays ?? (layout.kind === "weekly");
  return {
    todo: column?.features?.todo ?? layout.features?.todo ?? (layout.kind === "todo"),
    weekdays,
    mood: weekdays && (column?.features?.mood ?? layout.features?.mood ?? false),
    lessons: weekdays && (column?.features?.lessons ?? layout.features?.lessons ?? false),
  };
}

export const defaultNotebookLayout: NotebookLayout = {
  kind: "note", view: "", color: "", design: "plain", columns: [{ id: "main" }],
};

export type NotebookTemplate = { id: string; name: string; layout: NotebookLayout };

export function applyNotebookTemplate(current: NotebookLayout, template: NotebookLayout): NotebookLayout {
  const columns = template.columns.map((column, index) => ({
    ...column, id: current.columns[index]?.id ?? crypto.randomUUID(),
  }));
  return {...template, title:current.title, columns:[...columns, ...current.columns.slice(columns.length)]};
}

export const moodColors = ["#479763", "#dfb32e", "#de822d", "#cd5554"];
export const moodLabels = ["Gut", "Okay", "Schwierig", "Schlecht"];
export type NotebookMood = { date: string; score: number; reason: string };
export type NotebookLesson = { date: string; text: string };

// Each dated weekly layout owns independent note keys, even before it is edited.
export function weeklyNotebookLayout(key: string, saved?: NotebookLayout, shared?: NotebookLayout): NotebookLayout {
  if (!/^week:\d{4}-\d{2}-\d{2}$/.test(key)) return saved ?? defaultNotebookLayout;
  const weekId = key.slice(5).replaceAll("-", "");
  const id = (index:number) => `00000000-0000-4000-8000-${weekId}${String(index).padStart(4,"0")}`;
  const layout = saved ?? defaultNotebookLayout;
  const dayColumns = layout.columns.filter(column=>!column.planning);
  const planning = layout.columns.find(column=>column.planning) ?? {id:id(0),planning:true};
  const columns=[planning,...dayColumns,...Array.from({length:Math.max(0,7-dayColumns.length)},(_,i)=>({id:id(dayColumns.length+i+1)}))];
  const appearance=shared ?? layout;
  return {
    ...layout, view:"week",
    rows:appearance.rows,
    color:appearance.color,
    design:appearance.design,
    features:{...appearance.features,weekdays:true,mood:appearance.features?.mood ?? true},
    columns:shared ? shared.columns.map((column,index)=>({...column,id:columns[index]?.id ?? id(index)})) : columns,
  };
}

export function notebookColumnKey(note: string, id: string) {
  return id === "main" ? note : `note-column:${id}:${note}`;
}

export function addNotebookColumns(columns: NotebookColumn[], count: number) {
  return [...columns, ...Array.from({ length: Math.max(0, count - columns.length) }, () => ({ id: crypto.randomUUID() }))];
}

export function readNotebookSession() {
  try {
    const value = JSON.parse(localStorage.getItem("lifemap-notebook-session") || "{}");
    return {
      tabs: Array.isArray(value.tabs) ? value.tabs.filter((key: unknown): key is string => typeof key === "string") as string[] : [],
      active: typeof value.active === "string" ? value.active as string : null,
      layouts: (value.layouts || {}) as Record<string, NotebookLayout>,
    };
  } catch {
    return { tabs: [] as string[], active: null, layouts: {} as Record<string, NotebookLayout> };
  }
}
