export type NotebookFeatures = { todo?: boolean; weekdays?: boolean; mood?: boolean; lessons?: boolean };
export type NotebookColumn = {
  id: string;
  width?: number;
  title?: string;
  features?: NotebookFeatures;
  color?: string;
  design?: NotebookLayout["design"];
  planning?: boolean;
  weeklySlot?: number;
  weekday?: number;
};
export type NotebookLayout = {
  title?: string;
  rows?: number;
  kind: "note" | "todo" | "weekly" | "journal";
  features?: NotebookFeatures;
  view: "" | "week" | "month" | "year";
  color: string;
  design: "plain" | "lined" | "grid";
  columns: NotebookColumn[];
  weeklyColumnIds?: Record<number, string>;
  nextWeeklySlot?: number;
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

export const defaultJournalTab = "note:root:00000000-0000-4000-8000-000000000010";
export const defaultTodoTab = "note:root:00000000-0000-4000-8000-000000000011";

export function initialNotebookSession(week:string) {
  return {
    orderedTabs:true,
    tabs:[defaultJournalTab,week,defaultTodoTab],
    active:defaultJournalTab,
    layouts:{
      [defaultJournalTab]:{...defaultNotebookLayout,title:"Tagebuch",kind:"journal" as const},
      [defaultTodoTab]:{...defaultNotebookLayout,title:"To-do-Liste",kind:"todo" as const},
    },
  };
}

export type NotebookTemplate = { id: string; name: string; layout: NotebookLayout };

export function applyNotebookTemplate(current: NotebookLayout, template: NotebookLayout): NotebookLayout {
  const columns = template.columns.map((column, index) => ({
    ...column, id: current.columns[index]?.id ?? crypto.randomUUID(),
    weeklySlot: current.columns[index]?.weeklySlot,
  }));
  return {...template, title:current.title, columns:[...columns, ...current.columns.slice(columns.length)]};
}

export const moodColors = ["#479763", "#dfb32e", "#de822d", "#cd5554"];
export const moodLabels = ["Gut", "Okay", "Schwierig", "Schlecht"];
export type NotebookMood = { date: string; score: number; reason: string };
export type NotebookLesson = { date: string; text: string };

// Shared slots identify the layout; each week keeps its own note IDs.
export function weeklyNotebookLayout(key: string, saved?: NotebookLayout, shared?: NotebookLayout): NotebookLayout {
  if (!/^week:\d{4}-\d{2}-\d{2}$/.test(key)) return saved ?? defaultNotebookLayout;
  const weekId = key.slice(5).replaceAll("-", "");
  const id = (slot: number) => slot === 1 ? "main" : `00000000-0000-4000-8000-${weekId}${String(slot).padStart(4, "0")}`;
  const layout = saved ?? defaultNotebookLayout;
  const withSlots = (columns: NotebookColumn[]) => columns.map((column, index) => ({
    ...column,
    weeklySlot: column.weeklySlot ?? index,
    weekday: column.weeklySlot === undefined && index > 0 && index < 8 ? index - 1 : column.weekday,
  }));
  const legacyColumns = layout.columns.filter(column => !column.planning);
  const legacyDefaults = withSlots([
    layout.columns.find(column => column.planning) ?? {id:id(0),planning:true},
    ...legacyColumns,
    ...Array.from({length:Math.max(0,7-legacyColumns.length)},(_,index)=>({id:id(legacyColumns.length+index+1)})),
  ]);
  const localColumns = layout.nextWeeklySlot === undefined ? legacyDefaults : layout.columns;
  const appearance = shared ?? layout;
  const columnIds = {...layout.weeklyColumnIds};
  for (const column of localColumns) {
    if (column.weeklySlot !== undefined) columnIds[column.weeklySlot] = column.id;
  }
  const columns = shared ? withSlots(shared.columns).map(column => ({
    ...column, id:columnIds[column.weeklySlot] ?? id(column.weeklySlot),
  })) : localColumns;
  return {
    ...layout, view:"week",
    rows:appearance.rows,
    color:appearance.color,
    design:appearance.design,
    features:{...appearance.features,weekdays:appearance.features?.weekdays ?? true,mood:appearance.features?.mood ?? true},
    columns,
    weeklyColumnIds:columnIds,
    nextWeeklySlot:Math.max(8,appearance.nextWeeklySlot ?? 0,...columns.map(column => (column.weeklySlot ?? 0)+1)),
  };
}

export function updateWeeklyNotebookLayout(previous: NotebookLayout, next: NotebookLayout): NotebookLayout {
  let nextSlot = previous.nextWeeklySlot ?? 8;
  const weeklyColumnIds = {...previous.weeklyColumnIds};
  const columns = next.columns.map(column => {
    const slot = column.weeklySlot ?? nextSlot++;
    weeklyColumnIds[slot] = column.id;
    return {...column, weeklySlot:slot};
  });
  return {...next, columns, weeklyColumnIds, nextWeeklySlot:nextSlot};
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
      orderedTabs: value.orderedTabs === true,
      tabs: Array.isArray(value.tabs) ? value.tabs.filter((key: unknown): key is string => typeof key === "string") as string[] : [],
      active: typeof value.active === "string" ? value.active as string : null,
      layouts: (value.layouts || {}) as Record<string, NotebookLayout>,
    };
  } catch {
    return { orderedTabs:false, tabs: [] as string[], active: null, layouts: {} as Record<string, NotebookLayout> };
  }
}
