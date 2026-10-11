import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
async function request(path, body, origin = base) {
  const res = await fetch(
    base + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify(body),
        }
      : {},
  );
  return { status: res.status, data: await res.json() };
}
const sample = () => ({
  id: crypto.randomUUID(),
  title: "API-Test: Planung",
  description: "Beschreibung",
  notes: "Notiz",
  done: false,
  priority: "high",
  plannedDate: null,
  time: "09:30",
  deadline: "2026-10-11",
  duration: 60,
  tags: ["Studium"],
  subtasks: [{ id: crypto.randomUUID(), title: "Schritt 1", done: false }],
  position: 1,
  createdAt: new Date().toISOString(),
});
test("CRUD, Planung, Reihenfolge, Undo und Validierung", async () => {
  const a = sample(),
    b = { ...sample(), title: "API-Test: Zweite Aufgabe" };
  const ids = [a.id, b.id];
  try {
    let result = await request("/api/todos", { action: "save", todo: a });
    assert.equal(result.status, 200);
    assert.equal(
      result.data.todos.find((t) => t.id === a.id).plannedDate,
      null,
    );
    await request("/api/todos", { action: "save", todo: b });
    result = await request("/api/todos", {
      action: "move",
      moves: [
        { id: a.id, plannedDate: "2026-10-09", position: 0 },
        { id: b.id, plannedDate: "2026-10-09", position: 1 },
      ],
    });
    assert.equal(result.status, 200);
    let saved = result.data.todos.find((t) => t.id === a.id);
    assert.equal(saved.deadline, "2026-10-11");
    assert.equal(saved.plannedDate, "2026-10-09");
    assert.equal(saved.subtasks.length, 1);
    result = await request("/api/todos", {
      action: "save",
      todo: { ...saved, done: true, title: "API-Test: Erledigt" },
    });
    assert.equal(result.data.todos.find((t) => t.id === a.id).done, true);
    result = await request("/api/todos", { action: "delete", id: a.id });
    assert.equal(result.status, 200);
    assert.ok(!result.data.todos.some((t) => t.id === a.id));
    result = await request("/api/todos", {
      action: "restore",
      todo: result.data.deleted,
      messages: result.data.messages,
    });
    assert.equal(result.status, 200);
    assert.equal(
      result.data.todos.find((t) => t.id === a.id).subtasks[0].title,
      "Schritt 1",
    );
    result = await request("/api/todos", {
      action: "save",
      todo: { ...a, title: " " },
    });
    assert.equal(result.status, 400);
    result = await request("/api/todos", {
      action: "save",
      todo: { ...a, plannedDate: "2026-02-30" },
    });
    assert.equal(result.status, 400);
    result = await request(
      "/api/todos",
      { action: "save", todo: a },
      "https://malicious.example",
    );
    assert.equal(result.status, 400);
    result = await request("/api/state");
    assert.equal(result.status, 200);
    assert.equal(result.data.todos.filter((t) => ids.includes(t.id)).length, 2);
  } finally {
    for (const id of ids) await request("/api/todos", { action: "delete", id });
  }
});
test("ICS: Serientermine, Ausnahmen, Zeitzone, Ganztag und Entfernen", async () => {
  const before = (await request("/api/state")).data.connections.map(
    (c) => c.id,
  );
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Raum//Test//DE",
    "BEGIN:VEVENT",
    "UID:raum-recurrent-test",
    "DTSTART;TZID=Europe/Berlin:20261009T090000",
    "DTEND;TZID=Europe/Berlin:20261009T100000",
    "RRULE:FREQ=DAILY;COUNT=3",
    "EXDATE;TZID=Europe/Berlin:20261010T090000",
    "SUMMARY:API-Test: Seminar",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:raum-recurrent-test",
    "RECURRENCE-ID;TZID=Europe/Berlin:20261011T090000",
    "DTSTART;TZID=Europe/Berlin:20261011T110000",
    "DTEND;TZID=Europe/Berlin:20261011T120000",
    "SUMMARY:API-Test: Seminar verschoben",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:raum-allday-test",
    "DTSTART;VALUE=DATE:20261009",
    "DTEND;VALUE=DATE:20261011",
    "SUMMARY:API-Test: Freie Tage",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  try {
    const result = await request("/api/calendar", {
      action: "connect",
      name: "API-Test: Kalender",
      content,
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.count, 3);
    const state = (await request("/api/state")).data;
    const connection = state.connections.find((c) => !before.includes(c.id));
    assert.ok(connection);
    const events = state.events.filter((e) => e.connectionId === connection.id);
    assert.ok(events.some((e) => e.start === "2026-10-09T07:00:00.000Z"));
    assert.ok(events.some((e) => e.start === "2026-10-11T09:00:00.000Z"));
    assert.ok(
      events.some(
        (e) => e.allDay && e.start === "2026-10-09" && e.end === "2026-10-11",
      ),
    );
    const sync = await request("/api/calendar", {
      action: "sync",
      id: connection.id,
    });
    assert.equal(sync.data.count, 3);
    assert.equal(
      (await request("/api/state")).data.events.filter(
        (e) => e.connectionId === connection.id,
      ).length,
      3,
    );
    assert.equal(
      (
        await request("/api/calendar", {
          action: "connect",
          name: "Ungültig",
          content: "not ical",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/calendar", {
          action: "connect",
          name: "Lokal",
          url: "https://127.0.0.1/calendar.ics",
        })
      ).status,
      400,
    );
  } finally {
    const connections = (await request("/api/state")).data.connections;
    for (const c of connections.filter((c) => !before.includes(c.id)))
      await request("/api/calendar", { action: "disconnect", id: c.id });
  }
});
test("KI-Konfiguration wird ohne Schlüssel klar gemeldet; Chat bleibt unverändert", async () => {
  const state = (await request("/api/state")).data;
  if (state.aiAvailable) return;
  const todo = sample();
  await request("/api/todos", { action: "save", todo });
  try {
    assert.equal(
      (
        await request("/api/chat", {
          todoId: todo.id,
          message: "In Schritte zerlegen",
        })
      ).status,
      503,
    );
    assert.deepEqual(
      (await request("/api/chat?todoId=" + todo.id)).data.messages,
      [],
    );
  } finally {
    await request("/api/todos", { action: "delete", id: todo.id });
  }
});

test("Five task colors persist and scheduling changes preserve task content", async () => {
  const todo = sample();
  try {
    for (const color of ["green", "blue", "purple", "orange", "pink"]) {
      const r = await request("/api/todos", {
        action: "save",
        todo: { ...todo, color },
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.todos.find((t) => t.id === todo.id).color, color);
    }
    const changed = await request("/api/todos", {
      action: "schedule",
      id: todo.id,
      plannedDate: "2026-10-06",
      time: "10:15",
      duration: 105,
    });
    const saved = changed.data.todos.find((t) => t.id === todo.id);
    assert.equal(saved.time, "10:15");
    assert.equal(saved.duration, 105);
    assert.equal(saved.color, "pink");
    assert.deepEqual(saved.subtasks, todo.subtasks);
    const state = await request("/api/state");
    assert.equal(state.data.todos.find((t) => t.id === todo.id).duration, 105);
    assert.equal(
      (
        await request("/api/todos", {
          action: "save",
          todo: { ...todo, color: "invalid" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/todos", {
          action: "schedule",
          id: todo.id,
          plannedDate: "2026-10-06",
          time: "24:30",
          duration: 90,
        })
      ).status,
      400,
    );
    const moved = await request("/api/todos", {
      action: "move",
      moves: [{ id: todo.id, plannedDate: null, position: 1, time: "" }],
    });
    assert.equal(moved.data.todos.find((t) => t.id === todo.id).time, "");
  } finally {
    await request("/api/todos", { action: "delete", id: todo.id });
  }
});

test("Undo restores notes, copies, edited times and deleted chat; conflicts do not overwrite newer edits", async () => {
  const t = {
    ...sample(),
    notes: "Notizen bleiben erhalten",
    time: "10:00",
    plannedDate: "2026-10-06",
  };
  let id = t.id;
  try {
    let r = await request("/api/todos", { action: "save", todo: t });
    let before = r.data.todos.find((x) => x.id === id);
    r = await request("/api/todos", {
      action: "schedule",
      id,
      plannedDate: "2026-10-07",
      time: "11:00",
      duration: 90,
    });
    let after = r.data.todos.find((x) => x.id === id);
    r = await request("/api/todos", {
      action: "undo",
      changes: [{ id, before, after }],
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.todos.find((x) => x.id === id).notes, t.notes);
    assert.equal(r.data.todos.find((x) => x.id === id).time, "10:00");
    const deleted = await request("/api/todos", { action: "delete", id });
    r = await request("/api/todos", {
      action: "undo",
      changes: [
        {
          id,
          before,
          after: null,
          messages: [{ role: "user", content: "Meine Frage" }],
        },
      ],
    });
    assert.equal(r.status, 200);
    assert.equal(
      (await request("/api/chat?todoId=" + id)).data.messages[0].content,
      "Meine Frage",
    );
    r = await request("/api/todos", {
      action: "save",
      todo: { ...before, title: "Neuere Änderung" },
    });
    assert.equal(
      (
        await request("/api/todos", {
          action: "undo",
          changes: [{ id, before: null, after: before }],
        })
      ).status,
      400,
    );
    after = r.data.todos.find((x) => x.id === id);
    r = await request("/api/todos", {
      action: "undo",
      changes: [{ id, before: null, after }],
    });
    assert.equal(r.status, 200);
    assert.ok(!r.data.todos.some((x) => x.id === id));
  } finally {
    await request("/api/todos", { action: "delete", id });
  }
});
