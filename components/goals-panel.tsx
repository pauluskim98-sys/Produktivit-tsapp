"use client";
import { useEffect, useRef, useState, useId } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus, X, Target, ChevronDown, GitBranch } from "lucide-react";
import CategoryIcon from "./category-icon";
import type { LifeState } from "@/lib/life";
import type { Todo, CalendarEvent } from "@/lib/types";
import {
  goalRange,
  goalTarget,
  setGoalTarget,
  goalProgress,
  type GoalCategory,
  type GoalHorizon,
  type GoalTarget,
} from "@/lib/goals";
// Serialize goal edits across the sidebar, shelf and review; merge into fresh state.
let goalWrites: Promise<unknown> = Promise.resolve();
function queueGoalWrite(
  save: (life: LifeState) => Promise<boolean>,
  update: (life: LifeState) => LifeState,
) {
  const job = goalWrites
    .catch(() => {})
    .then(async () => {
      try {
        const response = await fetch("/api/life");
        if (!response.ok) return false;
        return await save(update(await response.json()));
      } catch {
        return false;
      }
    });
  goalWrites = job;
  return job;
}
function GoalRow({
  category,
  setting,
  todos,
  events,
  life,
  range,
  now,
  onSave,
  onRemove,
  onDistribute,
}: {
  category: GoalCategory;
  setting?: GoalTarget;
  todos: Todo[];
  events: CalendarEvent[];
  life: LifeState;
  range: { start: string; end: string };
  now: Date;
  onSave: (value: GoalTarget) => Promise<unknown>;
  onRemove: () => void;
  onDistribute?: (value: GoalTarget) => Promise<unknown>;
}) {
  const dropId = useId();
  const drop = useDroppable({
    id: `goal:${dropId}:${category.id}`,
    data: { kind: "goal-category", categoryId: category.id },
  });
  const [amount, setAmount] = useState(setting ? String(setting.target) : "");
  const [unit, setUnit] = useState<GoalTarget["unit"]>(
    setting?.unit || "hours",
  );
  const last = useRef("");
  useEffect(() => {
    setAmount(setting ? String(setting.target) : "");
    setUnit(setting?.unit || "hours");
    last.current = JSON.stringify(setting || null);
  }, [setting?.target, setting?.unit]);
  const save = async () => {
    const target = Number(amount.replace(",", "."));
    if (!Number.isFinite(target) || target <= 0 || target > 10000) {
      setAmount(setting ? String(setting.target) : "");
      return;
    }
    const value = { target, unit },
      key = JSON.stringify(value);
    if (last.current !== key) {
      last.current = key;
      const ok = await onSave(value);
      if (!ok) last.current = "";
    }
  };
  const progress = goalProgress(
    category,
    setting || { target: 1, unit },
    todos,
    events,
    range,
    now,
    life.rhythms,
  );
  const number = (v: number) =>
    v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return (
    <div
      ref={drop.setNodeRef}
      className={`goal-row ${drop.isOver ? "goal-drop-over" : ""}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) void save();
      }}
    >
      <div className="goal-row-main">
        <span
          className="goal-name"
          title={`Aufgaben hierher ziehen oder mit „${category.name}“ taggen.`}
        >
          <CategoryIcon id={category.id} />
          {category.name}
        </span>
        <input
          aria-label={`${category.name}: Zielumfang`}
          inputMode="decimal"
          placeholder="Ziel"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        <span className="goal-unit">
          <select
            aria-label={`${category.name}: Einheit`}
            value={unit}
            onChange={(e) => setUnit(e.target.value as GoalTarget["unit"])}
          >
            <option value="hours">Std.</option>
            <option value="times">Mal</option>
          </select>
          <ChevronDown size={10} />
        </span>
        {onDistribute && (
          <button
            className="icon-button goal-distribute"
            aria-label={`${category.name}: Ziel automatisch verteilen`}
            title="Auf kleinere Zeiträume verteilen · 12 Monate, 4 Wochen pro Monat"
            onClick={() => {
              const target = Number(amount.replace(",", "."));
              if (Number.isFinite(target) && target > 0 && target <= 10000) {
                const value = { target, unit };
                last.current = JSON.stringify(value);
                void onDistribute(value).then((ok) => {
                  if (!ok) last.current = "";
                });
              }
            }}
          >
            <GitBranch size={13} />
          </button>
        )}
        <button
          className="icon-button"
          aria-label={`${category.name}: Zielkategorie entfernen`}
          onClick={onRemove}
        >
          <X size={12} />
        </button>
      </div>
      <div
        className="goal-track"
        role="progressbar"
        aria-label={`${category.name}: vergangen oder erledigt`}
        aria-valuemin={0}
        aria-valuemax={setting?.target || 1}
        aria-valuenow={Math.min(setting?.target || 1, progress.completed)}
        aria-valuetext={`${number(progress.completed)} vergangen oder erledigt, ${number(progress.planned)} eingeplant${setting ? ` von ${number(setting.target)}` : ""}`}
      >
        {setting && (
          <>
            <i
              className="goal-planned"
              style={{ width: `${progress.plannedPercent}%` }}
            />
            <i
              className="goal-completed"
              style={{ width: `${progress.completedPercent}%` }}
            />
          </>
        )}
      </div>
      <small
        title={`${number(progress.completed)} ${unit === "hours" ? "Std." : "Mal"} vergangen oder erledigt · ${number(progress.planned)} eingeplant`}
      >
        {setting
          ? `${number(progress.completed)} / ${number(setting.target)} ${unit === "hours" ? "Std." : "Mal"}`
          : ""}
        {setting && progress.completedPercent >= 100 && (
          <span className="goal-achieved"> ✓</span>
        )}
      </small>
    </div>
  );
}
export default function GoalsPanel({
  life,
  tabs,
  todos,
  events,
  anchor,
  save,
  initialHorizon = "week",
}: {
  life: LifeState;
  tabs: string[][];
  todos: Todo[];
  events: CalendarEvent[];
  anchor: string;
  save: (life: LifeState) => Promise<boolean>;
  initialHorizon?: GoalHorizon;
}) {
  const [horizon, setHorizon] = useState<GoalHorizon>(initialHorizon),
    [name, setName] = useState(""),
    [adding, setAdding] = useState(false),
    [now, setNow] = useState(new Date()),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const all = [
    ...tabs
      .filter(([id]) => !["weather", "food", "goals"].includes(id))
      .map(([id, name]) => ({ id, name: life.labels[id] || name })),
    ...(life.goalCategories || []),
  ];
  const categories = all.filter(
    (g) => !(life.hiddenGoalCategories || []).includes(g.id),
  );
  const range = goalRange(anchor, horizon);
  return (
    <section className="goals-panel" aria-label="Ziele">
      <div className="todo-horizons">
        {(
          [
            ["week", "Woche"],
            ["month", "Monat"],
            ["year", "Jahr"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={horizon === id}
            onClick={() => setHorizon(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="goals-period">
        <Target size={13} />
        <span>
          {range.start.split("-").reverse().join(".")} –{" "}
          {range.end.split("-").reverse().join(".")}
        </span>
      </div>
      {categories.map((category) => (
        <GoalRow
          key={`${horizon}:${category.id}`}
          category={category}
          setting={goalTarget(life, category.id, horizon, anchor)}
          todos={todos}
          events={events}
          life={life}
          range={range}
          now={now}
          onSave={(value) =>
            queueGoalWrite(save, (current) =>
              setGoalTarget(current, category.id, horizon, anchor, value),
            )
          }
          onDistribute={
            horizon !== "week"
              ? async (value) => {
                  const ok = await queueGoalWrite(save, (current) =>
                    setGoalTarget(
                      current,
                      category.id,
                      horizon,
                      anchor,
                      value,
                      true,
                    ),
                  );
                  setNotice(
                    ok
                      ? horizon === "year"
                        ? `${category.name}: ${Number((value.target / 12).toFixed(2)).toLocaleString("de-DE")} ${value.unit === "hours" ? "Std." : "Mal"}/Monat · ${Number((value.target / 48).toFixed(2)).toLocaleString("de-DE")} ${value.unit === "hours" ? "Std." : "Mal"}/Woche`
                        : `${category.name}: ${Number((value.target / 4).toFixed(2)).toLocaleString("de-DE")} ${value.unit === "hours" ? "Std." : "Mal"}/Woche`
                      : "Das Ziel konnte nicht gespeichert werden.",
                  );
                  return ok;
                }
              : undefined
          }
          onRemove={() =>
            void save({
              ...life,
              hiddenGoalCategories: [
                ...(life.hiddenGoalCategories || []),
                category.id,
              ],
            })
          }
        />
      ))}
      {notice && (
        <small className="goal-distribution-notice" role="status">
          {notice}
        </small>
      )}
      {adding ? (
        <form
          className="goal-add"
          data-escape-layer
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (
              await save({
                ...life,
                goalCategories: [
                  ...(life.goalCategories || []),
                  { id: crypto.randomUUID(), name: name.trim() },
                ],
              })
            ) {
              setName("");
              setAdding(false);
            }
          }}
        >
          <button
            hidden
            type="button"
            data-close
            onClick={() => setAdding(false)}
          >
            Schließen
          </button>
          <input
            autoFocus
            aria-label="Neue Zielkategorie"
            placeholder="Kategorie"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button aria-label="Zielkategorie hinzufügen" disabled={!name.trim()}>
            <Plus size={14} />
          </button>
        </form>
      ) : (
        <button
          className="text-button goal-add-button"
          onClick={() => setAdding(true)}
        >
          <Plus size={13} />
          Kategorie
        </button>
      )}
      {(life.hiddenGoalCategories || []).length > 0 && (
        <select
          aria-label="Zielkategorie wiederherstellen"
          value=""
          onChange={(e) =>
            void save({
              ...life,
              hiddenGoalCategories: (life.hiddenGoalCategories || []).filter(
                (id) => id !== e.target.value,
              ),
            })
          }
        >
          <option value="">Kategorie wiederherstellen …</option>
          {all
            .filter((g) => life.hiddenGoalCategories?.includes(g.id))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      )}
    </section>
  );
}
