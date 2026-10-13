import { db, getEvents, getTodos, putTodo, transaction, USER } from "@/lib/db";
import { sameOrigin, errorResponse } from "@/lib/validation";
import type { Todo } from "@/lib/types";
import { isDeepStrictEqual } from "node:util";
export const runtime = "nodejs";
type Snapshot = {
  todos: { id: string; title: string }[];
  aliases: { originalTitle: string; title: string | null }[];
};
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const todos = getTodos();
    const alias = (title: string) =>
      (
        db
          .prepare(
            "SELECT title FROM CalendarTitleAlias WHERE userId=? AND originalTitle=?",
          )
          .get(USER, title) as { title: string } | undefined
      )?.title ?? null;
    let before: Snapshot, after: Snapshot;
    if (body.action === "rename") {
      if (
        typeof body.from !== "string" ||
        typeof body.to !== "string" ||
        !body.to.trim() ||
        body.to.length > 500
      )
        throw new Error("Ungültiger Name.");
      const keys = [
        ...new Set(
          getEvents()
            .filter((e) => e.title === body.from)
            .map((e) => e.originalTitle || e.title),
        ),
      ];
      before = {
        todos: todos
          .filter((t) => t.title === body.from)
          .map((t) => ({ id: t.id, title: t.title })),
        aliases: keys.map((originalTitle) => ({
          originalTitle,
          title: alias(originalTitle),
        })),
      };
      after = {
        todos: before.todos.map((t) => ({ ...t, title: body.to.trim() })),
        aliases: keys.map((originalTitle) => ({
          originalTitle,
          title: body.to.trim(),
        })),
      };
    } else if (body.action === "restore") {
      before = body.expected;
      after = body.snapshot;
      for (const snapshot of [before, after]) {
        if (
          !Array.isArray(snapshot?.todos) ||
          !Array.isArray(snapshot?.aliases) ||
          snapshot.todos.length > 10000 ||
          snapshot.aliases.length > 10000
        )
          throw new Error("Ungültige Änderung.");
        if (
          snapshot.todos.some(
            (t) =>
              typeof t.id !== "string" ||
              typeof t.title !== "string" ||
              !t.title.trim() ||
              t.title.length > 500,
          ) ||
          snapshot.aliases.some(
            (a) =>
              typeof a.originalTitle !== "string" ||
              a.originalTitle.length > 2000 ||
              (a.title !== null &&
                (typeof a.title !== "string" ||
                  !a.title.trim() ||
                  a.title.length > 500)),
          )
        )
          throw new Error("Ungültige Änderung.");
      }
      if (
        !isDeepStrictEqual(
          before.todos.map((t) => t.id).sort(),
          after.todos.map((t) => t.id).sort(),
        ) ||
        !isDeepStrictEqual(
          before.aliases.map((a) => a.originalTitle).sort(),
          after.aliases.map((a) => a.originalTitle).sort(),
        )
      )
        throw new Error("Ungültige Änderung.");
      if (
        before.todos.some(
          (t) => todos.find((x) => x.id === t.id)?.title !== t.title,
        ) ||
        before.aliases.some((a) => alias(a.originalTitle) !== a.title)
      )
        throw new Error("Der Name wurde inzwischen geändert.");
    } else throw new Error("Unbekannte Aktion.");
    transaction(() => {
      for (const item of after.todos) {
        const todo = todos.find((t) => t.id === item.id);
        if (todo) putTodo({ ...todo, title: item.title } as Todo);
      }
      for (const item of after.aliases) {
        if (item.title === null)
          db.prepare(
            "DELETE FROM CalendarTitleAlias WHERE userId=? AND originalTitle=?",
          ).run(USER, item.originalTitle);
        else
          db.prepare(
            "INSERT INTO CalendarTitleAlias(userId,originalTitle,title) VALUES(?,?,?) ON CONFLICT(userId,originalTitle) DO UPDATE SET title=excluded.title",
          ).run(USER, item.originalTitle, item.title);
      }
    });
    return Response.json({ before, after });
  } catch (error) {
    return errorResponse(error);
  }
}
