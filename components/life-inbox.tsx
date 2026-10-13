"use client";
import { useEffect, useId, useState, useRef } from "react";
import { useViewHistory } from "@/lib/view-history";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ListTodo,
  Utensils,
  CalendarDays,
  Heart,
  Dumbbell,
  CloudSun,
  Bookmark,
} from "lucide-react";
import type { Todo, Priority, CalendarEvent } from "@/lib/types";
import type { TaskColor } from "@/lib/task-colors";
import type { LifeState, MealLog } from "@/lib/life";
import { dateKey, addDays, parseDate, monday } from "@/lib/dates";
import PeriodTask from "./period-task";
import TabSettings from "./tab-settings";
import SocialCircle from "./social-circle";
import PriorityList from "./priority-list";
import WhatsappConnection from "./whatsapp-connection";
type Suggestion = {
  id: string;
  title: string;
  notes: string;
  url?: string;
  image?: string;
  source: string;
  tags: string[];
};
function SuggestionCard({
  defaultColor = "green",
  item,
  onAdd,
}: {
  defaultColor?: TaskColor;
  item: Suggestion;
  onAdd: (
    title: string,
    tags: string[],
    notes: string,
    color?: TaskColor,
  ) => Promise<void>;
}) {
  const id = useId();
  const drag = useDraggable({
    id: `suggestion:${id}`,
    data: { suggestion: { ...item, color: defaultColor } },
  });
  return (
    <article
      className="suggestion-card"
      style={{ opacity: drag.isDragging ? 0.35 : 1 }}
    >
      <button
        ref={drag.setNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        className="suggestion-title"
        style={{ touchAction: "none" }}
        onClick={() =>
          void onAdd(
            item.title,
            item.tags,
            item.notes + (item.url ? `\n${item.url}` : ""),
          )
        }
      >
        {item.image && (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.hidden = true;
            }}
          />
        )}
        {item.title}
      </button>
      {item.url ? (
        <a
          className="suggestion-source"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          {item.source} ↗
        </a>
      ) : (
        <small>{item.source}</small>
      )}
    </article>
  );
}
function HorizonButton({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const key = useId();
  const d = useDroppable({
    id: `todo-horizon:${key}`,
    data: { kind: "todo-priority", horizon: id },
  });
  return (
    <button
      ref={d.setNodeRef}
      aria-pressed={active}
      className={d.isOver ? "horizon-over" : ""}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
function PriorityLane({
  priority,
  horizon,
  todos,
  onOpen,
}: {
  priority: Priority;
  horizon: string;
  todos: Todo[];
  onOpen: (id: string) => void;
}) {
  const id = useId();
  const drop = useDroppable({
    id: `todo-priority:${id}`,
    data: { kind: "todo-priority", priority, horizon },
  });
  return (
    <section
      ref={drop.setNodeRef}
      className={`todo-priority-lane ${drop.isOver ? "over" : ""}`}
    >
      <h4>
        {
          {
            high: "🚩 Hoch",
            medium: "🟨 Mittel",
            low: "🟩 Niedrig",
            none: "Ohne Priorität",
          }[priority]
        }
      </h4>
      {todos.map((t) => (
        <PeriodTask key={t.id} todo={t} onOpen={onOpen} />
      ))}
      {!todos.length && <span className="muted">—</span>}
    </section>
  );
}
const baseTabs = [
  ["todo", "Todo"],
  ["food", "Essen"],
  ["events", "Aktivitäten"],
  ["social", "Beziehungen"],
  ["sport", "Sport"],
  ["weather", "Wetter"],
];
function InboxTab({
  id,
  label,
  selected,
  editing,
  onSelect,
  onEdit,
  onRename,
  onCancel,
  onMenu,
  onRemove,
}: {
  id: string;
  label: string;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRename: (value: string) => void;
  onCancel: () => void;
  onMenu: (e: React.MouseEvent) => void;
  onRemove: () => void;
}) {
  const drag = useSortable({
    id: `life-tab:${id}`,
    data: { kind: "life-tab", tabId: id },
    disabled: editing,
  });
  const cancel = useRef(false);
  const Icon =
    (
      {
        todo: ListTodo,
        food: Utensils,
        events: CalendarDays,
        social: Heart,
        sport: Dumbbell,
        weather: CloudSun,
      } as Record<string, typeof Bookmark>
    )[id] || Bookmark;
  return (
    <span
      ref={drag.setNodeRef}
      className={`inbox-tab ${selected ? "selected" : ""}`}
      data-tab={id}
      style={{
        transform: CSS.Transform.toString(drag.transform),
        transition: drag.transition,
        opacity: drag.isDragging ? 0.35 : 1,
      }}
    >
      {editing ? (
        <span data-escape-layer className="inline-tab-editor">
          <input
            autoFocus
            aria-label="Reitername"
            defaultValue={label}
            maxLength={100}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              if (!cancel.current) onRename(e.target.value);
              cancel.current = false;
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
          <button
            hidden
            data-close
            type="button"
            onClick={() => {
              cancel.current = true;
              onCancel();
            }}
          >
            Schließen
          </button>
        </span>
      ) : (
        <button
          {...drag.attributes}
          {...drag.listeners}
          aria-pressed={selected}
          onClick={onSelect}
          onDoubleClick={() => {
            cancel.current = false;
            onEdit();
          }}
          onContextMenu={onMenu}
          onKeyDown={(e) => {
            if (["Backspace", "Delete"].includes(e.key)) {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      )}
    </span>
  );
}
export default function LifeInbox({
  todos,
  onAdd,
  onOpen,
  children,
  onPriority,
  events,
}: {
  children: React.ReactNode;
  events: CalendarEvent[];
  todos: Todo[];
  onAdd: (
    title: string,
    tags: string[],
    notes: string,
    color?: TaskColor,
  ) => Promise<void>;
  onOpen: (id: string) => void;
  onPriority: (todo: Todo, priority: Priority, horizon: string) => void;
}) {
  const [tab, setTab] = useState("todo"),
    [life, setLife] = useState<LifeState | null>(null),
    [items, setItems] = useState<Suggestion[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [name, setName] = useState(""),
    [interval, setInterval] = useState(14),
    [days, setDays] = useState(7),
    [target, setTarget] = useState(2),
    [unit, setUnit] = useState<"times" | "hours">("times"),
    [newTab, setNewTab] = useState(false),
    [online, setOnline] = useState(false),
    [links, setLinks] = useState(""),
    [app, setApp] = useState(""),
    [horizon, setHorizon] = useState("week"),
    [quick, setQuick] = useState(""),
    [mealName, setMealName] = useState(""),
    [calories, setCalories] = useState(""),
    [quality, setQuality] = useState<MealLog["quality"]>("balanced"),
    [weather, setWeather] = useState<any>(null);
  const [editing, setEditing] = useState<string | null>(null),
    [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
      null,
    ),
    [tabSettings, setTabSettings] = useState<string | null>(null),
    [optionForm, setOptionForm] = useState(false),
    [optionName, setOptionName] = useState(""),
    [optionDays, setOptionDays] = useState(7),
    [optionTarget, setOptionTarget] = useState(1),
    [optionUnit, setOptionUnit] = useState<"times" | "hours">("times");
  const inboxRef = useRef<HTMLDivElement>(null);
  useViewHistory(
    { tab, horizon },
    (view) => {
      setTab(view.tab);
      setHorizon(view.horizon);
      setOptionForm(false);
    },
    true,
  );
  const today = dateKey(new Date());
  useEffect(() => {
    fetch("/api/life")
      .then((r) => r.json())
      .then(setLife)
      .catch(() => setError("Reiter konnten nicht geladen werden."));
    const refresh = () => {
      fetch("/api/life")
        .then((r) => r.json())
        .then(setLife);
    };
    window.addEventListener("raum-data-changed", refresh);
    window.addEventListener("raum-life-changed", refresh);
    return () => {
      window.removeEventListener("raum-data-changed", refresh);
      window.removeEventListener("raum-life-changed", refresh);
    };
  }, []);
  async function save(next: LifeState) {
    setError("");
    try {
      const r = await fetch("/api/life", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setLife(d);
      window.dispatchEvent(new Event("raum-life-changed"));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  const tabs = [
    ...baseTabs,
    ...(life?.rhythms || []).filter((r) => !r.tabId).map((r) => [r.id, r.name]),
  ]
    .filter(([id]) => !life?.hidden.includes(id))
    .sort((a, b) => {
      const order = life?.tabOrder || [];
      const rank = (id: string) =>
        order.includes(id)
          ? order.indexOf(id)
          : order.length +
            (baseTabs.some(([x]) => x === id)
              ? baseTabs.findIndex(([x]) => x === id)
              : baseTabs.length +
                (life?.rhythms.findIndex((r) => r.id === id) || 0));
      return rank(a[0]) - rank(b[0]);
    });
  useEffect(() => {
    const reorder = (event: Event) => {
      const { active, over } = (event as CustomEvent).detail;
      if (!life || active === over) return;
      const order = tabs.map(([id]) => id);
      const from = order.indexOf(active),
        to = order.indexOf(over);
      if (from < 0 || to < 0) return;
      order.splice(to, 0, order.splice(from, 1)[0]);
      void save({ ...life, tabOrder: order });
    };
    window.addEventListener("raum-tab-reorder", reorder);
    return () => window.removeEventListener("raum-tab-reorder", reorder);
  }, [life]);
  const rhythm = life?.rhythms.find((r) => r.id === tab),
    label = life?.labels[tab] || tabs.find(([id]) => id === tab)?.[1] || "";
  async function remove(id: string) {
    if (!life) return;
    const next = { ...life, hidden: [...life.hidden, id] };
    if (await save(next)) setTab(tabs.find(([x]) => x !== id)?.[0] || "");
  }
  async function discover() {
    setLoading(true);
    setItems([]);
    setError("");
    try {
      const r = await fetch(
        `/api/suggestions?kind=${encodeURIComponent(rhythm?.online ? rhythm.id : tab)}`,
      );
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setItems(d.items || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (
      life &&
      (life.tabSettings[tab]?.online ??
        (["food", "events", "sport"].includes(tab) || rhythm?.online))
    )
      void discover();
    if (tab === "weather")
      fetch("/api/weather")
        .then((r) => r.json())
        .then((d) => {
          setWeather(d);
          if (d.error) setError(d.error);
        })
        .catch(() => setError("Wetter derzeit nicht erreichbar."));
  }, [
    tab,
    life?.city,
    JSON.stringify(life?.tabSettings[tab]),
    JSON.stringify(rhythm),
  ]);
  async function add(title: string, tags: string[], notes: string) {
    try {
      await onAdd(
        title,
        [...tags, `h:${horizon}`],
        notes,
        life?.tabSettings[tab]?.defaultColor || "green",
      );
      setTab("todo");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const pending = todos.filter(
    (t) =>
      !t.plannedDate &&
      !t.done &&
      (t.tags.find((x) => /^h:(week|month|year)$/.test(x)) || "h:week") ===
        `h:${horizon}`,
  );
  const weeklyMeals = (life?.meals || []).filter(
    (m) => m.day >= dateKey(monday(parseDate(today))) && m.day <= today,
  );
  return (
    <div className="life-inbox" ref={inboxRef}>
      <nav className="life-tabs">
        <SortableContext
          items={tabs.map(([id]) => `life-tab:${id}`)}
          strategy={rectSortingStrategy}
        >
          {tabs.map(([id, n]) => (
            <InboxTab
              key={id}
              id={id}
              label={life?.labels[id] || n}
              selected={tab === id}
              editing={editing === id}
              onSelect={() => {
                setTab(id);
                setName("");
                setError("");
                setOptionForm(false);
              }}
              onEdit={() => {
                setTab(id);
                setEditing(id);
              }}
              onCancel={() => setEditing(null)}
              onRename={(value) => {
                setEditing(null);
                if (
                  life &&
                  value.trim() &&
                  value.trim() !== (life.labels[id] || n)
                )
                  void save({
                    ...life,
                    labels: { ...life.labels, [id]: value.trim() },
                    rhythms: life.rhythms.map((r) =>
                      r.id === id ? { ...r, name: value.trim() } : r,
                    ),
                  });
              }}
              onMenu={(e) => {
                e.preventDefault();
                setMenu({ id, x: e.clientX, y: e.clientY });
              }}
              onRemove={() => void remove(id)}
            />
          ))}
        </SortableContext>
        <button title="Reiter hinzufügen" onClick={() => setNewTab(!newTab)}>
          ＋
        </button>
      </nav>
      {error && (
        <p role="status" className="inline-error">
          {error}
        </p>
      )}
      {newTab && life && (
        <form
          className="rhythm-form"
          data-escape-layer
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = crypto.randomUUID();
            if (
              await save({
                ...life,
                rhythms: [
                  ...life.rhythms,
                  {
                    id,
                    name: name.trim(),
                    days,
                    target,
                    unit,
                    online,
                    links: links.split(/\s+/).filter(Boolean),
                    app,
                  },
                ],
              })
            ) {
              setTab(id);
              setName("");
              setNewTab(false);
            }
          }}
        >
          <button
            hidden
            data-close
            type="button"
            onClick={() => setNewTab(false)}
          >
            Schließen
          </button>
          <input
            aria-label="Neuer Reiter"
            placeholder="Thema des Reiters"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
          <div>
            <input
              type="number"
              aria-label="Rhythmusziel"
              min={0.5}
              step={0.5}
              max={1000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
            <select
              aria-label="Zieleinheit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as typeof unit)}
            >
              <option value="times">Mal</option>
              <option value="hours">Stunden</option>
            </select>
          </div>
          <label>
            pro{" "}
            <input
              type="number"
              aria-label="Zeitraum in Tagen"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />{" "}
            Tage
          </label>
          <button
            type="button"
            className={`online-toggle ${online ? "enabled" : "faded"}`}
            aria-label="Im Internet nach diesem Thema suchen"
            aria-pressed={online}
            onClick={() => setOnline(!online)}
          >
            🌐
          </button>
          {online && (
            <textarea
              aria-label="Quellenlinks"
              placeholder="https://… (optional)"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
            />
          )}
          <select
            aria-label="App anbinden"
            value={app}
            onChange={(e) => setApp(e.target.value)}
          >
            <option value="">App anbinden …</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="calendar">Verknüpfte Kalender</option>
          </select>
          <button className="secondary-button">Reiter anlegen</button>
          {life.hidden.length > 0 && (
            <select
              aria-label="Gelöschten Reiter wiederherstellen"
              defaultValue=""
              onChange={(e) => {
                void save({
                  ...life,
                  hidden: life.hidden.filter((id) => id !== e.target.value),
                });
              }}
            >
              <option value="">Reiter wiederherstellen …</option>
              {life.hidden.map((id) => (
                <option key={id} value={id}>
                  {life.labels[id] ||
                    [
                      ...baseTabs,
                      ...life.rhythms.map((r) => [r.id, r.name]),
                    ].find(([x]) => x === id)?.[1]}
                </option>
              ))}
            </select>
          )}
        </form>
      )}
      {menu && (
        <div
          role="menu"
          className="tab-context-menu"
          style={{
            position: "fixed",
            left: Math.min(menu.x, window.innerWidth - 180),
            top: menu.y,
            zIndex: 150,
          }}
        >
          <button
            data-close
            aria-label="Menü schließen"
            onClick={() => setMenu(null)}
          >
            ×
          </button>
          <button
            onClick={() => {
              setTabSettings(menu.id);
              setMenu(null);
            }}
          >
            Einstellungen
          </button>
        </div>
      )}
      {tabSettings && life && (
        <TabSettings
          id={tabSettings}
          label={
            life.labels[tabSettings] ||
            tabs.find(([id]) => id === tabSettings)?.[1] ||
            "Reiter"
          }
          life={life}
          save={save}
          onClose={() => setTabSettings(null)}
        />
      )}
      {tab !== "todo" && tab !== "social" && tab !== "weather" && life && (
        <section className="manual-options">
          <button
            className="text-button"
            onClick={() => setOptionForm(!optionForm)}
          >
            ＋ Eigene Option
          </button>
          {optionForm && (
            <form
              data-escape-layer
              onSubmit={async (e) => {
                e.preventDefault();
                if (!optionName.trim()) return;
                if (
                  await save({
                    ...life,
                    rhythms: [
                      ...life.rhythms,
                      {
                        id: crypto.randomUUID(),
                        tabId: tab,
                        name: optionName.trim(),
                        days: optionDays,
                        target: optionTarget,
                        unit: optionUnit,
                      },
                    ],
                  })
                ) {
                  setOptionName("");
                  setOptionForm(false);
                }
              }}
            >
              <button
                hidden
                data-close
                type="button"
                onClick={() => setOptionForm(false)}
              >
                Schließen
              </button>
              <input
                autoFocus
                aria-label="Eigene Option"
                placeholder="Aktivität"
                value={optionName}
                onChange={(e) => setOptionName(e.target.value)}
                required
                maxLength={100}
              />
              <label>
                <input
                  aria-label="Optionshäufigkeit"
                  type="number"
                  step={0.5}
                  min={0.5}
                  max={1000}
                  value={optionTarget}
                  onChange={(e) => setOptionTarget(Number(e.target.value))}
                />{" "}
                <select
                  aria-label="Optionsumfang"
                  value={optionUnit}
                  onChange={(e) =>
                    setOptionUnit(e.target.value as "times" | "hours")
                  }
                >
                  <option value="times">Mal</option>
                  <option value="hours">Stunden</option>
                </select>
                <span>pro</span>
                <select
                  aria-label="Optionszeitraum"
                  value={optionDays}
                  onChange={(e) => setOptionDays(Number(e.target.value))}
                >
                  <option value={1}>Tag</option>
                  <option value={7}>Woche</option>
                  <option value={30}>Monat</option>
                </select>
              </label>
              <button>Hinzufügen</button>
            </form>
          )}
          {life.rhythms
            .filter((r) => r.tabId === tab)
            .sort((a, b) => {
              const count = (r: typeof a) =>
                todos
                  .filter(
                    (t) =>
                      t.tags.includes(`r:${r.id}`) &&
                      t.done &&
                      t.plannedDate &&
                      t.plannedDate >=
                        dateKey(addDays(parseDate(today), -r.days)),
                  )
                  .reduce(
                    (total, t) =>
                      total +
                      (r.unit === "hours" ? (t.duration || 60) / 60 : 1),
                    0,
                  ) / r.target;
              return count(a) - count(b);
            })
            .map((r) => (
              <SuggestionCard
                defaultColor={life?.tabSettings[tab]?.defaultColor || "green"}
                key={r.id}
                item={{
                  id: r.id,
                  title: r.name,
                  tags: [`r:${r.id}`],
                  notes: "",
                  source: `${r.target} ${r.unit === "hours" ? "Std." : "Mal"} / ${r.days === 1 ? "Tag" : r.days === 7 ? "Woche" : r.days === 30 ? "Monat" : r.days + " Tage"}`,
                }}
                onAdd={add}
              />
            ))}
        </section>
      )}
      {tab === "todo" ? (
        <>
          <div className="todo-horizons">
            {[
              ["week", "Woche"],
              ["month", "Monat"],
              ["year", "Jahr"],
            ].map(([id, l]) => (
              <HorizonButton
                key={id}
                id={id}
                label={l}
                active={horizon === id}
                onClick={() => setHorizon(id)}
              />
            ))}
          </div>
          <form
            className="todo-quick"
            onSubmit={(e) => {
              e.preventDefault();
              if (quick.trim()) {
                void add(quick.trim(), [], "");
                setQuick("");
              }
            }}
          >
            <input
              aria-label="Todo hinzufügen"
              placeholder="Aufgabe hinzufügen"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
          </form>
          <PriorityList
            todos={pending}
            horizon={horizon}
            onOpen={onOpen}
            onPriority={onPriority}
          />
        </>
      ) : null}
      {(life?.tabSettings[tab]?.online ??
        (["food", "events", "sport"].includes(tab) || rhythm?.online)) && (
        <>
          <div className="discover-heading">
            <strong>
              {tab === "food"
                ? "Was kochen?"
                : `${life?.city || "Köln"} · Vorschläge`}
            </strong>
            <button disabled={loading} onClick={() => void discover()}>
              ↻
            </button>
          </div>
          {loading && <p className="muted">Vorschläge werden geladen …</p>}
          {items.map((item) => (
            <SuggestionCard
              defaultColor={life?.tabSettings[tab]?.defaultColor || "green"}
              key={item.id}
              item={item}
              onAdd={add}
            />
          ))}
        </>
      )}
      {tab === "food" && life && (
        <section className="food-diary">
          <h4>Meine Essenswoche</h4>
          <div className="meal-day-counts">
            <span>
              <b>
                {
                  new Set(
                    weeklyMeals
                      .filter((m) => m.diet === "meat")
                      .map((m) => m.day),
                  ).size
                }
              </b>{" "}
              Tage mit Fleisch/Fisch
            </span>
            <span>
              <b>
                {
                  new Set(
                    weeklyMeals
                      .filter(
                        (m) =>
                          m.diet === "vegetarian" &&
                          !weeklyMeals.some(
                            (x) => x.day === m.day && x.diet === "meat",
                          ),
                      )
                      .map((m) => m.day),
                  ).size
                }
              </b>{" "}
              vegetarische Tage
            </span>
          </div>
          <small>
            Ausgewählte Gerichte werden automatisch erfasst; unklare Zutaten
            bleiben offen.
          </small>
          <p>
            {weeklyMeals.length} Mahlzeiten ·{" "}
            {weeklyMeals.some((m) => m.calories !== null)
              ? `${weeklyMeals.reduce((n, m) => n + (m.calories || 0), 0)} erfasste kcal`
              : "Kalorien offen"}
          </p>
          <p>
            {weeklyMeals.length
              ? `${weeklyMeals.filter((m) => m.quality === "balanced").length} von ${weeklyMeals.length} als ausgewogen bewertet`
              : "Noch keine Mahlzeiten erfasst"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!mealName.trim()) return;
              void save({
                ...life,
                meals: [
                  ...life.meals,
                  {
                    id: crypto.randomUUID(),
                    day: today,
                    name: mealName.trim(),
                    calories: calories === "" ? null : Number(calories),
                    quality,
                  },
                ],
              });
              setMealName("");
              setCalories("");
            }}
          >
            <input
              aria-label="Mahlzeit"
              placeholder="Was hast du gegessen?"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              maxLength={200}
              required
            />
            <input
              aria-label="Kalorien"
              type="number"
              min={0}
              max={20000}
              placeholder="kcal (optional)"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
            <select
              aria-label="Eigene Einschätzung der Mahlzeit"
              value={quality}
              onChange={(e) => setQuality(e.target.value as typeof quality)}
            >
              <option value="unknown">Noch nicht bewertet</option>
              <option value="balanced">Ausgewogen</option>
              <option value="mixed">Gemischt</option>
              <option value="treat">Genuss</option>
            </select>
            <button>Eintragen</button>
          </form>
          <small>
            Kalorien selbst eintragen. Die Wochenübersicht basiert auf deiner
            Einschätzung.
          </small>
          {weeklyMeals.map((m) => (
            <div key={m.id}>
              {m.name}{" "}
              <small>
                {m.calories !== null ? `${m.calories} kcal` : ""} · {m.day}
              </small>
            </div>
          ))}
        </section>
      )}
      {tab === "weather" && (
        <section className="weather-list">
          <small>{life?.city} · Open-Meteo</small>
          {!weather && !error && (
            <p className="muted">Wochenwetter wird geladen …</p>
          )}
          {weather?.days?.map((d: any) => (
            <article key={d.day}>
              <strong>
                {parseDate(d.day).toLocaleDateString("de-DE", {
                  weekday: "short",
                  day: "numeric",
                  month: "numeric",
                })}{" "}
                {d.label}
              </strong>
              <span>
                {d.min}–{d.max} °C · Regen {d.rain}%
              </span>
            </article>
          ))}
        </section>
      )}
      {(tab === "social" || rhythm?.app === "whatsapp") && life && (
        <>
          <WhatsappConnection life={life} onChange={setLife} />
          {tab === "social" && (
            <SocialCircle life={life} todos={todos} save={save} add={add} />
          )}
        </>
      )}
      {rhythm && life && (
        <>
          <p className="sidebar-caption">
            {rhythm.target} {rhythm.unit === "hours" ? "Stunden" : "Mal"} pro{" "}
            {rhythm.days} Tage
          </p>
          {(() => {
            const since = dateKey(addDays(parseDate(today), 1 - rhythm.days));
            const matched = todos.filter((t) =>
              t.tags.includes(`r:${rhythm.id}`),
            );
            const past = matched.filter(
              (t) =>
                t.done &&
                t.plannedDate &&
                t.plannedDate >= since &&
                t.plannedDate <= today,
            );
            const achieved =
              rhythm.unit === "hours"
                ? past.reduce((n, t) => n + (t.duration || 60) / 60, 0)
                : past.length;
            return (
              <div className="rhythm-progress">
                <strong>
                  {achieved} / {rhythm.target}
                </strong>
                <progress value={achieved} max={rhythm.target} />
                <SuggestionCard
                  defaultColor={life?.tabSettings[tab]?.defaultColor || "green"}
                  item={{
                    id: rhythm.id,
                    title: rhythm.name,
                    tags: [`r:${rhythm.id}`],
                    notes: "",
                    source: `${Math.max(0, rhythm.target - achieved)} noch offen`,
                  }}
                  onAdd={add}
                />
              </div>
            );
          })()}
          {rhythm.links?.map((url) => (
            <a
              className="source-link"
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {new URL(url).hostname} ↗
            </a>
          ))}
          {rhythm.app === "calendar" && (
            <div>
              <small>Aus deinen verknüpften Kalendern</small>
              {events
                .filter((e) => e.start.slice(0, 10) >= today)
                .slice(0, 10)
                .map((e) => (
                  <SuggestionCard
                    defaultColor={
                      life?.tabSettings[tab]?.defaultColor || "green"
                    }
                    key={e.id}
                    item={{
                      id: e.id,
                      title: e.title,
                      tags: [`r:${rhythm.id}`],
                      notes: `${e.start} · ${e.location}\n${e.description}`,
                      source: "Verknüpfter Kalender",
                    }}
                    onAdd={add}
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
