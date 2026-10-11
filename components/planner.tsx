"use client";
import DayPanel from "./day-panel";
import { CalendarOverview } from "./calendar-overview";
import { nextTask, shiftTasks, periodRange } from "@/lib/calendar-interactions";
import { eventPresentation } from "@/lib/subjects";
import AiPlanner, { AiConnection } from "./ai-planner";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Flag,
  GripVertical,
  Inbox,
  Layers2,
  Loader2,
  Moon,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  X,
  PanelLeftClose,
  PanelLeft,
  FileText,
  ExternalLink,
  RefreshCw,
  Download,
  Upload,
  CheckCheck,
} from "lucide-react";
import Timeline, { dragStartMinute, type TimeChange } from "./timeline";
import { scheduleAt } from "@/lib/schedule";
import { useDialog } from "./use-dialog";
import type { AppState, Todo, ChatMessage, CalendarEvent } from "@/lib/types";
import { addDays, dateKey, monday, parseDate, weekNumber } from "@/lib/dates";
const DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];
const PRIORITIES = {
  none: "Keine",
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};
const TASK_COLORS = {
  green: "Grün",
  blue: "Blau",
  purple: "Violett",
  orange: "Orange",
  pink: "Rosa",
};
function ColorPicker({
  value,
  onChange,
}: {
  value: Todo["color"];
  onChange: (color: Todo["color"]) => void;
}) {
  return (
    <fieldset className="color-picker">
      <legend>Farbe</legend>
      {Object.entries(TASK_COLORS).map(([color, label]) => (
        <button
          key={color}
          type="button"
          className={`color-swatch color-${color}`}
          aria-label={label}
          aria-pressed={(value || "green") === color}
          onClick={() => onChange(color as Todo["color"])}
        >
          {(value || "green") === color && <Check size={15} />}
        </button>
      ))}
    </fieldset>
  );
}
const EMPTY: AppState = {
  todos: [],
  events: [],
  connections: [],
  dayNotes: {},
  aiAvailable: false,
};
async function api(url: string, body?: unknown) {
  const res = await fetch(
    url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Die Anfrage ist fehlgeschlagen.");
  return data;
}
function newTodo(
  title: string,
  plannedDate: string | null,
  position: number,
): Todo {
  return {
    id: crypto.randomUUID(),
    title,
    description: "",
    notes: "",
    done: false,
    priority: "none",
    plannedDate,
    time: "",
    deadline: null,
    duration: null,
    tags: [],
    subtasks: [],
    position,
    createdAt: new Date().toISOString(),
  };
}
function IconButton({
  title,
  onClick,
  children,
  className = "",
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function TaskCard({
  todo,
  onOpen,
  onToggle,
  overlay = false,
}: {
  todo: Todo;
  onOpen: (id: string) => void;
  onToggle: (todo: Todo) => void;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id, disabled: overlay });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
      }}
      className={`task-card color-${todo.color || "green"} ${todo.done ? "completed" : ""} ${overlay ? "drag-overlay" : ""}`}
    >
      <button
        className={`task-check ${todo.done ? "checked" : ""}`}
        aria-label={`${todo.title} ${todo.done ? "wieder öffnen" : "erledigen"}`}
        onClick={() => onToggle(todo)}
      >
        {todo.done && <Check size={12} />}
      </button>
      <button
        className="task-content"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(todo.id)}
      >
        <span className="task-title">{todo.title}</span>
        {(todo.tags.length > 0 ||
          todo.time ||
          todo.duration ||
          todo.priority !== "none" ||
          todo.subtasks.length > 0) && (
          <span className="task-meta">
            {todo.tags.slice(0, 2).map((tag) => (
              <span key={tag} className={`tag tag-${tag.length % 4}`}>
                {tag}
              </span>
            ))}
            {todo.time && <span>{todo.time}</span>}
            {todo.duration && (
              <span className="duration">
                <Clock3 size={10} />
                {todo.duration}m
              </span>
            )}
            {todo.subtasks.length > 0 && (
              <span>
                {todo.subtasks.filter((s) => s.done).length}/
                {todo.subtasks.length}
              </span>
            )}
            {todo.priority === "high" && (
              <Flag size={11} className="high-priority" />
            )}
          </span>
        )}
        {todo.deadline && (
          <span
            className={`deadline ${todo.deadline < dateKey(new Date()) && !todo.done ? "overdue" : ""}`}
          >
            Fällig{" "}
            {parseDate(todo.deadline).toLocaleDateString("de-DE", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </button>
      <button
        className="drag-handle"
        aria-label={`${todo.title} verschieben`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={13} />
      </button>
    </article>
  );
}
function TaskList({
  id,
  todos,
  onOpen,
  onToggle,
  children,
}: {
  id: string;
  todos: Todo[];
  onOpen: (id: string) => void;
  onToggle: (todo: Todo) => void;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`task-list ${isOver ? "drop-active" : ""}`}
    >
      <SortableContext
        items={todos.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {todos.map((todo) => (
          <TaskCard
            key={todo.id}
            todo={todo}
            onOpen={onOpen}
            onToggle={onToggle}
          />
        ))}
      </SortableContext>
      {children}
    </div>
  );
}
function MobileDay({
  day,
  active,
  onClick,
  children,
}: {
  day: string | null;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `tab:${day || "inbox"}` });
  return (
    <button
      ref={setNodeRef}
      className={active || isOver ? "active" : ""}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function QuickAdd({
  day,
  onAdd,
  autoFocus = false,
  onCancel,
}: {
  day: string | null;
  onAdd: (title: string, day: string | null) => Promise<void>;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="quick-add"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim() || busy) return;
        setBusy(true);
        try {
          await onAdd(value.trim(), day);
          setValue("");
        } catch {
        } finally {
          setBusy(false);
        }
      }}
    >
      <Plus size={15} />
      <input
        aria-label={day ? `Aufgabe für ${day}` : "Aufgabe für die Inbox"}
        placeholder="Aufgabe hinzufügen"
        value={value}
        maxLength={500}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel?.();
        }}
      />
      {busy ? (
        <Loader2 size={13} className="spin" />
      ) : (
        value && (
          <button aria-label="Aufgabe anlegen" type="submit">
            ↵
          </button>
        )
      )}
    </form>
  );
}
export default function Planner() {
  const [state, setState] = useState<AppState>(EMPTY),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [anchor, setAnchor] = useState(() => dateKey(new Date())),
    [mobileDay, setMobileDay] = useState(() => dateKey(new Date()));
  const [dayPanel, setDayPanel] = useState<string | null>(null),
    [pasteTarget, setPasteTarget] = useState<{
      day: string;
      time: string;
    } | null>(null);
  const clipboard = useRef<Todo | null>(null);
  const groupClipboard = useRef<Todo[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  type Change = {
    id: string;
    before: Todo | null;
    after: Todo | null;
    messages?: ChatMessage[];
  };
  const history = useRef<Change[][]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const remember = (
    before: Todo[],
    after: Todo[],
    deleted?: { id: string; messages: ChatMessage[] }[],
  ) => {
    const changes = [...new Set([...before, ...after].map((t) => t.id))]
      .map((id) => ({
        id,
        before: before.find((t) => t.id === id) || null,
        after: after.find((t) => t.id === id) || null,
        ...(deleted?.find((d) => d.id === id)
          ? { messages: deleted.find((d) => d.id === id)!.messages }
          : {}),
      }))
      .filter((c) => JSON.stringify(c.before) !== JSON.stringify(c.after));
    if (changes.length) {
      history.current.push(changes);
      if (history.current.length > 50) history.current.shift();
      setHistoryCount(history.current.length);
    }
  };
  const undoLast = async () => {
    if (lock.current || !history.current.length) return;
    lock.current = true;
    setBusy(true);
    try {
      const changes = history.current.at(-1)!;
      const data = await api("/api/todos", { action: "undo", changes });
      history.current.pop();
      setHistoryCount(history.current.length);
      setState((s) => ({ ...s, todos: data.todos }));
      setSelected(null);
      setToast({ text: "Änderung rückgängig gemacht" });
    } catch (e) {
      handleError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const [overview, setOverview] = useState<"month" | "week" | "year" | null>(
    null,
  );
  const [planning, setPlanning] = useState(false),
    [planningInput, setPlanningInput] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [tagFilter, setTagFilter] = useState(""),
    [showDone, setShowDone] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(true),
    [mobileInbox, setMobileInbox] = useState(false),
    [settings, setSettings] = useState(false),
    [newOpen, setNewOpen] = useState(false),
    [dark, setDark] = useState(false);
  const [accent, setAccent] = useState("green");
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const wheelGesture = useRef({ amount: 0, lastEvent: 0, lastPage: 0 });
  const [newSlot, setNewSlot] = useState<{
    day: string;
    time: string;
    duration?: number;
    days?: string[];
  } | null>(null);
  const [dragged, setDragged] = useState<Todo | null>(null),
    [toast, setToast] = useState<{
      text: string;
      undo?: () => Promise<void>;
    } | null>(null),
    [busy, setBusy] = useState(false);
  useDialog(
    Boolean(selected || settings || newOpen || planning || dayPanel),
    selected ||
      dayPanel ||
      (planning ? "planning" : newOpen ? "new" : settings ? "settings" : ""),
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const load = useCallback(async () => {
    try {
      setState(await api("/api/state"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    setInboxOpen(window.matchMedia("(min-width: 1101px)").matches);
    const stored = localStorage.getItem("raum-theme");
    setDark(
      stored
        ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const accentValue = localStorage.getItem("raum-accent") || "green";
    setAccent(accentValue);
    document.documentElement.dataset.accent = accentValue;
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [load]);
  useEffect(() => {
    // Only refresh calendar data; never overwrite a task draft or in-flight task mutation.
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await api("/api/state");
        if (active)
          setState((prev) => ({
            ...prev,
            events: data.events,
            connections: data.connections,
          }));
      } catch {}
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("raum-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 15000);
    return () => clearTimeout(timeout);
  }, [toast]);
  const today = () => {
    const key = dateKey(new Date());
    setAnchor(key);
    setMobileDay(key);
    setMobileInbox(false);
  };
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const input = (e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable]",
      );
      if (
        !input &&
        !selected &&
        !newOpen &&
        !planning &&
        !settings &&
        !dayPanel &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        if (e.key.toLowerCase() === "a") {
          e.preventDefault();
          setSelectionMode((v) => !v);
          return;
        }
        if (e.key === "Escape") {
          setSelectionMode(false);
          setSelectedIds([]);
          setPicked(null);
        }
        if (selectedIds.length > 1 && ["Delete", "Backspace"].includes(e.key)) {
          e.preventDefault();
          void deleteGroup().catch(() => {});
          return;
        }
        if (picked && e.key.startsWith("Arrow")) {
          e.preventDefault();
          navigateTask(picked, e.key);
          return;
        }
      }
      if (
        !input &&
        !planning &&
        !settings &&
        !newOpen &&
        !dayPanel &&
        (e.metaKey || e.ctrlKey)
      ) {
        if (e.key.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          void undoLast();
          return;
        }
      }
      if (
        !input &&
        !selected &&
        !newOpen &&
        !planning &&
        !settings &&
        !dayPanel &&
        picked &&
        /^[1-5]$/.test(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const t = state.todos.find((t) => t.id === picked);
        if (t)
          void save({
            ...t,
            color: Object.keys(TASK_COLORS)[Number(e.key) - 1] as Todo["color"],
          }).catch(handleError);
        return;
      }
      if (dayPanel) return;
      if (
        !selected &&
        !planning &&
        !settings &&
        !newOpen &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (
        !input &&
        !selected &&
        !planning &&
        !settings &&
        !newOpen &&
        picked &&
        ["Backspace", "Delete"].includes(e.key)
      ) {
        e.preventDefault();
        const t = state.todos.find((t) => t.id === picked);
        if (t) void remove(t);
        setPicked(null);
        return;
      }
      if (e.key === "Escape" && !selected) {
        setSettings(false);
        setNewOpen(false);
        setQuery("");
      }
      if (planning) {
        if (e.key === "Escape") setPlanning(false);
        return;
      }
      if (input || e.metaKey || e.ctrlKey || e.altKey || selected || settings)
        return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNewSlot(null);
        setNewOpen(true);
      }
      if (e.key.toLowerCase() === "t") today();
    }
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(target.closest("input,textarea,select,[contenteditable]"));
    const copy = (e: ClipboardEvent) => {
      if (editable(e.target) || planning || settings || newOpen || dayPanel)
        return;
      if (!selected && selectedIds.length > 1 && e.clipboardData) {
        e.preventDefault();
        groupClipboard.current = state.todos.filter((t) =>
          selectedIds.includes(t.id),
        );
        e.clipboardData.setData(
          "text/plain",
          "RAUM_TASKS:" + JSON.stringify(groupClipboard.current),
        );
        setToast({ text: `${groupClipboard.current.length} Termine kopiert` });
        return;
      }
      const todo = state.todos.find((t) => t.id === (selected || picked));
      if (!todo || !e.clipboardData) return;
      e.preventDefault();
      clipboard.current = structuredClone(todo);
      e.clipboardData.setData(
        "text/plain",
        "RAUM_TASK:" + JSON.stringify(todo),
      );
      setToast({ text: "Block kopiert" });
    };
    const paste = (e: ClipboardEvent) => {
      const groupText = e.clipboardData?.getData("text/plain") || "";
      const blockPaste =
        groupText.startsWith("RAUM_TASKS:") ||
        groupText.startsWith("RAUM_TASK:");
      if (
        planning ||
        settings ||
        dayPanel ||
        ((editable(e.target) || newOpen) && !(newOpen && newSlot && blockPaste))
      )
        return;
      if (groupText.startsWith("RAUM_TASKS:")) {
        try {
          const group = JSON.parse(groupText.slice(11));
          if (
            Array.isArray(group) &&
            group.length > 0 &&
            group.length <= 500 &&
            group.every(
              (t) =>
                typeof t.title === "string" &&
                t.plannedDate &&
                t.time &&
                Array.isArray(t.subtasks),
            )
          ) {
            e.preventDefault();
            const target = pasteTarget || {
              day: group[0].plannedDate,
              time: group[0].time,
            };
            void pasteGroup(group, target.day, target.time)
              .then(() => setNewOpen(false))
              .catch(() => {});
          }
        } catch {}
        return;
      }
      let todo = clipboard.current;
      const text = e.clipboardData?.getData("text/plain") || "";
      if (text.startsWith("RAUM_TASK:")) {
        try {
          const parsed = JSON.parse(text.slice(10));
          if (
            typeof parsed.title === "string" &&
            Array.isArray(parsed.subtasks) &&
            Array.isArray(parsed.tags)
          )
            todo = parsed;
        } catch {
          return;
        }
      } else if (text) return;
      if (!todo) return;
      e.preventDefault();
      if (pasteTarget)
        void duplicate(todo, pasteTarget.day, pasteTarget.time).then(() =>
          setNewOpen(false),
        );
      else setToast({ text: "Zuerst eine Stelle im Kalender auswählen." });
    };
    window.addEventListener("keydown", key);
    document.addEventListener("copy", copy);
    document.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("copy", copy);
      document.removeEventListener("paste", paste);
    };
  }, [
    selected,
    settings,
    newOpen,
    picked,
    state.todos,
    planning,
    dayPanel,
    pasteTarget,
    newSlot,
    selectedIds,
    selectionMode,
    anchor,
  ]);
  const mutate = async (body: unknown) => {
    if (lock.current)
      throw new Error(
        "Eine Änderung wird gerade gespeichert. Bitte kurz warten.",
      );
    lock.current = true;
    setBusy(true);
    try {
      const result = await api("/api/todos", body);
      remember(
        state.todos,
        result.todos,
        result.deleted
          ? [{ id: result.deleted.id, messages: result.messages }]
          : result.deletedMany,
      );
      setState((prev) => ({ ...prev, todos: result.todos }));
      return result;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const handleError = (e: unknown) => setToast({ text: (e as Error).message });
  const save = async (todo: Todo) => {
    await mutate({ action: "save", todo });
  };
  const add = async (
    title: string,
    day: string | null,
    time = "",
    duration: number | null = null,
    color: Todo["color"] = "green",
    notes = "",
  ) => {
    try {
      await save({
        ...newTodo(
          title,
          day,
          Math.max(
            0,
            ...state.todos
              .filter((t) => t.plannedDate === day)
              .map((t) => t.position),
          ) + 1,
        ),
        time: day ? time : "",
        duration,
        color,
        notes,
      });
      setToast({ text: "Aufgabe hinzugefügt" });
    } catch (e) {
      handleError(e);
      throw e;
    }
  };
  const duplicate = async (todo: Todo, day: string, time = todo.time) => {
    try {
      const copy = {
        ...structuredClone(todo),
        id: crypto.randomUUID(),
        plannedDate: day,
        time,
        duration: todo.duration || (time ? 60 : null),
        done: false,
        position: state.todos.length + 1,
        createdAt: new Date().toISOString(),
        subtasks: todo.subtasks.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          done: false,
        })),
      };
      await save(copy);
      setSelected(null);
      setPicked(copy.id);
      setPasteTarget(null);
      setToast({ text: "Block dupliziert" });
    } catch (e) {
      handleError(e);
    }
  };
  const toggle = async (todo: Todo) => {
    try {
      await save({ ...todo, done: !todo.done });
    } catch (e) {
      handleError(e);
    }
  };
  const remove = async (todo: Todo) => {
    try {
      const result = await mutate({ action: "delete", id: todo.id });
      setSelected(null);
      setToast({
        text: "Aufgabe gelöscht",
        undo: async () => {
          await mutate({
            action: "restore",
            todo: result.deleted,
            messages: result.messages,
          });
        },
      });
    } catch (e) {
      handleError(e);
    }
  };
  const reschedule = async (
    todo: Todo,
    change: TimeChange,
    day = todo.plannedDate,
  ) => {
    try {
      await mutate({
        action: "schedule",
        id: todo.id,
        plannedDate: day,
        ...change,
      });
      setToast({
        text: "Zeitraum geändert",
        undo: async () => {
          await mutate({
            action: "schedule",
            id: todo.id,
            plannedDate: todo.plannedDate,
            time: todo.time,
            duration: todo.duration,
          });
        },
      });
    } catch (e) {
      handleError(e);
    }
  };
  const navigateTask = (id: string, key: string, detail = false) => {
    const next = nextTask(
      state.todos.filter((t) => weekKeys.includes(t.plannedDate || "")),
      id,
      key,
    );
    if (next) {
      setPicked(next);
      setSelectedIds([next]);
      if (detail) setSelected(next);
    }
  };
  const batchUpdate = async (todos: Todo[], ids: string[] = []) => {
    try {
      await mutate({
        action: "batch",
        changes: [
          ...todos.map((t) => ({
            id: t.id,
            before: t,
            after: state.todos.find((x) => x.id === t.id) || null,
          })),
          ...ids.map((id) => ({
            id,
            before: null,
            after: state.todos.find((x) => x.id === id) || null,
          })),
        ],
      });
    } catch (e) {
      handleError(e);
      throw e;
    }
  };
  const deleteGroup = async () => {
    await batchUpdate([], selectedIds);
    setSelectedIds([]);
    setPicked(null);
    setToast({ text: "Auswahl gelöscht" });
  };
  const pasteGroup = async (group: Todo[], day: string, time: string) => {
    if (!group.length) return;
    const copies = shiftTasks(group, group[0], day, time, true);
    await batchUpdate(copies);
    setSelectedIds(copies.map((t) => t.id));
    setPicked(copies[0]?.id || null);
    setToast({ text: `${copies.length} Termine eingefügt` });
  };
  const move = async ({
    active,
    over,
    activatorEvent,
    delta,
  }: DragEndEvent) => {
    setDragged(null);
    if (!over || active.id === over.id) return;
    const source = state.todos.find(
      (t) => t.id === (active.data.current?.todoId || active.id),
    );
    if (!source) return;
    if (over.data.current?.kind === "periodday") {
      const day = over.data.current.day as string;
      if (
        selectedIds.length > 1 &&
        selectedIds.includes(source.id) &&
        source.plannedDate &&
        source.time
      ) {
        await batchUpdate(
          shiftTasks(
            state.todos.filter((t) => selectedIds.includes(t.id)),
            source,
            day,
            source.time,
          ),
        );
        return;
      }
      await mutate({
        action: "schedule",
        id: source.id,
        plannedDate: day,
        time: source.time || "",
        duration: source.duration,
      });
      return;
    }
    if (over.data.current?.kind === "timegrid") {
      const day = over.data.current.day as string;
      const grid = document.querySelector(`[data-day-grid="${day}"]`);
      if (grid && selectedIds.length > 1 && selectedIds.includes(source.id)) {
        const change = scheduleAt(
          dragStartMinute(
            active,
            activatorEvent,
            delta,
            grid.getBoundingClientRect().top,
            Number((grid as HTMLElement).dataset.minuteHeight) || 0.55,
          ),
        );
        await batchUpdate(
          shiftTasks(
            state.todos.filter((t) => selectedIds.includes(t.id)),
            source,
            day,
            change.time,
          ),
        );
        return;
      }
      if (grid)
        await reschedule(
          source,
          scheduleAt(
            dragStartMinute(
              active,
              activatorEvent,
              delta,
              grid.getBoundingClientRect().top,
              Number((grid as HTMLElement).dataset.minuteHeight) || 0.55,
            ),
            source.duration || 60,
          ),
          day,
        );
      return;
    }
    const target = state.todos.find((t) => t.id === over.id);
    const day = target
      ? target.plannedDate
      : ["inbox", "tab:inbox"].includes(String(over.id))
        ? null
        : String(over.id).replace(/^tab:/, "");
    if (day !== null && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const list = state.todos
      .filter((t) => t.plannedDate === day && t.id !== source.id)
      .sort((a, b) => a.position - b.position);
    let index = target
      ? list.findIndex((t) => t.id === target.id)
      : list.length;
    if (
      target &&
      source.plannedDate === day &&
      source.position < target.position
    )
      index++;
    list.splice(Math.max(0, index), 0, { ...source, plannedDate: day });
    const moves = list.map((t, position) => ({
      id: t.id,
      plannedDate: day,
      position,
      time: t.id === source.id ? "" : t.time,
    }));
    const old = state.todos
      .filter((t) => moves.some((m) => m.id === t.id))
      .map((t) => ({
        id: t.id,
        plannedDate: t.plannedDate,
        position: t.position,
        time: t.time,
      }));
    try {
      await mutate({ action: "move", moves });
      setToast({
        text:
          source.plannedDate === day
            ? "Reihenfolge geändert"
            : "Aufgabe verschoben",
        undo: async () => {
          await mutate({ action: "move", moves: old });
        },
      });
    } catch (e) {
      handleError(e);
    }
  };
  const start = monday(parseDate(anchor));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const weekKeys = days.map(dateKey);
  const end = days[6];
  const visible = (todo: Todo) =>
    (showDone || !todo.done) &&
    (!tagFilter || todo.tags.includes(tagFilter)) &&
    (!query ||
      `${todo.title} ${todo.description} ${todo.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()));
  const tasksFor = (day: string | null) =>
    state.todos
      .filter((t) => t.plannedDate === day && visible(t))
      .sort((a, b) => a.position - b.position);
  const weekTodos = state.todos.filter(
    (t) => t.plannedDate && weekKeys.includes(t.plannedDate),
  );
  const done = weekTodos.filter((t) => t.done).length;
  const tags = [...new Set(state.todos.flatMap((t) => t.tags))].sort();
  const current = state.todos.find((t) => t.id === selected);
  const eventsFor = (day: string) =>
    state.events.filter((e) =>
      e.allDay
        ? e.start.slice(0, 10) <= day && e.end.slice(0, 10) > day
        : new Date(e.start) <
            new Date(`${dateKey(addDays(parseDate(day), 1))}T00:00:00`) &&
          new Date(e.end) > new Date(`${day}T00:00:00`),
    );
  const navigate = (direction: number) => {
    const next = parseDate(anchor);
    if (overview === "month") next.setDate(1);
    if (overview === "year") next.setMonth(0, 1);
    if (overview === "year") next.setFullYear(next.getFullYear() + direction);
    else if (overview === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    setAnchor(dateKey(next));
    setMobileDay(dateKey(next));
  };
  const cycleOverview = () =>
    setOverview((v) => (v === null ? "month" : v === "month" ? "year" : null));
  const swipePage = (e: React.TouchEvent) => {
    if (
      selectionMode ||
      settings ||
      selected ||
      newOpen ||
      planning ||
      dayPanel
    )
      return;
    const t = e.target as HTMLElement;
    if (t.closest("input,textarea,.timed-task,.task-card,.overview-task"))
      return;
    const origin = swipe.current;
    swipe.current = null;
    if (!origin) return;
    const dx = e.changedTouches[0].clientX - origin.x,
      dy = e.changedTouches[0].clientY - origin.y;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      e.preventDefault();
      navigate(dx < 0 ? 1 : -1);
    }
  };

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const gesture = wheelGesture.current;
    const wheel = (event: WheelEvent) => {
      if (
        dayPanel ||
        settings ||
        selected ||
        newOpen ||
        planning ||
        dragged ||
        event.ctrlKey
      )
        return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.5) return;
      const now = Date.now();
      event.preventDefault();
      if (now - gesture.lastEvent > 180) gesture.amount = 0;
      gesture.lastEvent = now;
      gesture.amount += event.deltaX;
      if (Math.abs(gesture.amount) >= 85 && now - gesture.lastPage > 400) {
        navigate(gesture.amount > 0 ? 1 : -1);
        gesture.amount = 0;
        gesture.lastPage = now;
      }
    };
    main.addEventListener("wheel", wheel, { passive: false });
    return () => main.removeEventListener("wheel", wheel);
  }, [
    anchor,
    overview,
    dayPanel,
    settings,
    selected,
    newOpen,
    planning,
    dragged,
  ]);

  return (
    <div className="app-shell">
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const hits = pointerWithin(args);
          return hits.length ? hits : closestCorners(args);
        }}
        onDragStart={(e) =>
          setDragged(
            state.todos.find(
              (t) => t.id === (e.active.data.current?.todoId || e.active.id),
            ) || null,
          )
        }
        onDragCancel={() => setDragged(null)}
        onDragEnd={(event) => {
          void move(event).catch(handleError);
        }}
      >
        <div
          className={`workspace ${!inboxOpen ? "inbox-collapsed" : ""} ${mobileInbox ? "show-mobile-inbox" : ""}`}
        >
          <aside className="sidebar">
            <div className="sidebar-heading">
              <span>
                <Inbox size={18} />
                Inbox{" "}
                <small>
                  {state.todos.filter((t) => !t.plannedDate && !t.done).length}
                </small>
              </span>
              <IconButton
                title="Inbox einklappen"
                onClick={() => {
                  setInboxOpen(false);
                  setMobileInbox(false);
                }}
              >
                <PanelLeftClose size={15} />
              </IconButton>
            </div>
            <p className="sidebar-caption">Erst sammeln. Später einplanen.</p>
            <QuickAdd day={null} onAdd={add} />
            <TaskList
              id="inbox"
              todos={tasksFor(null)}
              onOpen={setSelected}
              onToggle={toggle}
            >
              {tasksFor(null).length === 0 && (
                <div className="inbox-empty">
                  <Inbox size={27} strokeWidth={1.2} />
                  <strong>Platz für deine Gedanken</strong>
                  <p>
                    Was möchtest du erledigen?
                    <br />
                    Sammle es hier in deiner Inbox.
                  </p>
                </div>
              )}
            </TaskList>
            <div className="sidebar-footer">
              <span className="eyebrow">DEINE KALENDER</span>
              {state.connections.length === 0 ? (
                <p>Noch kein Kalender verbunden</p>
              ) : (
                state.connections.map((c) => (
                  <div className="calendar-label" key={c.id}>
                    <i style={{ background: c.color }} />
                    {c.name}
                  </div>
                ))
              )}
              <button className="text-button" onClick={() => setSettings(true)}>
                <Plus size={14} />
                Kalender verbinden
              </button>
              <span className="keyboard-hint">
                <kbd>N</kbd> Neue Aufgabe <kbd>T</kbd> Heute
              </span>
            </div>
          </aside>
          <main
            ref={mainRef}
            className="main-content"
            onTouchStart={(e) => {
              const t = e.target as HTMLElement;
              if (
                !t.closest(
                  "input,textarea,.timed-task,.task-card,.overview-task",
                )
              )
                swipe.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                };
            }}
            onTouchEnd={swipePage}
          >
            <div className="planner-toolbar">
              <div className="week-nav">
                {!inboxOpen && (
                  <IconButton
                    title="Inbox öffnen"
                    onClick={() => setInboxOpen(true)}
                  >
                    <PanelLeft size={17} />
                  </IconButton>
                )}
                <h2 className="overview-nav date-navigation">
                  <button
                    aria-label="Wochenübersicht öffnen"
                    onClick={() => setDayPanel(`week:${dateKey(start)}`)}
                  >
                    {start.getDate()}.–{end.getDate()}.
                  </button>
                  <button
                    aria-label="Monatsübersicht öffnen"
                    onClick={() =>
                      setDayPanel(`month:${anchor.slice(0, 7)}-01`)
                    }
                  >
                    {parseDate(anchor).toLocaleDateString("de-DE", {
                      month: "long",
                    })}
                  </button>
                  <button
                    className="header-year"
                    aria-label="Jahresübersicht öffnen"
                    onClick={() =>
                      setDayPanel(`year:${anchor.slice(0, 4)}-01-01`)
                    }
                  >
                    {anchor.slice(2, 4)}
                  </button>
                </h2>
                <button
                  className="calendar-view-cycle"
                  aria-label="Große Kalenderansicht wechseln"
                  onClick={cycleOverview}
                >
                  <CalendarDays size={16} />
                  {overview === "month"
                    ? "Monat"
                    : overview === "year"
                      ? "Jahr"
                      : "Woche"}
                </button>
                {overview === null && (
                  <span className="week-badge">KW {weekNumber(start)}</span>
                )}
                <button className="today-button" onClick={today}>
                  Heute
                </button>
              </div>
              <label className="search-field">
                <Search size={15} />
                <input
                  ref={searchRef}
                  aria-label="Aufgaben suchen"
                  placeholder="Aufgaben suchen …"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <button
                    aria-label="Suche löschen"
                    onClick={() => setQuery("")}
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <kbd>⌘ K</kbd>
                )}
              </label>
              <select
                aria-label="Nach Tag filtern"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">Alle Tags</option>
                {tags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <label className="done-toggle">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={(e) => setShowDone(e.target.checked)}
                />
                Erledigte
              </label>
              <button
                className="primary-button new-task-button"
                aria-label="Neue Aufgabe"
                onClick={() => {
                  setNewSlot(null);
                  setNewOpen(true);
                }}
              >
                <Plus size={17} />
                <span>Neue Aufgabe</span>
                <kbd>N</kbd>
              </button>
              <IconButton
                title={dark ? "Helles Design" : "Dunkles Design"}
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
              <IconButton
                title="Kalender & Einstellungen"
                onClick={() => setSettings(true)}
              >
                <Settings2 size={16} />
              </IconButton>
              <span className="save-indicator" aria-live="polite">
                {busy ? "Speichert …" : ""}
              </span>
            </div>
            <form
              className="planning-bar"
              onSubmit={(e) => {
                e.preventDefault();
                setPlanning(true);
              }}
            >
              <Sparkles size={15} />
              <input
                aria-label="Woche mit KI planen"
                placeholder="Woche planen, Ziele besprechen …"
                value={planningInput}
                onChange={(e) => setPlanningInput(e.target.value)}
              />
              <button type="submit">
                KI-Planung öffnen <ArrowRight size={14} />
              </button>
            </form>
            <nav className="mobile-tabs">
              <MobileDay
                day={null}
                active={mobileInbox}
                onClick={() => setMobileInbox(true)}
              >
                <Inbox size={16} />
                Inbox
              </MobileDay>
              {days.map((day, i) => (
                <MobileDay
                  key={dateKey(day)}
                  day={dateKey(day)}
                  active={!mobileInbox && dateKey(day) === mobileDay}
                  onClick={() => {
                    setMobileDay(dateKey(day));
                    setMobileInbox(false);
                  }}
                >
                  {DAYS[i].slice(0, 2)}
                  <b>{day.getDate()}</b>
                </MobileDay>
              ))}
            </nav>
            {(selectionMode || selectedIds.length > 1) && (
              <div className="selection-toolbar">
                <span>
                  {selectionMode
                    ? "Auswahl ziehen"
                    : `${selectedIds.length} Termine ausgewählt`}
                </span>
                {selectedIds.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        groupClipboard.current = state.todos.filter((t) =>
                          selectedIds.includes(t.id),
                        );
                        void navigator.clipboard.writeText(
                          "RAUM_TASKS:" +
                            JSON.stringify(groupClipboard.current),
                        );
                        setToast({ text: "Auswahl kopiert" });
                      }}
                    >
                      Kopieren
                    </button>
                    <button onClick={() => void deleteGroup().catch(() => {})}>
                      Löschen
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedIds([]);
                    setPicked(null);
                  }}
                >
                  Auswahl aufheben
                </button>
              </div>
            )}
            {error ? (
              <div className="load-error">
                {error}
                <button onClick={load}>Erneut versuchen</button>
              </div>
            ) : loading ? (
              <div className="loading">
                <Loader2 className="spin" />
                Deine Woche wird geladen …
              </div>
            ) : overview && overview !== "week" ? (
              <CalendarOverview
                large
                period={`${overview}:${overview === "year" ? anchor.slice(0, 4) + "-01-01" : anchor.slice(0, 7) + "-01"}`}
                todos={state.todos.filter(visible)}
                events={state.events}
                connections={state.connections}
                onPick={(day) => {
                  setAnchor(day);
                  setMobileDay(day);
                  setOverview(null);
                }}
              />
            ) : (
              <Timeline
                days={days}
                mobileDay={mobileDay}
                todos={state.todos.filter(visible)}
                events={state.events}
                colors={Object.fromEntries(
                  state.connections.map((c) => [c.id, c.color]),
                )}
                selected={picked}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onSelection={(ids) => {
                  setSelectedIds(ids);
                  setPicked(ids[0] || null);
                  setSelectionMode(false);
                }}

                onOpen={(id) => {
                  setPicked(id);
                  setSelectedIds([id]);
                  setPasteTarget(null);
                  setSelected(id);
                }}
                onToggle={toggle}
                onResize={reschedule}
                onExtend={async (todo, days) => {
                  try {
                    await mutate({
                      action: "createMany",
                      todos: days.map((day) => ({
                        ...structuredClone(todo),
                        id: crypto.randomUUID(),
                        plannedDate: day,
                        done: false,
                        createdAt: new Date().toISOString(),
                        subtasks: todo.subtasks.map((t) => ({
                          ...t,
                          id: crypto.randomUUID(),
                          done: false,
                        })),
                      })),
                    });
                    setToast({ text: `${days.length} Tageskopien erstellt` });
                  } catch (e) {
                    handleError(e);
                  }
                }}
                targetSlot={pasteTarget}
                onSelectSlot={(day, time) => {
                  setPasteTarget({ day, time });
                  setPicked(null);
                }}
                onDayOpen={setDayPanel}
                onCreate={(day, time, duration, days) => {
                  setPasteTarget({ day, time });
                  setNewSlot({ day, time, duration, days });
                  setNewOpen(true);
                }}
                onEvent={(event) =>
                  setToast({
                    text: `${event.title}${event.location ? ` · ${event.location}` : ""} — Importierter Kalendertermin (schreibgeschützt)`,
                  })
                }
                renderUnscheduled={(key) => (
                  <>
                    {eventsFor(key)
                      .filter((e) => e.allDay)
                      .map((event) => (
                        <button
                          className="calendar-event"
                          style={
                            {
                              "--event-color": eventPresentation(
                                event,
                                state.connections.find(
                                  (c) => c.id === event.connectionId,
                                )?.color,
                              ).color,
                            } as React.CSSProperties
                          }
                          key={event.id}
                          onClick={() =>
                            setToast({
                              text: `${event.title} · Ganztägig (schreibgeschützt)`,
                            })
                          }
                        >
                          {event.title}
                        </button>
                      ))}
                    <TaskList
                      id={key}
                      todos={tasksFor(key).filter((t) => !t.time)}
                      onOpen={setSelected}
                      onToggle={toggle}
                    >
                      <QuickAdd day={key} onAdd={add} />
                    </TaskList>
                    <DayNote
                      day={key}
                      value={state.dayNotes[key] || ""}
                      onSave={async (content) => {
                        try {
                          await api("/api/notes", { date: key, content });
                          setState((s) => ({
                            ...s,
                            dayNotes: { ...s.dayNotes, [key]: content },
                          }));
                        } catch (e) {
                          handleError(e);
                        }
                      }}
                    />
                  </>
                )}
              />
            )}
            {query && (
              <div className="search-outside">
                {state.todos
                  .filter(
                    (t) =>
                      t.plannedDate &&
                      !weekKeys.includes(t.plannedDate) &&
                      visible(t),
                  )
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setAnchor(t.plannedDate!);
                        setMobileDay(t.plannedDate!);
                        setSelected(t.id);
                      }}
                    >
                      <Search size={13} />
                      {t.title}
                      <span>
                        {parseDate(t.plannedDate!).toLocaleDateString("de-DE")}
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  ))}
              </div>
            )}
          </main>
        </div>
        <DragOverlay>
          {dragged ? (
            <TaskCard
              todo={dragged}
              onOpen={() => {}}
              onToggle={() => {}}
              overlay
            />
          ) : null}
        </DragOverlay>
        {dayPanel && (
          <DayPanel
            day={dayPanel}
            state={state}
            onClose={() => setDayPanel(null)}
            onOpen={(id) => {
              setDayPanel(null);
              setSelected(id);
              setPicked(id);
            }}
            onAdd={(title) => add(title, periodRange(dayPanel)!.start)}
            onDay={(day) => {
              setAnchor(day);
              setMobileDay(day);
              setDayPanel(null);
            }}
            onNote={async (content) => {
              await api("/api/notes", { date: dayPanel, content });
              setState((s) => ({
                ...s,
                dayNotes: { ...s.dayNotes, [dayPanel]: content },
              }));
            }}
            onConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
          />
        )}
      </DndContext>
      {planning && (
        <AiPlanner
          start={dateKey(start)}
          initialMessage={planningInput}
          available={state.aiAvailable}
          onConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
          onAccepted={(todos) => {
            remember(state.todos, todos);
            setState((s) => ({ ...s, todos }));
          }}
          onClose={() => setPlanning(false)}
        />
      )}
      {current && (
        <Detail
          key={current.id}
          onNavigate={(key) => navigateTask(current.id, key, true)}
          todo={current}
          onClose={() => setSelected(null)}
          onSave={save}
          onDelete={() => remove(current)}
          onRepeat={async (weekdays, weeks) => {
            const result = await mutate({
              action: "repeat",
              id: current.id,
              weekdays,
              weeks,
            });
            setToast({ text: `${result.created} Wiederholungen angelegt` });
          }}
          aiAvailable={state.aiAvailable}
          onAiConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
          onError={handleError}
        />
      )}
      {newOpen && (
        <Detail
          isNew
          todo={{
            ...newTodo("", newSlot?.day || null, state.todos.length + 1),
            time: newSlot?.time || "",
            duration: newSlot?.time ? newSlot.duration || 60 : null,
          }}
          onClose={() => setNewOpen(false)}
          onDelete={() => setNewOpen(false)}
          onRepeat={async () => {}}
          aiAvailable={state.aiAvailable}
          onAiConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
          onError={handleError}
          onSave={async (draft) => {
            const dates = newSlot?.days?.length
              ? newSlot.days
              : [draft.plannedDate];
            const todos = dates.map((day) => ({
              ...draft,
              id: crypto.randomUUID(),
              plannedDate: day,
              subtasks: draft.subtasks.map((t) => ({
                ...t,
                id: crypto.randomUUID(),
              })),
            }));
            await mutate({ action: "createMany", todos });
            setNewOpen(false);
            setToast({
              text:
                todos.length > 1
                  ? `${todos.length} Termine erstellt`
                  : "Aufgabe erstellt",
            });
          }}
        />
      )}
      {settings && (
        <Settings
          state={state}
          onClose={() => setSettings(false)}
          onRefresh={load}
          onError={handleError}
          accent={accent}
          onAccent={(v) => {
            setAccent(v);
            document.documentElement.dataset.accent = v;
            localStorage.setItem("raum-accent", v);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toast.text}</span>
          {historyCount > 0 && (
            <button
              onClick={async () => {
                try {
                  await undoLast();
                  setToast({ text: "Änderung rückgängig gemacht" });
                } catch (e) {
                  handleError(e);
                }
              }}
            >
              <Undo2 size={14} />
              Rückgängig
            </button>
          )}
          <IconButton title="Hinweis schließen" onClick={() => setToast(null)}>
            <X size={14} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
function DayNote({
  day,
  value,
  onSave,
}: {
  day: string;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(Boolean(value)),
    [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="day-note">
      {open ? (
        <textarea
          aria-label={`Tagesnotiz ${day}`}
          placeholder="Ein Gedanke für diesen Tag …"
          value={draft}
          maxLength={10000}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== value) onSave(draft);
            if (!draft) setOpen(false);
          }}
        />
      ) : (
        <button onClick={() => setOpen(true)}>
          <FileText size={12} />
          Tagesnotiz
        </button>
      )}
    </div>
  );
}
function Detail({
  isNew = false,
  onNavigate,
  todo,
  onClose,
  onSave,
  onDelete,
  aiAvailable,
  onError,
  onRepeat,
  onAiConnected,
}: {
  isNew?: boolean;
  onNavigate?: (key: string) => void;
  todo: Todo;
  onClose: () => void;
  onSave: (todo: Todo) => Promise<void>;
  onDelete: () => void;
  onRepeat: (days: number[], weeks: number) => Promise<void>;
  onAiConnected: () => void;
  aiAvailable: boolean;
  onError: (e: unknown) => void;
}) {
  const [draft, setDraft] = useState(todo),
    [saving, setSaving] = useState(false),
    [subtask, setSubtask] = useState(""),
    [chat, setChat] = useState(false),
    [saved, setSaved] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]),
    [repeatWeeks, setRepeatWeeks] = useState(8),
    [repeating, setRepeating] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(todo);
  const update = (patch: Partial<Todo>) => {
    setDraft((t) => ({ ...t, ...patch }));
    setSaved(false);
  };
  const persist = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      return true;
    } catch (e) {
      onError(e);
      return false;
    } finally {
      setSaving(false);
    }
  };
  const close = async () => {
    if (isNew || !dirty || (await persist())) onClose();
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        onNavigate &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        e.preventDefault();
        void (async () => {
          if (!dirty || (await persist())) onNavigate(e.key);
        })();
        return;
      }
      if (
        ["Backspace", "Delete"].includes(e.key) &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
        return;
      }
      if (
        /^[1-5]$/.test(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        e.preventDefault();
        update({
          color: Object.keys(TASK_COLORS)[Number(e.key) - 1] as Todo["color"],
        });
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  return (
    <div
      className="detail-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside
        className="detail-panel compact-detail"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Neue Aufgabe" : "Aufgabendetails"}
        tabIndex={-1}
        onMouseDown={(e) => {
          if (
            !(e.target as HTMLElement).closest(
              "input,textarea,select,button,a,[contenteditable]",
            )
          )
            e.currentTarget.focus();
        }}
      >
        <div className="detail-top">
          <span>
            <Circle size={14} />
            {isNew ? "NEUE AUFGABE" : "AUFGABENDETAILS"}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Details schließen und speichern"
            data-initial-focus={isNew ? undefined : true}
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        <div className="detail-scroll">
          <div className="detail-title">
            <button
              className={`task-check ${draft.done ? "checked" : ""}`}
              aria-label="Status ändern"
              onClick={() => update({ done: !draft.done })}
            >
              {draft.done && <Check size={13} />}
            </button>
            <textarea
              data-initial-focus={isNew ? true : undefined}
              placeholder="Was möchtest du erledigen?"
              aria-label="Aufgabentitel"
              value={draft.title}
              maxLength={500}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>
          <textarea
            className="description-input"
            aria-label="Beschreibung"
            placeholder="Worum geht es? Ergänze eine Beschreibung …"
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
          />
          <div className="assistant-section">
            <button
              className="assistant-heading"
              onClick={async () => {
                if (!isNew && !chat && dirty && !(await persist())) return;
                setChat(!chat);
              }}
            >
              <span>
                <Sparkles size={18} />
                <span>ChatGPT fragen</span>
              </span>
              <ChevronDown
                size={16}
                style={{ transform: chat ? "rotate(180deg)" : "" }}
              />
            </button>
            {chat && isNew && (
              <p className="assessment-label">
                Nach dem Anlegen kannst du die KI zu dieser Aufgabe fragen.
              </p>
            )}
            {chat && !isNew && (
              <TodoChat
                todo={draft}
                available={aiAvailable}
                onConnected={onAiConnected}
                onBeforeSend={async () => !dirty || (await persist())}
                onApply={(steps) =>
                  update({
                    subtasks: [
                      ...draft.subtasks,
                      ...steps.map((title) => ({
                        id: crypto.randomUUID(),
                        title,
                        done: false,
                      })),
                    ],
                  })
                }
              />
            )}
          </div>
          <div className="detail-fields">
            <div className="schedule-summary">
              {draft.plannedDate
                ? `${parseDate(draft.plannedDate).toLocaleDateString("de-DE")}${draft.time ? ` · ${draft.time} · ${draft.duration || 60} Min.` : " · Ohne Zeit"}`
                : "Inbox"}
            </div>
            {!isNew && (
              <details className="repeat-details">
                <summary>Wiederholen</summary>
                <fieldset className="repeat-picker">
                  <legend>Wöchentlich wiederholen</legend>
                  <div className="repeat-days">
                    {DAYS.map((day, i) => (
                      <button
                        type="button"
                        key={day}
                        aria-pressed={repeatDays.includes(i)}
                        onClick={() =>
                          setRepeatDays((d) =>
                            d.includes(i)
                              ? d.filter((x) => x !== i)
                              : [...d, i],
                          )
                        }
                      >
                        {day.slice(0, 2)}
                      </button>
                    ))}
                  </div>
                  <label>
                    Zeitraum
                    <select
                      value={repeatWeeks}
                      onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                    >
                      {[4, 8, 12, 26, 52].map((n) => (
                        <option key={n} value={n}>
                          {n} Wochen
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      !draft.plannedDate || !repeatDays.length || repeating
                    }
                    onClick={async () => {
                      setRepeating(true);
                      try {
                        if (dirty && !(await persist())) return;
                        await onRepeat(repeatDays, repeatWeeks);
                      } catch (e) {
                        onError(e);
                      } finally {
                        setRepeating(false);
                      }
                    }}
                  >
                    {repeating ? "Wird angelegt …" : "Wiederholungen anlegen"}
                  </button>
                </fieldset>
              </details>
            )}
            <fieldset className="priority-picker">
              <legend>Priorität</legend>
              {(
                [
                  ["high", "Hoch", "#df5b50"],
                  ["medium", "Mittel", "#d3a63a"],
                  ["low", "Niedrig", "#5b9c72"],
                ] as const
              ).map(([value, label, color]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value === "high" ? "Hohe" : value === "medium" ? "Mittlere" : "Niedrige"} Priorität`}
                  aria-pressed={draft.priority === value}
                  className="priority-flag"
                  style={{ "--flag-color": color } as React.CSSProperties}
                  onClick={() =>
                    update({
                      priority: draft.priority === value ? "none" : value,
                    })
                  }
                >
                  <Flag size={16} fill="currentColor" />
                  <span>{label}</span>
                </button>
              ))}
            </fieldset>
            <ColorPicker
              value={draft.color}
              onChange={(color) => update({ color })}
            />
            <label>
              <Layers2 size={15} />
              Tags
              <input
                aria-label="Tags, mit Komma getrennt"
                placeholder="Studium, Privat …"
                value={draft.tags.join(", ")}
                onChange={(e) =>
                  update({
                    tags: e.target.value.split(",").map((t) => t.trimStart()),
                  })
                }
                onBlur={() =>
                  update({
                    tags: draft.tags.map((t) => t.trim()).filter(Boolean),
                  })
                }
              />
            </label>
          </div>
          <div className="detail-section">
            <h3>
              Unteraufgaben
              <span>
                {draft.subtasks.filter((s) => s.done).length}/
                {draft.subtasks.length}
              </span>
            </h3>
            {draft.subtasks.map((s) => (
              <div key={s.id} className="subtask">
                <button
                  aria-label={`${s.title} abhaken`}
                  className={`task-check ${s.done ? "checked" : ""}`}
                  onClick={() =>
                    update({
                      subtasks: draft.subtasks.map((x) =>
                        x.id === s.id ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                >
                  {s.done && <Check size={11} />}
                </button>
                <span className={s.done ? "struck" : ""}>{s.title}</span>
                <IconButton
                  title="Unteraufgabe entfernen"
                  onClick={() =>
                    update({
                      subtasks: draft.subtasks.filter((x) => x.id !== s.id),
                    })
                  }
                >
                  <X size={12} />
                </IconButton>
              </div>
            ))}
            <form
              className="quick-add"
              onSubmit={(e) => {
                e.preventDefault();
                if (!subtask.trim()) return;
                update({
                  subtasks: [
                    ...draft.subtasks,
                    {
                      id: crypto.randomUUID(),
                      title: subtask.trim(),
                      done: false,
                    },
                  ],
                });
                setSubtask("");
              }}
            >
              <Plus size={14} />
              <input
                aria-label="Neue Unteraufgabe"
                placeholder="Kleinen Schritt hinzufügen"
                value={subtask}
                maxLength={500}
                onChange={(e) => setSubtask(e.target.value)}
              />
            </form>
          </div>
          <div className="detail-section">
            <h3>Notizen</h3>
            <textarea
              className="notes-input"
              aria-label="Notizen"
              placeholder="Links, Ideen und alles, was hilft …"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </div>
          <p className="created-at">
            Erstellt am {new Date(todo.createdAt).toLocaleDateString("de-DE")}
          </p>
        </div>
        <div className="detail-bottom">
          <IconButton
            title="Aufgabe löschen"
            className="delete-button"
            onClick={onDelete}
          >
            <Trash2 size={17} />
          </IconButton>
          <span>
            {saved ? "Gespeichert" : dirty ? "Ungespeicherte Änderungen" : ""}
          </span>
          <button
            className="primary-button"
            disabled={saving || !draft.title.trim()}
            onClick={persist}
          >
            {saving ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}
            {isNew ? "Aufgabe hinzufügen" : "Speichern"}
          </button>
        </div>
      </aside>
    </div>
  );
}
function TodoChat({
  todo,
  available,
  onBeforeSend,
  onApply,
  onConnected,
}: {
  todo: Todo;
  available: boolean;
  onConnected: () => void;
  onBeforeSend: () => Promise<boolean>;
  onApply: (steps: string[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [steps, setSteps] = useState<string[]>([]);
  useEffect(() => {
    api(`/api/chat?todoId=${encodeURIComponent(todo.id)}`)
      .then((data) => setMessages(data.messages))
      .catch((e) => setError(e.message));
  }, [todo.id]);
  async function send(text: string, action?: string) {
    if (busy || !text.trim()) return;
    if (!(await onBeforeSend())) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/chat", {
        todoId: todo.id,
        message: text,
        action,
      });
      setMessages(result.messages);
      setSteps(result.steps || []);
      setInput("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="chat">
      {!available && (
        <details className="api-connect-details">
          <summary>Direkte KI nicht verbunden · API einrichten</summary>
          <AiConnection onConnected={onConnected} />
        </details>
      )}
      <div className="chat-actions">
        {[
          ["steps", "In Schritte zerlegen"],
          ["estimate", "Zeit einschätzen"],
          ["study", "Lernplan erstellen"],
          ["explain", "Verständlich erklären"],
          ["priority", "Priorität einschätzen"],
        ].map(([action, label]) => (
          <button
            key={action}
            disabled={busy}
            onClick={() => (available ? send(label, action) : setInput(label))}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.map((m) => (
          <div className={`message ${m.role}`} key={m.id}>
            <span>{m.role === "user" ? "Du" : "Assistent"}</span>
            <p>{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="chat-thinking">
            <Loader2 size={14} className="spin" />
            Denkt mit …
          </div>
        )}
      </div>
      {steps.length > 0 && (
        <div className="suggestion">
          <strong>Vorgeschlagene Unteraufgaben</strong>
          <ul>
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <button
            className="secondary-button"
            onClick={() => {
              onApply(steps);
              setSteps([]);
            }}
          >
            Diese Schritte übernehmen
          </button>
          <small>Danach mit „Speichern“ bestätigen.</small>
        </div>
      )}
      {error && <p className="inline-error">{error}</p>}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          aria-label="Nachricht an den KI-Assistenten"
          placeholder="Wie gehe ich das am besten an?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button
          disabled={!available || busy || !input.trim()}
          aria-label="Nachricht senden"
        >
          <ArrowRight size={16} />
        </button>
      </form>
      {!available && (
        <div className="chatgpt-handoff">
          <button
            className="secondary-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `Hilf mir bei dieser Aufgabe: ${input || "Wie gehe ich am besten vor?"}\n${JSON.stringify({ title: todo.title, description: todo.description, notes: todo.notes, subtasks: todo.subtasks, plannedDate: todo.plannedDate, time: todo.time, duration: todo.duration })}`,
                );
                setError("Für ChatGPT kopiert.");
              } catch {
                setError("Kopieren wurde vom Browser blockiert.");
              }
            }}
          >
            Für ChatGPT kopieren
          </button>
          <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">
            ChatGPT öffnen ↗
          </a>
        </div>
      )}
    </div>
  );
}
function Settings({
  state,
  onClose,
  onRefresh,
  onError,
  accent,
  onAccent,
}: {
  state: AppState;
  accent: string;
  onAccent: (v: string) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  async function act(body: unknown) {
    setBusy(true);
    setStatus("");
    try {
      const result = await api("/api/calendar", body);
      await onRefresh();
      setStatus(result.message || "Kalender aktualisiert.");
      setName("");
      setUrl("");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Kalender und Einstellungen"
      >
        <div className="modal-heading">
          <h2>Dein Raum. Deine Kalender.</h2>
          <IconButton title="Einstellungen schließen" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <p className="modal-caption">
          Termine neben deinen Aufgaben. Ganz ohne Hin und Her.
        </p>
        <div className="connection-list">
          {state.connections.map((c) => (
            <div className="connection" key={c.id}>
              <span className="connection-icon" style={{ color: c.color }}>
                <CalendarDays size={19} />
              </span>
              <div>
                <strong>{c.name}</strong>
                <small>
                  {c.sourceType === "file"
                    ? "ICS-Datei"
                    : "Kalender-Abonnement"}{" "}
                  · Aktualisiert{" "}
                  {new Date(c.lastSynced).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {c.sourceType === "url" && " · Automatisch alle 15 Min."}
                </small>
                {c.lastError && (
                  <small className="sync-error" role="status">
                    {c.lastError}
                  </small>
                )}
              </div>
              {c.sourceType === "url" && (
                <button
                  className="icon-button"
                  disabled={busy}
                  title="Kalender synchronisieren"
                  aria-label="Kalender synchronisieren"
                  onClick={() => act({ action: "sync", id: c.id })}
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <button
                className="icon-button"
                disabled={busy}
                title="Kalender entfernen"
                aria-label={`Kalender ${c.name} entfernen`}
                onClick={() => act({ action: "disconnect", id: c.id })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="settings-section">
          <h3>Designfarbe</h3>
          <fieldset className="theme-picker">
            <legend>Gesamtdesign</legend>
            {[
              ["green", "Salbei"],
              ["blue", "Ozean"],
              ["purple", "Lavendel"],
              ["orange", "Aprikose"],
              ["rose", "Rosé"],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`theme-choice theme-${v}`}
                aria-pressed={accent === v}
                onClick={() => onAccent(v)}
              >
                <i />
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="settings-section">
          <h3>Kalender verbinden</h3>
          <p>
            Verwende eine iCal-/ICS-Adresse von deinem Kalenderanbieter oder
            importiere eine Datei.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "connect", name: name || "Mein Kalender", url });
            }}
          >
            <label>
              Kalendername
              <input
                placeholder="z. B. Universität"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              iCal-Adresse
              <input
                type="url"
                placeholder="https://…/kalender.ics"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </label>
            <button disabled={busy || !url} className="primary-button">
              {busy ? (
                <Loader2 className="spin" size={15} />
              ) : (
                <Plus size={15} />
              )}
              Kalender verbinden
            </button>
          </form>
          <div className="file-import">
            <span>oder</span>
            <label className="secondary-button">
              <Upload size={15} />
              ICS-Datei importieren
              <input
                type="file"
                accept=".ics,text/calendar"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    onError(
                      new Error("Die ICS-Datei darf höchstens 2 MB groß sein."),
                    );
                    return;
                  }
                  await act({
                    action: "connect",
                    name: name || file.name.replace(/\.ics$/i, ""),
                    content: await file.text(),
                  });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {status && <p className="success-message">{status}</p>}
          <small>
            Importierte Termine sind schreibgeschützt. URL-Kalender werden
            automatisch alle 15 Minuten aktualisiert, solange der Raum-Server
            läuft – auch bei geschlossenem Browser. Über ↻ kannst du jederzeit
            sofort aktualisieren. ICS-Dateien werden einmalig importiert.
            Wiederholungen werden für ein Jahr zurück und zwei Jahre im Voraus
            importiert.
          </small>
        </div>
        <div className="settings-section">
          <h3>Deine Daten</h3>
          <p>
            Aufgaben und Chats werden auf diesem Rechner in SQLite gespeichert.
            Diese Version verwendet ein lokales Profil.
          </p>
          <a className="secondary-button" href="/api/export" download>
            <Download size={15} />
            Datensicherung herunterladen
          </a>
        </div>
        <div className="settings-section">
          <h3>Als App verwenden</h3>
          <p>
            Öffne das Browsermenü und wähle „App installieren“ oder „Zum
            Home-Bildschirm“. Zum Bearbeiten muss der lokale Server erreichbar
            sein.
          </p>
        </div>
      </section>
    </div>
  );
}
