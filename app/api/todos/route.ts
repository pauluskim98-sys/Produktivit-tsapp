import { isDeepStrictEqual } from "node:util";
import { repeatDates } from "@/lib/repeat";
import {
  db,
  getTodos,
  putTodo,
  transaction,
  USER,
  getMessages,
  addMessage,
} from "@/lib/db";
import { validTodo, sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (body.action === "undo" || body.action === "batch") {
      if (!Array.isArray(body.changes) || body.changes.length > 10000)
        throw new Error("Ungültige Änderung.");
      const todos = getTodos();
      const changes = body.changes.map(
        (c: {
          id: string;
          before: unknown;
          after: unknown;
          messages?: { role: string; content: string }[];
        }) => {
          if (
            typeof c.id !== "string" ||
            !isDeepStrictEqual(
              todos.find((t) => t.id === c.id) || null,
              c.after,
            )
          )
            throw new Error(
              "Diese Aufgabe wurde inzwischen geändert. Rückgängig ist dafür nicht mehr möglich.",
            );
          const before = c.before === null ? null : validTodo(c.before);
          if (before && before.id !== c.id)
            throw new Error("Ungültige Änderung.");
          return { ...c, before };
        },
      );
      const deletedMany = changes
        .filter((c: { before: unknown }) => c.before === null)
        .map((c: { id: string }) => ({
          id: c.id,
          messages: getMessages(c.id),
        }));
      transaction(() => {
        for (const c of changes) {
          if (c.before) {
            putTodo(c.before);
            if (c.after === null)
              for (const m of (c.messages || []).slice(0, 200)) {
                if (
                  ["user", "assistant"].includes(m.role) &&
                  typeof m.content === "string" &&
                  m.content.length <= 30000
                )
                  addMessage(c.id, m.role as "user" | "assistant", m.content);
              }
          } else
            db.prepare("DELETE FROM Todo WHERE id=? AND userId=?").run(
              c.id,
              USER,
            );
        }
      });
      return Response.json({ todos: getTodos(), deletedMany });
    } else if (body.action === "createMany") {
      if (
        !Array.isArray(body.todos) ||
        body.todos.length < 1 ||
        body.todos.length > 7
      )
        throw new Error("Bitte einen Bereich innerhalb einer Woche wählen.");
      const todos = body.todos.map(validTodo);
      const existing = new Set(getTodos().map((t) => t.id));
      const ids = new Set(todos.map((t: ReturnType<typeof validTodo>) => t.id));
      if (
        ids.size !== todos.length ||
        todos.some((t: ReturnType<typeof validTodo>) => existing.has(t.id))
      )
        throw new Error("Diese Termine existieren bereits.");
      transaction(() => {
        for (const todo of todos) putTodo(todo);
      });
    } else if (body.action === "save") {
      const todo = validTodo(body.todo);
      transaction(() => putTodo(todo));
    } else if (body.action === "repeat") {
      const todo = getTodos().find((t) => t.id === body.id);
      if (!todo?.plannedDate)
        throw new Error("Zuerst einen Tag für die Aufgabe wählen.");
      const dates = repeatDates(todo.plannedDate, body.weekdays, body.weeks);
      let created = 0;
      transaction(() => {
        for (const date of dates) {
          if (
            db
              .prepare(
                "SELECT 1 FROM RepeatInstance WHERE sourceId=? AND date=?",
              )
              .get(todo.id, date)
          )
            continue;
          const id = crypto.randomUUID();
          putTodo({
            ...todo,
            id,
            plannedDate: date,
            done: false,
            createdAt: new Date().toISOString(),
            subtasks: todo.subtasks.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              done: false,
            })),
          });
          db.prepare(
            "INSERT INTO RepeatInstance(sourceId,date,todoId) VALUES (?,?,?)",
          ).run(todo.id, date, id);
          created++;
        }
      });
      return Response.json({ todos: getTodos(), created });
    } else if (body.action === "schedule") {
      const todo = getTodos().find((t) => t.id === body.id);
      if (!todo) throw new Error("Aufgabe nicht gefunden.");
      const updated = validTodo({
        ...todo,
        plannedDate: body.plannedDate,
        time: body.time,
        duration: body.duration,
      });
      transaction(() => putTodo(updated));
    } else if (body.action === "delete") {
      const todo = getTodos().find((t) => t.id === body.id);
      if (!todo)
        return Response.json(
          { error: "Aufgabe nicht gefunden." },
          { status: 404 },
        );
      const messages = getMessages(todo.id);
      db.prepare("DELETE FROM Todo WHERE id = ? AND userId = ?").run(
        todo.id,
        USER,
      );
      return Response.json({ todos: getTodos(), deleted: todo, messages });
    } else if (body.action === "restore") {
      const todo = validTodo(body.todo);
      if (getTodos().some((t) => t.id === todo.id))
        throw new Error("Aufgabe existiert bereits.");
      transaction(() => {
        putTodo(todo);
        for (const m of (body.messages || []).slice(0, 200)) {
          if (
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string" &&
            m.content.length <= 30000
          )
            addMessage(todo.id, m.role, m.content);
        }
      });
    } else if (body.action === "move") {
      const todos = getTodos();
      if (!Array.isArray(body.moves) || body.moves.length > 10000)
        throw new Error("Ungültige Reihenfolge.");
      const updates = body.moves.map(
        (m: {
          id: string;
          plannedDate: string | null;
          position: number;
          time?: string;
        }) => {
          const t = todos.find((t) => t.id === m.id);
          if (!t) throw new Error("Aufgabe nicht gefunden.");
          return validTodo({
            ...t,
            plannedDate: m.plannedDate,
            position: m.position,
            time: m.time === undefined ? t.time : m.time,
          });
        },
      );
      transaction(() => updates.forEach(putTodo));
    } else throw new Error("Unbekannte Aktion.");
    return Response.json({ todos: getTodos() });
  } catch (error) {
    return errorResponse(error);
  }
}
