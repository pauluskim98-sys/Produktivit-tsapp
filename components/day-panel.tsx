"use client";
import { useDraggable } from "@dnd-kit/core";
import { periodRange } from "@/lib/calendar-interactions";
import { eventPresentation } from "@/lib/subjects";
import { CalendarOverview } from "./calendar-overview";
import type { Todo } from "@/lib/types";
import { useEffect, useState } from "react";
import { X, Sparkles, Plus, Check, Copy } from "lucide-react";
import { AiConnection } from "./ai-planner";
import type { AppState } from "@/lib/types";
import { dayAssessment, eventsForDay } from "@/lib/day-assessment";
async function api(url: string, body?: unknown) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Anfrage fehlgeschlagen.");
  return d;
}
function PeriodTask({
  todo,
  onOpen,
}: {
  todo: Todo;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `period:${todo.id}`,
    data: { todoId: todo.id },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`day-task color-${todo.color || "green"}`}
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}
      onClick={() => onOpen(todo.id)}
    >
      <strong>{todo.title}</strong>
      <span>
        {todo.plannedDate} · {todo.time || "Ohne Zeit"}
      </span>
    </button>
  );
}
export default function DayPanel({
  day,
  inline = false,
  onDay,
  state,
  onClose,
  onOpen,
  onAdd,
  onNote,
  onConnected,
}: {
  inline?: boolean;
  onDay?: (day: string) => void;
  day: string;
  state: AppState;
  onClose: () => void;
  onOpen: (id: string) => void;
  onAdd: (title: string) => Promise<void>;
  onNote: (content: string) => Promise<void>;
  onConnected: () => void;
}) {
  const range = periodRange(day)!;
  const period = range.kind !== "day";
  const label =
    range.kind === "year"
      ? "Jahr"
      : range.kind === "week"
        ? "Woche"
        : range.kind === "month"
          ? "Monat"
          : "Tag";
  const viewLabel =
    range.kind === "week"
      ? "Wochenübersicht"
      : range.kind === "month"
        ? "Monatsübersicht"
        : range.kind === "year"
          ? "Jahresübersicht"
          : "Tagesübersicht";
  const noteLabel =
    range.kind === "week"
      ? "Wochennotiz"
      : range.kind === "month"
        ? "Monatsnotiz"
        : range.kind === "year"
          ? "Jahresnotiz"
          : "Tagesnotiz";
  const tasks = state.todos.filter(
    (t) =>
      t.plannedDate &&
      t.plannedDate >= range.start &&
      t.plannedDate <= range.end,
  );
  const events = state.events.filter((e) =>
    range.days.some((d) => eventsForDay([e], d).length),
  );
  const [title, setTitle] = useState(""),
    [note, setNote] = useState(state.dayNotes[day] || ""),
    [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<
      { id: string; role: string; content: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [connect, setConnect] = useState(false),
    [copied, setCopied] = useState(false),
    [noteSaved, setNoteSaved] = useState(false);
  useEffect(() => {
    api(`/api/day?date=${day}`)
      .then((d) => setMessages(d.messages))
      .catch((e) => setError(e.message));
  }, [day]);
  const assessment = period
    ? [
        `${tasks.filter((t) => !t.done).length} offene Aufgaben im Zeitraum.`,
        `${tasks.reduce((n, t) => n + (t.time ? t.duration || 60 : 0), 0) / 60} Stunden für eigene Aufgaben eingeplant.`,
        `${range.days.filter((d) => !tasks.some((t) => t.plannedDate === d) && !events.some((e) => eventsForDay([e], d).length)).length} Tage ohne Einträge.`,
      ]
    : dayAssessment(tasks, events, day);
  async function saveNote() {
    try {
      await onNote(note);
      setNoteSaved(true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function close() {
    if (note === (state.dayNotes[day] || "") || (await saveNote())) onClose();
  }
  async function ask(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (note !== (state.dayNotes[day] || "") && !(await saveNote())) return;
      const d = await api("/api/day", { date: day, message });
      setMessages(d.messages);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!inline && e.key === "Escape") {
        e.preventDefault();
        void close();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  const prompt = () =>
    `Hilf mir, meinen Zeitraum ${range.start} bis ${range.end} einzuschätzen. Gib kurze Gedanken und praktische Tipps. ${question}\nAufgaben: ${JSON.stringify(tasks.map((t) => ({ date: t.plannedDate, title: t.title, time: t.time, duration: t.duration, done: t.done })))}\nTermine: ${JSON.stringify(events.map((e) => ({ title: e.title, start: e.start, end: e.end })))}\nTagesnotiz: ${note}`;
  return (
    <div
      className={inline ? "period-overview" : "detail-backdrop"}
      onMouseDown={(e) => {
        if (!inline && e.target === e.currentTarget) void close();
      }}
    >
      <section
        className={`day-panel ${inline ? "inline-period-panel" : ""}`}
        role={inline ? "region" : "dialog"}
        aria-modal={inline ? undefined : true}
        aria-label={viewLabel}
      >
        <header>
          <h2>
            {period
              ? range.kind === "year"
                ? range.start.slice(0, 4)
                : range.kind === "month"
                  ? new Date(range.start + "T12:00:00").toLocaleDateString(
                      "de-DE",
                      { month: "long", year: "numeric" },
                    )
                  : `${new Date(range.start + "T12:00:00").toLocaleDateString("de-DE")} – ${new Date(range.end + "T12:00:00").toLocaleDateString("de-DE")}`
              : new Date(day + "T12:00:00").toLocaleDateString("de-DE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
          </h2>
          <button
            className="icon-button"
            aria-label={`${viewLabel} schließen`}
            onClick={() => void close()}
          >
            <X size={19} />
          </button>
        </header>
        <div className="day-panel-body">
          <div className="day-work">
            <h3>
              Aufgaben <span>{tasks.length}</span>
            </h3>
            <form
              className="quick-add"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!title.trim() || busy) return;
                setBusy(true);
                try {
                  await onAdd(title.trim());
                  setTitle("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={14} />
              <input
                aria-label={`Aufgabe für diesen ${label}`}
                placeholder="Aufgabe hinzufügen"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={500}
              />
              <button disabled={busy || !title.trim()}>↵</button>
            </form>
            <div className="day-task-list">
              {tasks.map((t) => (
                <PeriodTask
                  key={t.id}
                  todo={t}
                  onOpen={async (id) => {
                    if (
                      note !== (state.dayNotes[day] || "") &&
                      !(await saveNote())
                    )
                      return;
                    onOpen(id);
                  }}
                />
              ))}
              {(period ? [] : events).map((e) => (
                <div
                  className="day-import"
                  key={e.id}
                  style={{
                    borderLeftColor: eventPresentation(
                      e,
                      state.connections.find((c) => c.id === e.connectionId)
                        ?.color,
                    ).color,
                  }}
                >
                  <strong>{e.title}</strong>
                  <span>
                    {e.allDay
                      ? "Ganztägig"
                      : new Date(e.start).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                </div>
              ))}
            </div>
            <h3>{noteLabel}</h3>
            <textarea
              className="day-notepad"
              onBlur={() => {
                if (note !== (state.dayNotes[day] || "")) void saveNote();
              }}
              aria-label={noteLabel}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteSaved(false);
              }}
              maxLength={10000}
              placeholder="Notizen, Gedanken, Ziele …"
            />
            <button
              className="secondary-button"
              onClick={() => void saveNote()}
            >
              <Check size={14} />
              {noteSaved ? "Gespeichert" : "Notiz speichern"}
            </button>
          </div>
          <aside className="period-side">
            <CalendarOverview
              period={period ? day : `month:${day.slice(0, 7)}-01`}
              todos={state.todos}
              events={state.events}
              connections={state.connections}
              onPick={(d) => onDay?.(d)}
            />
          </aside>
          <div className="day-advice">
            <h3>
              <Sparkles size={16} />{" "}
              {range.kind === "week"
                ? "Wochenblick"
                : range.kind === "month"
                  ? "Monatsblick"
                  : range.kind === "year"
                    ? "Jahresblick"
                    : "Tagesblick"}
            </h3>
            <p className="assessment-label">Aus deinen Kalenderdaten</p>
            <ul>
              {assessment.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
            <h3>KI-Einschätzung</h3>
            {!state.aiAvailable ? (
              <div className="ai-unconnected">
                <span>Nicht verbunden</span>
                <button
                  className="text-button"
                  onClick={() => setConnect(!connect)}
                >
                  API-Verbindung einrichten
                </button>
                {connect && <AiConnection onConnected={onConnected} />}
              </div>
            ) : (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  void ask(
                    `Schätze diesen ${label} kurz ein: bis zu drei konkrete Tipps oder Gedanken.`,
                  )
                }
              >
                {label} einschätzen
              </button>
            )}
            {messages.map((m) => (
              <div className={`planning-message ${m.role}`} key={m.id}>
                <small>{m.role === "user" ? "Du" : "KI"}</small>
                <p>{m.content}</p>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
            >
              <textarea
                aria-label={`Frage zu ${label}`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Was könnte ich in diesem Zeitraum anders planen?`}
                maxLength={8000}
              />
              <button
                className="primary-button"
                disabled={!state.aiAvailable || busy || !question.trim()}
              >
                {busy ? "Denkt nach …" : "Fragen"}
              </button>
            </form>
            {!state.aiAvailable && (
              <div className="chatgpt-handoff">
                <button
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(prompt());
                      setCopied(true);
                    } catch {
                      setError("Kopieren wurde vom Browser blockiert.");
                    }
                  }}
                >
                  <Copy size={14} />
                  {copied ? "Für ChatGPT kopiert" : "Für ChatGPT kopieren"}
                </button>
                <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">
                  ChatGPT öffnen ↗
                </a>
              </div>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="ai-error">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
