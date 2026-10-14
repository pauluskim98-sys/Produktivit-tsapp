import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { db, getTodos, putTodo, transaction } from "./db";
import {
  mapTodoistTask,
  mergeTodoistTask,
  type TodoistTask,
} from "./todoist-mapping";
import type { Todo } from "./types";
const configFile = join(
  dirname(process.env.DATABASE_PATH || join(process.cwd(), "data/raum.sqlite")),
  "todoist-config.json",
);
function config(): {
  token?: string;
  lastSync?: string;
  error?: string;
  revision?: string;
  disabled?: boolean;
} {
  try {
    return JSON.parse(readFileSync(configFile, "utf8"));
  } catch {
    return {};
  }
}
function saveConfig(value: ReturnType<typeof config>) {
  mkdirSync(dirname(configFile), { recursive: true });
  writeFileSync(configFile + ".tmp", JSON.stringify(value), { mode: 0o600 });
  chmodSync(configFile + ".tmp", 0o600);
  renameSync(configFile + ".tmp", configFile);
}
export function todoistStatus() {
  const c = config();
  return {
    connected: !c.disabled && Boolean(c.token || process.env.TODOIST_API_TOKEN),
    lastSync: c.lastSync || "",
    error: c.error || "",
  };
}
export function disconnectTodoist() {
  saveConfig({ disabled: true, revision: crypto.randomUUID() });
}
const shared = globalThis as unknown as {
  todoistSync?: Promise<number>;
  todoistTimer?: ReturnType<typeof setInterval>;
};
async function fetchTasks(token: string): Promise<TodoistTask[]> {
  const tasks: TodoistTask[] = [];
  let cursor = "";
  const seen = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const url = new URL("https://api.todoist.com/api/v1/tasks");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? "Todoist hat das Token nicht akzeptiert."
          : "Todoist ist gerade nicht erreichbar. Vorhandene Aufgaben bleiben erhalten.",
      );
    const data = await response.json();
    if (!Array.isArray(data.results))
      throw new Error("Todoist lieferte keine gültige Aufgabenliste.");
    tasks.push(...data.results);
    cursor = data.next_cursor || "";
    if (!cursor) return tasks;
    if (seen.has(cursor))
      throw new Error(
        "Todoist-Synchronisierung konnte nicht vollständig gelesen werden.",
      );
    seen.add(cursor);
  }
  throw new Error(
    "Todoist enthält mehr Aufgaben als derzeit auf einmal synchronisiert werden können.",
  );
}
export function importTodoistTasks(tasks: TodoistTask[]) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS TodoistImport (remoteId TEXT PRIMARY KEY, todoId TEXT NOT NULL, snapshot TEXT NOT NULL)",
  );
  const existing = getTodos(),
    now = new Date().toISOString();
  let count = 0;
  transaction(() => {
    for (const task of tasks) {
      if (
        !task.id ||
        !/^[a-zA-Z0-9-]{1,65}$/.test(task.id) ||
        !task.content?.trim() ||
        task.is_deleted ||
        task.is_uncompletable
      )
        continue;
      const row = db
        .prepare("SELECT todoId,snapshot FROM TodoistImport WHERE remoteId=?")
        .get(task.id) as { todoId: string; snapshot: string } | undefined;
      const mapped = mapTodoistTask(task, existing.length + count + 1, now),
        local = existing.find((t) => t.id === (row?.todoId || mapped.id));
      if (!row || local) {
        putTodo(
          local && row
            ? mergeTodoistTask(local, JSON.parse(row.snapshot), mapped)
            : local
              ? local
              : mapped,
        );
        count++;
      }
      db.prepare(
        "INSERT INTO TodoistImport(remoteId,todoId,snapshot) VALUES(?,?,?) ON CONFLICT(remoteId) DO UPDATE SET snapshot=excluded.snapshot",
      ).run(task.id, mapped.id, JSON.stringify(mapped));
    }
    const active = new Set(tasks.map((t) => t.id));
    for (const row of db
      .prepare("SELECT remoteId,todoId,snapshot FROM TodoistImport")
      .all() as { remoteId: string; todoId: string; snapshot: string }[]) {
      if (active.has(row.remoteId)) continue;
      const local = existing.find((t) => t.id === row.todoId);
      if (local && !local.done) putTodo({ ...local, done: true });
      db.prepare("UPDATE TodoistImport SET snapshot=? WHERE remoteId=?").run(
        JSON.stringify({ ...JSON.parse(row.snapshot), done: true }),
        row.remoteId,
      );
    }
  });
  return count;
}
export function syncTodoist(token?: string): Promise<number> {
  if (shared.todoistSync)
    return token
      ? Promise.reject(
          new Error("Ein Abgleich läuft bereits. Bitte kurz warten."),
        )
      : shared.todoistSync;
  const old = config(),
    key = token || old.token || process.env.TODOIST_API_TOKEN;
  if (!key || (!token && old.disabled)) return Promise.resolve(0);
  const run = (async () => {
    try {
      const tasks = await fetchTasks(key);
      if (config().revision !== old.revision)
        throw new Error("Die Todoist-Verbindung wurde inzwischen geändert.");
      const count = importTodoistTasks(tasks);
      saveConfig({
        ...old,
        ...(token ? { token } : {}),
        disabled: false,
        lastSync: new Date().toISOString(),
        error: "",
      });
      return count;
    } catch (error) {
      if (!token && config().revision === old.revision)
        saveConfig({
          ...old,
          error:
            error instanceof Error
              ? error.message
              : "Todoist-Synchronisierung fehlgeschlagen.",
        });
      throw error;
    }
  })();
  shared.todoistSync = run;
  void run
    .finally(() => {
      shared.todoistSync = undefined;
    })
    .catch(() => {});
  return run;
}
export function startTodoistScheduler() {
  if (shared.todoistTimer) return;
  shared.todoistTimer = setInterval(() => {
    void syncTodoist().catch(() => {});
  }, 300000);
  shared.todoistTimer.unref();
  void syncTodoist().catch(() => {});
}
