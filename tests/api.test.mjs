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

test("Ten task colors persist and scheduling changes preserve task content", async () => {
  const todo = sample();
  try {
    for (const color of [
      "green",
      "blue",
      "purple",
      "orange",
      "pink",
      "red",
      "yellow",
      "teal",
      "indigo",
      "slate",
    ]) {
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
    assert.equal(saved.color, "slate");
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

test("multi-day creation is atomic, does not replace existing tasks and undoes together", async () => {
  const a = { ...sample(), plannedDate: "2026-10-05" },
    b = { ...sample(), plannedDate: "2026-10-06" };
  try {
    let result = await request("/api/todos", {
      action: "createMany",
      todos: [a, { ...b, title: "" }],
    });
    assert.equal(result.status, 400);
    const state = await request("/api/state");
    assert.ok(!state.data.todos.some((t) => t.id === a.id));
    result = await request("/api/todos", {
      action: "createMany",
      todos: [a, b],
    });
    assert.equal(result.status, 200);
    const created = result.data.todos.filter((t) =>
      [a.id, b.id].includes(t.id),
    );
    assert.equal(created.length, 2);
    assert.equal(
      (await request("/api/todos", { action: "createMany", todos: [a] }))
        .status,
      400,
    );
    result = await request("/api/todos", {
      action: "undo",
      changes: created.map((t) => ({ id: t.id, before: null, after: t })),
    });
    assert.equal(result.status, 200);
    assert.ok(!result.data.todos.some((t) => [a.id, b.id].includes(t.id)));
  } finally {
    for (const id of [a.id, b.id])
      await request("/api/todos", { action: "delete", id });
  }
});

test("week and month notes and advice histories are isolated", async () => {
  const keys = ["2098-01-06", "week:2098-01-06", "month:2098-01-01"];
  const original = (await request("/api/state")).data.dayNotes;
  try {
    for (const [i, date] of keys.entries())
      assert.equal(
        (await request("/api/notes", { date, content: `QA period ${i}` }))
          .status,
        200,
      );
    const state = (await request("/api/state")).data;
    for (const [i, date] of keys.entries()) {
      assert.equal(state.dayNotes[date], `QA period ${i}`);
      assert.equal(
        (await request("/api/day?date=" + encodeURIComponent(date))).status,
        200,
      );
    }
    assert.equal(
      (
        await request("/api/notes", {
          date: "month:2098-02-31",
          content: "bad",
        })
      ).status,
      400,
    );
  } finally {
    for (const date of keys)
      await request("/api/notes", { date, content: original[date] || "" });
  }
});
test("batch changes reject stale state atomically and undo group deletion", async () => {
  const a = sample(),
    b = sample();
  try {
    const saved = (
      await request("/api/todos", { action: "createMany", todos: [a, b] })
    ).data.todos.filter((t) => [a.id, b.id].includes(t.id));
    let r = await request("/api/todos", {
      action: "batch",
      changes: saved.map((t, i) => ({
        id: t.id,
        before: null,
        after: i ? { ...t, title: "stale" } : t,
      })),
    });
    assert.equal(r.status, 400);
    assert.equal(
      (await request("/api/state")).data.todos.filter((t) =>
        [a.id, b.id].includes(t.id),
      ).length,
      2,
    );
    r = await request("/api/todos", {
      action: "batch",
      changes: saved.map((t) => ({ id: t.id, before: null, after: t })),
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.deletedMany.length, 2);
    r = await request("/api/todos", {
      action: "undo",
      changes: saved.map((t) => ({ id: t.id, before: t, after: null })),
    });
    assert.equal(r.status, 200);
    assert.equal(
      r.data.todos.filter((t) => [a.id, b.id].includes(t.id)).length,
      2,
    );
  } finally {
    for (const id of [a.id, b.id])
      await request("/api/todos", { action: "delete", id });
  }
});

test("Wiederholungen übernehmen Uhrzeit und Dauer aus den aktuellen Details", async () => {
  const todo = {
    ...sample(),
    plannedDate: "2026-10-12",
    time: "",
    duration: null,
  };
  const ids = [];
  try {
    await request("/api/todos", { action: "save", todo });
    ids.push(todo.id);
    const r = await request("/api/todos", {
      action: "repeat",
      id: todo.id,
      todo: { ...todo, time: "13:30", duration: 90 },
      weekdays: [1],
      weeks: 4,
    });
    assert.equal(r.status, 200);
    const copies = r.data.todos.filter(
      (t) => t.title === todo.title && t.createdAt >= todo.createdAt,
    );
    for (const t of copies) if (t.id !== todo.id) ids.push(t.id);
    assert.equal(r.data.created, 4);
    assert.ok(copies.every((t) => t.time === "13:30" && t.duration === 90));
  } finally {
    for (const id of ids) await request("/api/todos", { action: "delete", id });
  }
});
test("Reiternamen, gelöschte Reiter und Essenswochen werden gespeichert", async () => {
  const before = (await request("/api/life")).data;
  try {
    let r = await request("/api/life", {
      ...before,
      labels: { ...before.labels, sport: "Bewegung" },
      hidden: [...before.hidden, "weather"],
      meals: [
        ...before.meals,
        {
          id: crypto.randomUUID(),
          day: "2026-10-11",
          name: "Mittagessen",
          calories: 650,
          quality: "balanced",
        },
      ],
    });
    assert.equal(r.status, 200);
    r = await request("/api/life");
    assert.equal(r.data.labels.sport, "Bewegung");
    assert.ok(r.data.hidden.includes("weather"));
    assert.equal(r.data.meals.at(-1).calories, 650);
    const invalid = await request("/api/life", {
      ...r.data,
      meals: [
        {
          id: "invalid",
          day: "2026-02-30",
          name: "x",
          calories: -1,
          quality: "balanced",
        },
      ],
    });
    assert.equal(invalid.status, 400);
  } finally {
    await request("/api/life", before);
  }
});

test("Termingruppen löschen und wiederherstellen, ohne doppelte Wiederholungen", async () => {
  const source = {
    ...sample(),
    plannedDate: "2026-10-12",
    time: "10:30",
    duration: 90,
  };
  await request("/api/todos", { action: "save", todo: source });
  const repeated = await request("/api/todos", {
    action: "repeat",
    id: source.id,
    weekdays: [0, 2],
    weeks: 4,
  });
  const group = repeated.data.todos
    .filter((t) => t.seriesId === source.id)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  assert.ok(group.length > 2);
  assert.ok(group.every((t) => t.time === "10:30"));
  const selected = group[2];
  const removed = await request("/api/todos", {
    action: "deleteSeries",
    id: selected.id,
    scope: "following",
  });
  assert.ok(
    removed.data.todos
      .filter((t) => t.seriesId === source.id)
      .every((t) => t.plannedDate < selected.plannedDate),
  );
  const restore = group
    .filter((t) => t.plannedDate >= selected.plannedDate)
    .map((t) => ({ id: t.id, before: t, after: null }));
  const restored = await request("/api/todos", {
    action: "undo",
    changes: restore,
  });
  assert.equal(restored.status, 200);
  const retry = await request("/api/todos", {
    action: "repeat",
    id: source.id,
    weekdays: [0, 2],
    weeks: 4,
  });
  assert.equal(retry.data.created, 0);
  await request("/api/todos", {
    action: "deleteSeries",
    id: source.id,
    scope: "all",
  });
});
test("Gewählte Gerichte und Drag-and-drop-Termine erfassen Essen samt Datum und Undo", async () => {
  const todo = {
    ...sample(),
    title: "Kochen: Vegetarian pasta",
    tags: ["Essen"],
    plannedDate: null,
  };
  const created = await request("/api/todos", { action: "save", todo });
  const saved = created.data.todos.find((t) => t.id === todo.id);
  const meal = created.data.lifeChange.after.meals.find(
    (m) => m.todoId === todo.id,
  );
  assert.equal(meal.diet, "vegetarian");
  assert.equal(meal.calories, null);
  const scheduled = await request("/api/todos", {
    action: "schedule",
    id: todo.id,
    plannedDate: "2026-10-15",
    time: "19:00",
    duration: 45,
  });
  assert.equal(
    scheduled.data.lifeChange.after.meals.find((m) => m.todoId === todo.id).day,
    "2026-10-15",
  );
  const undone = await request("/api/todos", {
    action: "undo",
    changes: [
      {
        id: todo.id,
        before: saved,
        after: scheduled.data.todos.find((t) => t.id === todo.id),
      },
    ],
    lifeChange: scheduled.data.lifeChange,
  });
  assert.equal(undone.status, 200);
  const life = (await request("/api/life")).data;
  assert.equal(life.meals.find((m) => m.todoId === todo.id).day, meal.day);
  await request("/api/todos", { action: "delete", id: todo.id });
  assert.ok(
    !(await request("/api/life")).data.meals.some((m) => m.todoId === todo.id),
  );
});

test("Kalender entfernen, per Verlauf wiederherstellen und erneut entfernen", async () => {
  const ics =
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:history-test\r\nDTSTART:20261015T100000Z\r\nDTEND:20261015T110000Z\r\nSUMMARY:History calendar\r\nEND:VEVENT\r\nEND:VCALENDAR";
  const imported = await request("/api/calendar", {
    action: "connect",
    name: "QA Kalenderverlauf",
    content: ics,
  });
  assert.equal(imported.status, 200);
  assert.ok(imported.data.historyToken);
  const connection = (await request("/api/state")).data.connections.find(
    (c) => c.name === "QA Kalenderverlauf",
  );
  const removed = await request("/api/calendar", {
    action: "disconnect",
    id: connection.id,
  });
  assert.ok(removed.data.historyToken);
  const restored = await request("/api/calendar", {
    action: "history",
    id: removed.data.historyToken,
    redo: false,
  });
  assert.equal(restored.status, 200);
  const state = (await request("/api/state")).data;
  assert.ok(state.connections.some((c) => c.id === connection.id));
  assert.ok(
    state.events.some(
      (e) => e.connectionId === connection.id && e.title === "History calendar",
    ),
  );
  const redone = await request("/api/calendar", {
    action: "history",
    id: removed.data.historyToken,
    redo: true,
  });
  assert.equal(redone.status, 200);
  assert.ok(
    !(await request("/api/state")).data.connections.some(
      (c) => c.id === connection.id,
    ),
  );
});

test("Inbox-Reihenfolge und Stundenrhythmus bleiben gespeichert und werden validiert", async () => {
  const original = (await request("/api/life")).data;
  const changed = {
    ...original,
    tabOrder: ["weather", "todo", "social", "food", "events", "sport"],
    rhythms: [
      ...original.rhythms,
      {
        id: crypto.randomUUID(),
        name: "Training",
        tabId: "sport",
        days: 7,
        target: 2.5,
        unit: "hours",
      },
    ],
  };
  try {
    assert.equal((await request("/api/life", changed)).status, 200);
    const actual = (await request("/api/life")).data;
    assert.deepEqual(actual.tabOrder, changed.tabOrder);
    assert.equal(actual.rhythms.at(-1).target, 2.5);
    assert.equal(actual.rhythms.at(-1).unit, "hours");
    assert.equal(
      (await request("/api/life", { ...changed, tabOrder: ["todo", "todo"] }))
        .status,
      400,
    );
  } finally {
    assert.equal((await request("/api/life", original)).status, 200);
  }
});

test("Reiter-Standardfarben werden gespeichert und ungültige Farben abgewiesen", async () => {
  const before = (await request("/api/life")).data;
  try {
    const changed = {
      ...before,
      tabSettings: {
        ...before.tabSettings,
        sport: { ...before.tabSettings.sport, defaultColor: "teal" },
      },
    };
    assert.equal((await request("/api/life", changed)).status, 200);
    assert.equal(
      (await request("/api/life")).data.tabSettings.sport.defaultColor,
      "teal",
    );
    assert.equal(
      (
        await request("/api/life", {
          ...changed,
          tabSettings: {
            ...changed.tabSettings,
            sport: { defaultColor: "invalid" },
          },
        })
      ).status,
      400,
    );
  } finally {
    await request("/api/life", before);
  }
});
