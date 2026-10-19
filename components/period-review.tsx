"use client";
import { useCallback, useEffect, useId, useState, useRef } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type { AppState } from "@/lib/types";
import type { LifeState } from "@/lib/life";
import type { TaskColor } from "@/lib/task-colors";
import { dateKey, addDays, parseDate } from "@/lib/dates";
import { goalProgress, goalRange, goalTarget } from "@/lib/goals";
import { lifeTabs } from "@/lib/life-tabs";
import {
  dueReviews,
  nextReviewPeriod,
  reviewKey,
  type ReviewPeriod,
} from "@/lib/period-review";
import { freeTime } from "@/lib/free-time";
import GoalsPanel from "./goals-panel";
import CategoryIcon from "./category-icon";
import { useDialog } from "./use-dialog";
const number = (v: number) =>
  v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const format = (date: string) =>
  parseDate(date).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });
export default function PeriodReview({
  state,
  ready,
  onAdd,
}: {
  state: AppState;
  ready: boolean;
  onAdd: (
    title: string,
    date: string,
    tags: string[],
    color?: TaskColor,
  ) => Promise<void>;
}) {
  const [periods, setPeriods] = useState<ReviewPeriod[]>([]),
    [index, setIndex] = useState(0),
    [automatic, setAutomatic] = useState(false);
  const [life, setLife] = useState<LifeState | null>(null),
    [error, setError] = useState("");
  const [category, setCategory] = useState("todo"),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false);
  const seen = useRef(new Set<string>());
  const id = useId(),
    period = periods[index];
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/life");
      if (!r.ok) throw new Error();
      setLife(await r.json());
      setError("");
    } catch {
      setError("Deine Ziele konnten nicht geladen werden.");
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      if (
        document.visibilityState === "hidden" ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const due = dueReviews().filter((p) => {
        if (seen.current.has(reviewKey(p))) return false;
        try {
          return !localStorage.getItem(`lifemap-review:${reviewKey(p)}`);
        } catch {
          return true;
        }
      });
      if (due.length) {
        setAutomatic(true);
        setIndex(0);
        setPeriods(due);
      }
    };
    const open = (event: Event) => {
      setAutomatic(false);
      const { anchor = dateKey(new Date()), kind = "week" } =
        (event as CustomEvent).detail || {};
      setPeriods([
        {
          anchor,
          kind: kind === "month" || kind === "year" ? "month" : "week",
        },
      ]);
      setIndex(0);
    };
    const initial = setTimeout(check, 500);
    const retry = setInterval(check, 15000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("lifemap-review", open);
    return () => {
      clearTimeout(initial);
      clearInterval(retry);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("lifemap-review", open);
    };
  }, [ready]);
  useEffect(() => {
    if (!period) return;
    void load();
    window.addEventListener("raum-life-changed", load);
    window.addEventListener("raum-data-changed", load);
    return () => {
      window.removeEventListener("raum-life-changed", load);
      window.removeEventListener("raum-data-changed", load);
    };
  }, [!!period, load]);
  const close = useCallback(() => {
    const dueNow = new Set(dueReviews().map(reviewKey));
    for (const p of periods) {
      if (!automatic && !dueNow.has(reviewKey(p))) continue;
      seen.current.add(reviewKey(p));
      try {
        localStorage.setItem(`lifemap-review:${reviewKey(p)}`, "1");
      } catch {}
    }
    setPeriods([]);
    setTitle("");
  }, [periods, automatic]);
  useDialog(!!period, period ? reviewKey(period) : "");
  useEffect(() => {
    if (!period) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [period, close]);
  if (!period) return null;
  const range = goalRange(period.anchor, period.kind),
    next = nextReviewPeriod(period),
    nextRange = goalRange(next, period.kind);
  const tasks = state.todos.filter(
    (t) =>
      t.plannedDate &&
      t.plannedDate >= range.start &&
      t.plannedDate <= range.end,
  );
  const done = tasks.filter((t) => t.done).length;
  const days: string[] = [];
  for (
    let d = parseDate(range.start);
    dateKey(d) <= range.end;
    d = addDays(d, 1)
  )
    days.push(dateKey(d));
  const time = freeTime(days, state.todos, state.events);
  const tabs = life ? lifeTabs(life) : [];
  const categories = life
    ? [
        ...tabs
          .filter(([key]) => !["food", "weather", "goals"].includes(key))
          .map(([id, name]) => ({ id, name })),
        ...(life.goalCategories || []),
      ].filter((g) => !life.hiddenGoalCategories?.includes(g.id))
    : [];
  const goals = life
    ? categories.flatMap((g) => {
        const target = goalTarget(life, g.id, period.kind, period.anchor);
        return target
          ? [
              {
                ...g,
                target,
                progress: goalProgress(
                  g,
                  target,
                  state.todos,
                  state.events,
                  range,
                  new Date(),
                  life.rhythms,
                ),
              },
            ]
          : [];
      })
    : [];
  const reached = goals.filter(
    (g) => g.progress.completedPercent >= 100,
  ).length;
  const percent = goals.length
    ? Math.round(
        goals.reduce((sum, g) => sum + g.progress.completedPercent, 0) /
          goals.length,
      )
    : tasks.length
      ? Math.round((done / tasks.length) * 100)
      : 0;
  const nextTasks = state.todos.filter(
    (t) =>
      t.plannedDate &&
      t.plannedDate >= nextRange.start &&
      t.plannedDate <= nextRange.end,
  );
  const save = async (nextLife: LifeState) => {
    try {
      const r = await fetch("/api/life", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextLife),
      });
      if (!r.ok) throw new Error();
      setLife(await r.json());
      setError("");
      window.dispatchEvent(new Event("raum-life-changed"));
      return true;
    } catch {
      setError("Die Änderung konnte nicht gespeichert werden.");
      return false;
    }
  };
  return (
    <div
      className="period-review-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="period-review-dialog"
        data-escape-layer
      >
        <header className="review-topline">
          <span>
            <Sparkles size={17} /> Dein Rückblick
          </span>
          <nav aria-label="Rückblick-Zeitraum">
            {periods.map((p, i) => (
              <button
                key={reviewKey(p)}
                aria-pressed={index === i}
                onClick={() => {
                  setIndex(i);
                  setTitle("");
                }}
              >
                {p.kind === "week" ? "Woche" : "Monat"}
              </button>
            ))}
          </nav>
          <button
            className="icon-button"
            data-initial-focus
            data-close
            aria-label="Rückblick schließen"
            disabled={busy}
            onClick={close}
          >
            <X size={19} />
          </button>
        </header>
        <div className="review-layout">
          <aside className="review-reflection">
            <span className="review-eyebrow">
              {format(range.start)} – {format(range.end)}
            </span>
            <h2 id={id}>
              {period.kind === "week" ? "Deine Woche." : "Dein Monat."}
              <br />
              <em>Schau, was bleibt.</em>
            </h2>
            <div
              className={`review-ring ${percent >= 100 ? "is-complete" : ""}`}
              role="img"
              aria-label={`${percent} Prozent Zielerreichung`}
              style={{
                background: `conic-gradient(var(--review-accent) ${percent}%, #ffffff19 0)`,
              }}
            >
              <div>
                <strong>
                  {percent}
                  <small>%</small>
                </strong>
                <span>{goals.length ? "Zielerreichung" : "erledigt"}</span>
              </div>
              {percent >= 100 && (
                <Check className="review-ring-check" size={24} />
              )}
            </div>
            <div className="review-metrics">
              <div>
                <CheckCheck size={16} />
                <strong>
                  {done}
                  <small> / {tasks.length}</small>
                </strong>
                <span>Aufgaben erledigt</span>
              </div>
              <div>
                <Target size={16} />
                <strong>
                  {reached}
                  <small> / {goals.length}</small>
                </strong>
                <span>Ziele erreicht</span>
              </div>
            </div>
            <p className="review-encouragement">
              {reached > 0
                ? `${reached === 1 ? "Ein Ziel erreicht." : `${reached} Ziele erreicht.`} Jeder Schritt zählt.`
                : tasks.length
                  ? "Du hast dir Zeit für deine Vorhaben genommen. Nimm mit, was dir gutgetan hat."
                  : "Ein neuer Anfang braucht keinen perfekten Plan. Was möchtest du dir als Nächstes vornehmen?"}
            </p>
            <div className="review-goal-results">
              {goals.map((g) => (
                <div key={g.id}>
                  <CategoryIcon id={g.id} />
                  <span>
                    {g.name}
                    <i>
                      <b style={{ width: `${g.progress.completedPercent}%` }} />
                    </i>
                  </span>
                  <small>
                    {number(g.progress.completed)} / {number(g.target.target)}{" "}
                    {g.target.unit === "hours" ? "h" : "×"}
                  </small>
                  {g.progress.completedPercent >= 100 && <Check size={13} />}
                </div>
              ))}
            </div>
            <div className="review-time">
              <span>{number(time.occupied)} h belegt</span>
              <span>{number(time.free)} h unverplant</span>
              <i>
                <b
                  style={{
                    width: `${time.available ? (time.occupied / time.available) * 100 : 0}%`,
                  }}
                />
              </i>
              <small>06–24 Uhr · Überschneidungen einmal gezählt</small>
            </div>
          </aside>
          <div className="review-next">
            <div className="review-next-heading">
              <span className="review-eyebrow">Dein nächstes Kapitel</span>
              <h3>
                {period.kind === "week"
                  ? "Die kommende Woche"
                  : "Der kommende Monat"}
              </h3>
              <p>
                {format(nextRange.start)} – {format(nextRange.end)} · Deine
                Vorgaben bleiben. Dein Fortschritt beginnt neu.
              </p>
            </div>
            {error && (
              <p role="alert" className="review-error">
                {error}{" "}
                <button onClick={() => void load()}>Erneut versuchen</button>
              </p>
            )}
            {life ? (
              <>
                <GoalsPanel
                  key={reviewKey(period)}
                  life={life}
                  tabs={tabs}
                  todos={state.todos}
                  events={state.events}
                  anchor={next}
                  save={save}
                  initialHorizon={period.kind}
                />
                <section className="review-task-planning">
                  <h4>Was möchtest du anpacken?</h4>
                  <div
                    className="review-category-tabs"
                    aria-label="Aufgabenkategorie"
                  >
                    {tabs
                      .filter(([id]) => !["goals", "weather"].includes(id))
                      .map(([id, name]) => (
                        <button
                          key={id}
                          aria-pressed={category === id}
                          onClick={() => setCategory(id)}
                        >
                          <CategoryIcon id={id} size={13} />
                          {name}
                        </button>
                      ))}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!title.trim() || busy) return;
                      setBusy(true);
                      try {
                        await onAdd(
                          title.trim(),
                          next,
                          [
                            ...(category === "todo" ? [] : [`c:${category}`]),
                            `h:${period.kind}`,
                          ],
                          life.tabSettings[category]?.defaultColor,
                        );
                        setTitle("");
                        setError("");
                      } catch {
                        setError(
                          "Die Aufgabe konnte nicht gespeichert werden.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <input
                      aria-label="Aufgabe für den nächsten Zeitraum"
                      placeholder="Eine Aufgabe für deinen nächsten Schritt …"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={500}
                      disabled={busy}
                    />
                    <button
                      aria-label="Aufgabe im nächsten Zeitraum hinzufügen"
                      disabled={!title.trim() || busy}
                    >
                      <Plus size={18} />
                    </button>
                  </form>
                  <div className="review-next-tasks">
                    {nextTasks.map((t) => (
                      <div key={t.id}>
                        <CategoryIcon
                          id={
                            t.tags
                              .find((tag) => tag.startsWith("c:"))
                              ?.slice(2) || "todo"
                          }
                          size={12}
                        />
                        <span>{t.title}</span>
                        <small>
                          {format(t.plannedDate!)}
                          {t.time ? ` · ${t.time}` : ""}
                        </small>
                        {t.done && <Check size={12} />}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              !error && <p>Ziele werden geladen …</p>
            )}
            <footer>
              <span>Alles wird automatisch gespeichert.</span>
              <button className="primary" disabled={busy} onClick={close}>
                Bereit für Neues <ArrowRight size={15} />
              </button>
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}
