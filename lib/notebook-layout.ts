export type NotebookColumn = { id: string; width?: number; title?: string };
export type NotebookLayout = {
  kind: "note" | "todo" | "weekly";
  view: "" | "week" | "month" | "year";
  color: string;
  design: "plain" | "lined" | "grid";
  columns: NotebookColumn[];
};

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
