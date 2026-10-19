"use client";
import { useAutosaveText } from "./use-autosave-text";
import { totalDuration } from "@/lib/schedule";
import { useDraggable } from "@dnd-kit/core";
import { periodRange } from "@/lib/calendar-interactions";
import { eventPresentation } from "@/lib/subjects";
import { CalendarOverview } from "./calendar-overview";
import type { Todo } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Plus, Copy, Settings2 } from "lucide-react";
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
import PeriodTask from "./period-task";
import { useDroppable } from "@dnd-kit/core";
import { useId } from "react";
export default function DayPanel({
  day,
  renderTasks,
  shelf,
  inline = false,
  onDay,
  state,
  onClose,
  onOpen,
  onAdd,
  onNote,
  onConnected,
  onExtend,
}: {
  renderTasks?: (content: React.ReactNode) => React.ReactNode;
  shelf?: React.ReactNode;
  onExtend?: (todo: Todo, days: string[]) => Promise<void>;
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
  const taskInputRef = useRef<HTMLInputElement>(null);
  const dropId = useId();
  const drop = useDroppable({
    id: `period-panel:${dropId}`,
    data: {
      kind: inline ? "inbox-return" : "periodpanel",
      day: range.start,
      period: day,
    },
  });
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
  const noteKey = inline ? "storage" : day;
  const noteLabel = inline
    ? "Notizen"
    : range.kind === "week"
      ? "Wochennotiz"
      : range.kind === "month"
        ? "Monatsnotiz"
        : range.kind === "year"
          ? "Jahresnotiz"
          : "Tagesnotiz";
  const tasks = state.todos.filter((t) =>
    t.plannedDate
      ? t.plannedDate >= range.start && t.plannedDate <= range.end
      : period &&
        !t.done &&
        (t.tags.find((x) => /^h:(week|month|year)$/.test(x)) || "h:week") ===
          `h:${range.kind}`,
  );
  const events = state.events.filter((e) =>
    range.days.some((d) => eventsForDay([e], d).length),
  );
  const [title, setTitle] = useState(""),
    [question, setQuestion] = useState(""),
    [questionOpen, setQuestionOpen] = useState(false),
    [messages, setMessages] = useState<
      { id: string; role: string; content: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [connect, setConnect] = useState(false),
    [copied, setCopied] = useState(false);
  const {
    text: note,
    setText: setNote,
    flush: saveNote,
    error: noteError,
  } = useAutosaveText(state.dayNotes[noteKey] || "", onNote);
  useEffect(() => {
    api(`/api/day?date=${day}`)
      .then((d) => setMessages(d.messages))
      .catch((e) => setError(e.message));
  }, [day]);
  const assessment = period
    ? [
        `${tasks.filter((t) => !t.done).length} offene Aufgaben im Zeitraum.`,
        `${tasks.reduce((n, t) => n + (t.time ? totalDuration(t) : 0), 0) / 60} Stunden für eigene Aufgaben eingeplant.`,
        `${range.days.filter((d) => !tasks.some((t) => t.plannedDate === d) && !events.some((e) => eventsForDay([e], d).length)).length} Tage ohne Einträge.`,
      ]
    : dayAssessment(tasks, events, day);
  async function close() {
    if (note === (state.dayNotes[noteKey] || "") || (await saveNote()))
      onClose();
  }
  async function ask(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (note !== (state.dayNotes[noteKey] || "") && !(await saveNote()))
        return;
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
  const taskContent = (
    <>
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
        <button
          type="button"
          aria-label="Aufgabe eingeben"
          onClick={() => taskInputRef.current?.focus()}
        >
          <Plus size={14} />
        </button>
        <input
          ref={taskInputRef}
          aria-label={`Aufgabe für ${label}`}
          placeholder="Aufgabe hinzufügen"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
        />
        <button disabled={busy || !title.trim()}>↵</button>
      </form>
      <div className="day-task-list">
        {[...tasks]
          .sort(
            (a, b) =>
              ({ high: 0, medium: 1, low: 2, none: 2 })[a.priority] -
                { high: 0, medium: 1, low: 2, none: 2 }[b.priority] ||
              a.position - b.position,
          )
          .map((t) => (
            <PeriodTask
              key={t.id}
              todo={t}
              onExtend={onExtend}
              onOpen={async (id) => {
                if (
                  note !== (state.dayNotes[noteKey] || "") &&
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
                state.connections.find((c) => c.id === e.connectionId)?.color,
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
    </>
  );
  return (
    <div
      className={inline ? "period-overview" : "detail-backdrop"}
      onMouseDown={(e) => {
        if (!inline && e.target === e.currentTarget) void close();
      }}
    >
      <section
        ref={drop.setNodeRef}
        className={`day-panel ${inline ? "inline-period-panel" : ""} ${drop.isOver ? "panel-drop-over" : ""}`}
        role={inline ? "region" : "dialog"}
        aria-modal={inline ? undefined : true}
        aria-label={inline ? "Ablage" : viewLabel}
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
            <div className="period-tasks-column">
              <h3>
                {inline ? "Ablage" : "Aufgaben"}{" "}
                {!inline && <span>{tasks.length}</span>}
              </h3>
              {renderTasks ? renderTasks(taskContent) : taskContent}
              {shelf}
            </div>
            <div className="period-notes-column">
              <h3>{noteLabel}</h3>
              <textarea
                className="day-notepad"
                onBlur={() => {
                  if (note !== (state.dayNotes[noteKey] || "")) void saveNote();
                }}
                aria-label={noteLabel}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                }}
                maxLength={10000}
                placeholder="Notizen, Gedanken, Ziele …"
              />
            </div>
          </div>
          {!inline && (
            <aside className="period-side">
              <CalendarOverview
                period={period ? day : `month:${day.slice(0, 7)}-01`}
                todos={state.todos}
                events={state.events}
                connections={state.connections}
                onPick={(d) => onDay?.(d)}
                onExtend={onExtend}
              />
            </aside>
          )}
          <div className="day-advice">
            <details className="compact-advice" open>
              <summary>
                <span>
                  <Sparkles size={14} /> KI & Überblick
                </span>
                <button
                  className="text-button advice-settings"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConnect(!connect);
                  }}
                >
                  <Settings2 size={13} /> Einstellungen
                </button>
              </summary>
              <div className="advice-prompts">
                {[
                  "Wo fehlen mir Pausen?",
                  "Plane mein wichtigstes Ziel",
                  "Was kann ich verschieben?",
                ].map((q) => (
                  <button key={q} onClick={() => setQuestion(q)}>
                    {q}
                  </button>
                ))}
              </div>
              {connect && (
                <AiConnection
                  onClose={() => setConnect(false)}
                  onConnected={onConnected}
                />
              )}
              {state.aiAvailable && (
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
              {(!inline || questionOpen || question) && (
                <form
                  data-escape-layer={inline ? "" : undefined}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask(question);
                  }}
                >
                  <button
                    hidden
                    data-close
                    type="button"
                    onClick={() => {
                      setQuestionOpen(false);
                      setQuestion("");
                    }}
                  >
                    Schließen
                  </button>
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
              )}
              <div className="chatgpt-handoff">
                {inline && !questionOpen && !question && (
                  <button
                    className="text-button"
                    onClick={() => setQuestionOpen(true)}
                  >
                    Frage stellen
                  </button>
                )}
                {!state.aiAvailable && (
                  <>
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
                    <a
                      href="https://chatgpt.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ChatGPT öffnen ↗
                    </a>
                  </>
                )}
              </div>
            </details>
          </div>
        </div>
        {(error || noteError) && (
          <p role="alert" className="ai-error">
            {error || noteError}
          </p>
        )}
      </section>
    </div>
  );
}
