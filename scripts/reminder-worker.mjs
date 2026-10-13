import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = process.env.DATABASE_PATH || join(root, "data", "raum.sqlite");
if (!existsSync(file)) process.exit(0);
const db = new DatabaseSync(file);
db.exec(
  "PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS ReminderDelivery(todoId TEXT NOT NULL,due TEXT NOT NULL,deliveredAt TEXT NOT NULL, PRIMARY KEY(todoId,due))",
);
const columns = db.prepare("PRAGMA table_info(Todo)").all();
if (!columns.some((c) => c.name === "reminder")) process.exit(0);
const now = Date.now();
for (const todo of db
  .prepare(
    "SELECT id,title,plannedDate,time FROM Todo WHERE reminder=1 AND done=0 AND plannedDate IS NOT NULL",
  )
  .all()) {
  const event = new Date(`${todo.plannedDate}T${todo.time || "09:00"}:00`);
  const due = new Date(event);
  due.setDate(due.getDate() - 1);
  if (now < due.getTime() || now >= event.getTime()) continue;
  const key = due.toISOString();
  if (
    db
      .prepare("SELECT 1 FROM ReminderDelivery WHERE todoId=? AND due=?")
      .get(todo.id, key)
  )
    continue;
  const message = `${todo.title}\n${event.toLocaleDateString("de-DE")} · ${todo.time || "09:00"}`;
  // Passing user text through argv avoids evaluating it as AppleScript.
  const script =
    'on run argv\ndisplay notification (item 1 of argv) with title "Raum · Morgen geplant" sound name "Glass"\nend run';
  try {
    if (process.argv.includes("--dry-run")) {
      console.log(JSON.stringify({ id: todo.id, due: key, title: todo.title }));
      continue;
    }
    execFileSync("/usr/bin/osascript", ["-e", script, message], {
      timeout: 15000,
      stdio: "pipe",
    });
    db.prepare(
      "INSERT OR IGNORE INTO ReminderDelivery(todoId,due,deliveredAt) VALUES(?,?,?)",
    ).run(todo.id, key, new Date().toISOString());
  } catch (e) {
    console.error("Erinnerung konnte nicht gesendet werden:", e.message);
  }
}
db.close();
