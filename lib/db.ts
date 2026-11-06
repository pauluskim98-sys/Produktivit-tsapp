import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { accountConfig, isGoogleSubject } from "./private-account.ts";
import { applyCalendarRules, type CalendarRule } from "./calendar/overrides.ts";
import { parseICS } from "./calendar/ics.ts";
import type {
  Todo,
  CalendarConnection,
  CalendarEvent,
  ChatMessage,
} from "./types";
const file =
  process.env.DATABASE_PATH || join(process.cwd(), "data", "raum.sqlite");
type DbContext = { database: DatabaseSync; path: string };
const globalDb = globalThis as typeof globalThis & { raumDb?: DatabaseSync; lifemapDbContext?: AsyncLocalStorage<DbContext>; lifemapSchemas?: Set<string> };
const context = globalDb.lifemapDbContext ??= new AsyncLocalStorage<DbContext>();
const schemas = globalDb.lifemapSchemas ??= new Set<string>();
export const USER = "local-user";
export function accountDataPath() {
  const current = context.getStore();
  if (current) return dirname(current.path);
  if (accountConfig().mode !== "local") throw new Error("Kein angemeldeter Datenbereich.");
  return dirname(file);
}
function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    if (!schemas.has(path)) {
      initialize(database);
      if (schemas.size >= 256) schemas.delete(schemas.values().next().value!);
      schemas.add(path);
    }
    return database;
  } catch (error) { database.close(); throw error; }
}
export async function withAccountDatabase<T>(subject:string, run:()=>T|Promise<T>) {
  if (!isGoogleSubject(subject)) throw new Error("Ungültiges Konto.");
  const key=createHash("sha256").update(subject).digest("hex");
  const path=join(dirname(file), "accounts",key,"raum.sqlite");
  const database=openDatabase(path);
  try { return await context.run({database,path},run); } finally { database.close(); }
}
export const db = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    const active = context.getStore()?.database;
    if (!active && accountConfig().mode !== "local") throw new Error("Kein angemeldeter Datenbereich.");
    const database = active || (globalDb.raumDb ??= openDatabase(file));
    const value = Reflect.get(database,prop,database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
function initialize(db: DatabaseSync) {
db.exec(`
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS User (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS Todo (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0, priority TEXT NOT NULL DEFAULT 'none', plannedDate TEXT, time TEXT NOT NULL DEFAULT '', deadline TEXT, duration INTEGER, position REAL NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS Subtask (id TEXT PRIMARY KEY, todoId TEXT NOT NULL REFERENCES Todo(id) ON DELETE CASCADE, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS Tag (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id), name TEXT NOT NULL, UNIQUE(userId, name));
CREATE TABLE IF NOT EXISTS TodoTag (todoId TEXT REFERENCES Todo(id) ON DELETE CASCADE, tagId TEXT REFERENCES Tag(id) ON DELETE CASCADE, PRIMARY KEY(todoId, tagId));
CREATE TABLE IF NOT EXISTS CalendarConnection (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id), name TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'ics', sourceType TEXT NOT NULL, source TEXT NOT NULL, color TEXT NOT NULL, lastSynced TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS CalendarEvent (id TEXT PRIMARY KEY, connectionId TEXT NOT NULL REFERENCES CalendarConnection(id) ON DELETE CASCADE, title TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, allDay INTEGER NOT NULL, location TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS TodoChat (id TEXT PRIMARY KEY, todoId TEXT NOT NULL UNIQUE REFERENCES Todo(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS TodoChatMessage (id TEXT PRIMARY KEY, chatId TEXT NOT NULL REFERENCES TodoChat(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS RepeatInstance (sourceId TEXT NOT NULL, date TEXT NOT NULL, todoId TEXT NOT NULL REFERENCES Todo(id) ON DELETE CASCADE, PRIMARY KEY(sourceId,date));
CREATE TABLE IF NOT EXISTS DayMessage (id TEXT PRIMARY KEY,date TEXT NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS PlannerMessage (id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS PlannerProposal (id TEXT PRIMARY KEY, items TEXT NOT NULL, accepted INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS DayNote (date TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id), content TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS CalendarTitleAlias (userId TEXT NOT NULL, originalTitle TEXT NOT NULL, title TEXT NOT NULL, PRIMARY KEY(userId,originalTitle));
CREATE TABLE IF NOT EXISTS CalendarHistory (id TEXT PRIMARY KEY, before TEXT NOT NULL, after TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS CalendarRule (connectionId TEXT NOT NULL REFERENCES CalendarConnection(id) ON DELETE CASCADE, kind TEXT NOT NULL, key TEXT NOT NULL, label TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '', hidden INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(connectionId,kind,key));
CREATE TABLE IF NOT EXISTS LifeState (id INTEGER PRIMARY KEY, content TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS todo_day ON Todo(userId, plannedDate, position);
CREATE INDEX IF NOT EXISTS calendar_start ON CalendarEvent(start);
`);
// Additive migration preserves existing calendars and tasks.
if (!(db.prepare("PRAGMA table_info(CalendarEvent)").all() as {name:string}[]).some((c)=>c.name==="seriesId")) {
  db.exec("ALTER TABLE CalendarEvent ADD COLUMN seriesId TEXT NOT NULL DEFAULT ''");
  const update=db.prepare("UPDATE CalendarEvent SET seriesId=? WHERE id=? AND connectionId=?");
  for(const connection of db.prepare("SELECT id,source FROM CalendarConnection WHERE sourceType='file'").all() as {id:string;source:string}[]) {
    try { for(const event of parseICS(connection.source,connection.id)) if(event.seriesId)update.run(event.seriesId,event.id,connection.id); } catch { /* Keep the original imported events. */ }
  }
}
const calendarColumns = new Set(
  (
    db.prepare("PRAGMA table_info(CalendarConnection)").all() as {
      name: string;
    }[]
  ).map((c) => c.name),
);
for (const [name, definition] of Object.entries({
  lastAttemptAt: "TEXT NOT NULL DEFAULT ''",
  lastError: "TEXT NOT NULL DEFAULT ''",
  syncLeaseUntil: "INTEGER NOT NULL DEFAULT 0",
  syncToken: "TEXT NOT NULL DEFAULT ''",
})) {
  if (!calendarColumns.has(name))
    db.exec(`ALTER TABLE CalendarConnection ADD COLUMN ${name} ${definition}`);
}
if (
  !(db.prepare("PRAGMA table_info(Todo)").all() as { name: string }[]).some(
    (c) => c.name === "color",
  )
)
  db.exec("ALTER TABLE Todo ADD COLUMN color TEXT NOT NULL DEFAULT 'green'");
if (
  !(db.prepare("PRAGMA table_info(Todo)").all() as { name: string }[]).some(
    (c) => c.name === "reminder",
  )
)
  db.exec("ALTER TABLE Todo ADD COLUMN reminder INTEGER NOT NULL DEFAULT 0");
if (
  !(db.prepare("PRAGMA table_info(Todo)").all() as { name: string }[]).some(
    (c) => c.name === "seriesId",
  )
) {
  db.exec("ALTER TABLE Todo ADD COLUMN seriesId TEXT NOT NULL DEFAULT ''");
  db.exec(
    "UPDATE Todo SET seriesId=COALESCE((SELECT sourceId FROM RepeatInstance WHERE todoId=Todo.id LIMIT 1), CASE WHEN EXISTS(SELECT 1 FROM RepeatInstance WHERE sourceId=Todo.id) THEN Todo.id ELSE '' END)",
  );
}
db.prepare("INSERT OR IGNORE INTO User (id,name,createdAt) VALUES (?,?,?)").run(
  USER,
  "Mein Raum",
  new Date().toISOString(),
);
for (const [name, definition] of [
  ["location", "TEXT NOT NULL DEFAULT ''"],
  ["travelMode", "TEXT NOT NULL DEFAULT ''"],
  ["travelBefore", "INTEGER NOT NULL DEFAULT 0"],
  ["travelAfter", "INTEGER NOT NULL DEFAULT 0"],
]) {
  if (
    !(db.prepare("PRAGMA table_info(Todo)").all() as { name: string }[]).some(
      (column) => column.name === name,
    )
  )
    db.exec(`ALTER TABLE Todo ADD COLUMN ${name} ${definition}`);
}
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function getTodos(): Todo[] {
  return (
    db
      .prepare(
        "SELECT * FROM Todo WHERE userId = ? ORDER BY position, createdAt",
      )
      .all(USER) as unknown as Todo[]
  ).map((t) => ({
    ...t,
    done: Boolean(t.done),
    reminder: Boolean(t.reminder),
    tags: (
      db
        .prepare(
          "SELECT name FROM Tag JOIN TodoTag ON Tag.id = TodoTag.tagId WHERE todoId = ? ORDER BY name",
        )
        .all(t.id) as { name: string }[]
    ).map((x) => x.name),
    subtasks: (
      db
        .prepare(
          "SELECT id,title,done FROM Subtask WHERE todoId = ? ORDER BY position",
        )
        .all(t.id) as unknown as Todo["subtasks"]
    ).map((s) => ({ ...s, done: Boolean(s.done) })),
  }));
}
export function putTodo(t: Todo) {
  db.prepare(
    `INSERT INTO Todo (id,userId,title,description,notes,done,priority,plannedDate,time,deadline,duration,position,createdAt,color,reminder,seriesId,location,travelBefore,travelAfter,travelMode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,notes=excluded.notes,done=excluded.done,priority=excluded.priority,plannedDate=excluded.plannedDate,time=excluded.time,deadline=excluded.deadline,duration=excluded.duration,position=excluded.position,color=excluded.color,reminder=excluded.reminder,seriesId=excluded.seriesId,location=excluded.location,travelBefore=excluded.travelBefore,travelAfter=excluded.travelAfter,travelMode=excluded.travelMode`,
  ).run(
    t.id,
    USER,
    t.title,
    t.description,
    t.notes,
    Number(t.done),
    t.priority,
    t.plannedDate,
    t.time,
    t.deadline,
    t.duration,
    t.position,
    t.createdAt,
    t.color || "green",
    Number(Boolean(t.reminder)),
    t.seriesId || "",
    t.location || "",
    t.travelBefore || 0,
    t.travelAfter || 0,
    t.travelMode || "",
  );
  db.prepare("DELETE FROM Subtask WHERE todoId = ?").run(t.id);
  t.subtasks.forEach((s, i) =>
    db
      .prepare(
        "INSERT INTO Subtask (id,todoId,title,done,position) VALUES (?,?,?,?,?)",
      )
      .run(s.id, t.id, s.title, Number(s.done), i),
  );
  db.prepare("DELETE FROM TodoTag WHERE todoId = ?").run(t.id);
  t.tags.forEach((name) => {
    db.prepare("INSERT OR IGNORE INTO Tag (id,userId,name) VALUES (?,?,?)").run(
      crypto.randomUUID(),
      USER,
      name,
    );
    const tag = db
      .prepare("SELECT id FROM Tag WHERE userId = ? AND name = ?")
      .get(USER, name) as { id: string };
    db.prepare("INSERT INTO TodoTag (todoId,tagId) VALUES (?,?)").run(
      t.id,
      tag.id,
    );
  });
}
export function getConnections(): CalendarConnection[] {
  return db
    .prepare(
      "SELECT id,name,provider,sourceType,color,lastSynced,lastAttemptAt,lastError FROM CalendarConnection WHERE userId = ?",
    )
    .all(USER) as unknown as CalendarConnection[];
}
export function getEvents(): CalendarEvent[] {
  const events = (
    db
      .prepare(
        "SELECT e.*, e.title AS originalTitle, COALESCE(a.title,e.title) AS title FROM CalendarEvent e LEFT JOIN CalendarTitleAlias a ON a.originalTitle=e.title AND a.userId=? ORDER BY e.start",
      )
      .all(USER) as unknown as CalendarEvent[]
  ).map((e) => ({ ...e, allDay: Boolean(e.allDay) }));
  return applyCalendarRules(events,db.prepare("SELECT r.* FROM CalendarRule r JOIN CalendarConnection c ON c.id=r.connectionId WHERE c.userId=? ORDER BY r.key").all(USER) as unknown as CalendarRule[]);
}
export function getMessages(todoId: string): ChatMessage[] {
  return db
    .prepare(
      "SELECT m.id,m.role,m.content,m.createdAt FROM TodoChatMessage m JOIN TodoChat c ON m.chatId = c.id WHERE c.todoId = ? ORDER BY m.createdAt, m.rowid",
    )
    .all(todoId) as unknown as ChatMessage[];
}
export function addMessage(
  todoId: string,
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  db.prepare("INSERT OR IGNORE INTO TodoChat (id,todoId) VALUES (?,?)").run(
    todoId,
    todoId,
  );
  const message = {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO TodoChatMessage (id,chatId,role,content,createdAt) VALUES (?,?,?,?,?)",
  ).run(message.id, todoId, role, content, message.createdAt);
  return message;
}
