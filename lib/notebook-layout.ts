export type NotebookFeatures = { todo?: boolean; weekdays?: boolean };
export type NotebookColumn = {
  id: string;
  width?: number;
  title?: string;
  features?: NotebookFeatures;
  color?: string;
  design?: NotebookLayout["design"];
};
export type NotebookLayout = {
  kind: "note" | "todo" | "weekly";
  features?: NotebookFeatures;
  view: "" | "week" | "month" | "year";
  color: string;
  design: "plain" | "lined" | "grid";
  columns: NotebookColumn[];
};

export function notebookFeatures(layout: NotebookLayout, column?: NotebookColumn) {
  return {
    todo: column?.features?.todo ?? layout.features?.todo ?? (layout.kind === "todo"),
    weekdays: column?.features?.weekdays ?? layout.features?.weekdays ?? (layout.kind === "weekly"),
  };
}

export const defaultNotebookLayout: NotebookLayout = {
  kind: "note", view: "", color: "", design: "plain", columns: [{ id: "main" }],
};

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
