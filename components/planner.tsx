"use client";
import { TaskPersonAvatar } from "./person-avatar";
import { changedTaskFields, applySeriesEdit } from "@/lib/series-edit";
import { priorityOrder } from "@/lib/priority-order";
import { goBackView, goForwardView, useViewHistory } from "@/lib/view-history";
import Statistics from "./statistics";
import { useAreaSelection } from "./use-area-selection";
import {
  installHistory,
  record,
  travel,
  historySize,
} from "@/lib/client-history";
import ReminderSetup from "./reminder-setup";
import LifeInbox from "./life-inbox";
import InboxReturnDrop from "./inbox-return-drop";
import ColorPicker from "./task-color-picker";
import { useActionHints } from "./use-action-hints";
import {
  useShortcutPreferences,
  ShortcutWelcome,
  ShortcutSettings,
} from "./shortcut-hints";
import { taskColorForKey } from "@/lib/task-colors";
import ScheduleFields from "./schedule-fields";
import TimeInput from "./time-input";
import {
  addressFromText,
  mapsAddress,
  phonesFromText,
  phoneLink,
} from "@/lib/addresses";
import { pastedImage, prepareScreenshot } from "@/lib/pasted-image";
import ScreenshotImportReview from "./screenshot-import-review";
import {
  parseScreenshotImport,
  screenshotOccurrences,
  screenshotTasks,
  type ScreenshotEvent,
  type ScreenshotImport,
} from "@/lib/screenshot-import";
import { parseAppointmentInput } from "@/lib/appointment-input";
import { usePanelSwipe } from "./use-panel-swipe";
import DayPanel from "./day-panel";
import { CalendarOverview } from "./calendar-overview";
import {
  nextTask,
  shiftTasks,
  moveTaskGroup,
  periodRange,
} from "@/lib/calendar-interactions";
import { eventPresentation } from "@/lib/subjects";
import AiPlanner, { AiConnection } from "./ai-planner";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  MeasuringStrategy,
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
  Circle,
  Clock3,
  Flag,
  GripVertical,
  Inbox,
  Layers2,
  Loader2,
  Moon,
  Plus,
  Play,
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
    priority: "low",
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
      data-task-id={todo.id}
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
        <span className="task-title">
          <TaskPersonAvatar todo={todo} small />
          {todo.title}
        </span>
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
  const inputRef = useRef<HTMLInputElement>(null);
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
      <button
        type="button"
        aria-label="Aufgabe eingeben"
        onClick={() => inputRef.current?.focus()}
      >
        <Plus size={15} />
      </button>
      <input
        ref={inputRef}
        aria-label={day ? `Aufgabe für ${day}` : "Aufgabe für die Inbox"}
        placeholder={day ? "" : "Aufgabe hinzufügen"}
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
  const shortcutHints = useShortcutPreferences();
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
  const [deleteSeries, setDeleteSeries] = useState<Todo | null>(null);
  useEffect(() => {
    const uninstall = installHistory();
    const refresh = () => {
      void load();
    };
    const count = () => setHistoryCount(historySize());
    const error = (e: Event) =>
      handleError(new Error((e as CustomEvent).detail));
    window.addEventListener("raum-data-changed", refresh);
    window.addEventListener("raum-history-count", count);
    window.addEventListener("raum-history-error", error);
    return () => {
      uninstall();
      window.removeEventListener("raum-data-changed", refresh);
      window.removeEventListener("raum-history-count", count);
      window.removeEventListener("raum-history-error", error);
    };
  }, []);
  const remember = (
    before: Todo[],
    after: Todo[],
    deleted?: { id: string; messages: ChatMessage[] }[],
    lifeChange?: { before: unknown; after: unknown },
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
      const apply = async (redo: boolean) => {
        const result = await api("/api/todos", {
          action: "undo",
          changes: redo
            ? changes.map((c) => ({ ...c, before: c.after, after: c.before }))
            : changes,
          lifeChange: lifeChange
            ? redo
              ? { before: lifeChange.after, after: lifeChange.before }
              : lifeChange
            : undefined,
        });
        setState((s) => ({ ...s, todos: result.todos }));
        setSelected(null);
      };
      record({ undo: () => apply(false), redo: () => apply(true) });
      history.current.push(changes);
      if (history.current.length > 50) history.current.shift();
      setHistoryCount(historySize());
    }
  };
  const undoLast = async () => {
    await travel();
  };
  const [datePreview, setDatePreview] = useState<string | null>(null);
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
  const [inboxWidth, setInboxWidth] = useState(300);
  const resizeStart = useRef(300);
  useEffect(() => {
    const w = Number(localStorage.getItem("raum-inbox-width"));
    if (w >= 230 && w <= 650) setInboxWidth(w);
  }, []);
  const [inboxOpen, setInboxOpen] = useState(true),
    [mobileInbox, setMobileInbox] = useState(false),
    [settings, setSettings] = useState(false),
    [newOpen, setNewOpen] = useState(false),
    [dark, setDark] = useState(false);
  const floatingInbox = Boolean(
    (dayPanel || selected || planning || settings || newOpen) &&
    (inboxOpen || mobileInbox),
  );
  const areaSelection = useAreaSelection(selectionMode, selectedIds, (ids) => {
    setSelectedIds(ids);
    setPicked(ids[0] || null);
    setSelectionMode(false);
  });
  const [editGroup, setEditGroup] = useState<string[]>([]);
  const [accent, setAccent] = useState("green");
  const mainRef = useRef<HTMLElement>(null);
  const backView = useViewHistory(
    {
      anchor,
      mobileDay,
      overview,
      dayPanel,
      selected,
      planning,
      settings,
      newOpen,
      inboxOpen,
      mobileInbox,
    },
    (view) => {
      setAnchor(view.anchor);
      setMobileDay(view.mobileDay);
      setOverview(view.overview);
      setDayPanel(view.dayPanel);
      setSelected(
        view.selected && state.todos.some((t) => t.id === view.selected)
          ? view.selected
          : null,
      );
      setPlanning(view.planning);
      setSettings(view.settings);
      setNewOpen(view.newOpen);
      setInboxOpen(view.inboxOpen);
      setMobileInbox(view.mobileInbox);
      setPicked(null);
      setSelectedIds([]);
      setSelectionMode(false);
    },
    true,
    (before, after) => {
      const keys = [
        "dayPanel",
        "selected",
        "planning",
        "settings",
        "newOpen",
        "inboxOpen",
        "mobileInbox",
      ] as const;
      return (
        before.anchor === after.anchor &&
        before.overview === after.overview &&
        keys.some((key) => Boolean(before[key]) && !after[key]) &&
        !keys.some((key) => !before[key] && Boolean(after[key]))
      );
    },
  );
  useEffect(() => {
    const back = (event: Event) => {
      if (event.defaultPrevented) return;
      if (selectionMode || selectedIds.length || picked) {
        setSelectionMode(false);
        setSelectedIds([]);
        setPicked(null);
        event.preventDefault();
      } else if (query) {
        setQuery("");
        event.preventDefault();
      } else if (inboxOpen || mobileInbox) {
        setInboxOpen(false);
        setMobileInbox(false);
        event.preventDefault();
      } else if (goBackView()) event.preventDefault();
    };
    window.addEventListener("raum-view-back", back);
    return () => window.removeEventListener("raum-view-back", back);
  }, [
    backView,
    selectionMode,
    selectedIds,
    picked,
    query,
    inboxOpen,
    mobileInbox,
  ]);
  const spaceJump = useRef<{
    index: number;
    target: number | null;
    at: number;
  }>({ index: 0, target: null, at: 0 });
  useEffect(() => {
    spaceJump.current = { index: 0, target: null, at: 0 };
  }, [anchor, overview]);
  const navigationAnchor = useRef(anchor);
  navigationAnchor.current = anchor;
  const [newSlot, setNewSlot] = useState<{
    day: string;
    time: string;
    duration?: number;
    days?: string[];
    drawn?: boolean;
  } | null>(null);
  const [dragged, setDragged] = useState<Todo | null>(null),
    [toast, setToast] = useState<{
      text: string;
      undo?: () => Promise<void>;
      detail?: string;
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
      if (e.defaultPrevented) return;
      const input = (e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable]",
      );
      const neutral =
        !input &&
        !document.querySelector('[role="dialog"], [role="menu"]') &&
        !selected &&
        !newOpen &&
        !planning &&
        !settings &&
        !dayPanel &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey;
      if (
        !input &&
        e.key.toLowerCase() === "a" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.repeat
      ) {
        e.preventDefault();
        setSelectionMode((value) => !value);
        return;
      }
      if (
        !input &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        selectedIds.length > 1 &&
        ["Delete", "Backspace"].includes(e.key)
      ) {
        e.preventDefault();
        void deleteGroup().catch(() => {});
        return;
      }
      if (neutral && e.key === "Tab") {
        e.preventDefault();
        setInboxOpen((v) => !v);
        setMobileInbox((v) => !v);
        return;
      }
      if (neutral && (e.code === "Space" || e.key === " ")) {
        const main = mainRef.current;
        const footer = main?.querySelector<HTMLElement>(".period-overview");
        if (main && footer) {
          e.preventDefault();
          const offset = (section: HTMLElement) =>
            Math.min(
              main.scrollHeight - main.clientHeight,
              Math.max(
                0,
                section.getBoundingClientRect().top -
                  main.getBoundingClientRect().top +
                  main.scrollTop -
                  64,
              ),
            );
          const targets = [0, offset(footer)];
          const previous = spaceJump.current;
          const continuing =
            previous.target !== null &&
            (Date.now() - previous.at < 800 ||
              Math.abs(main.scrollTop - previous.target) < 32);
          const current = continuing
            ? previous.index
            : main.scrollTop >= targets[1] - 32
              ? 1
              : 0;
          const next = (current + 1) % 2;
          spaceJump.current = {
            index: next,
            target: targets[next],
            at: Date.now(),
          };
          main.scrollTo({ top: targets[next], behavior: "smooth" });
        }
        return;
      }
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
        if (e.key === "Escape") {
          setSelectionMode(false);
          setSelectedIds([]);
          setPicked(null);
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
        taskColorForKey(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const t = state.todos.find((t) => t.id === picked);
        if (t)
          void save({
            ...t,
            color: taskColorForKey(e.key),
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
      if (editable(e.target) || planning || settings || newOpen) return;
      if (selectedIds.length > 1 && e.clipboardData) {
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
                Array.isArray(t.tags) &&
                Array.isArray(t.subtasks),
            )
          ) {
            e.preventDefault();
            const target = pasteTarget || {
              day: dayPanel
                ? periodRange(dayPanel)!.start
                : group[0].plannedDate,
              time: group[0].time || "",
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
      else if (dayPanel)
        void duplicate(
          todo,
          periodRange(dayPanel)!.start,
          todo.time || "",
        ).catch(handleError);
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
  useEffect(() => {
    const forward = (e: Event) => {
      if (goForwardView()) e.preventDefault();
    };
    const inbox = (e: Event) => {
      e.preventDefault();
      const open = inboxOpen || mobileInbox;
      setInboxOpen(!open);
      setMobileInbox(!open);
    };
    const select = (e: Event) => {
      e.preventDefault();
      setSelectionMode((v) => !v);
    };
    const removeSelection = (e: Event) => {
      if (selectedIds.length) {
        e.preventDefault();
        if (selectedIds.length === 1) {
          const task = state.todos.find((t) => t.id === selectedIds[0]);
          if (task) void remove(task).catch(handleError);
        } else void deleteGroup().catch(handleError);
      }
    };
    window.addEventListener("raum-view-forward", forward);
    window.addEventListener("raum-inbox-toggle", inbox);
    window.addEventListener("raum-selection-toggle", select);
    window.addEventListener("raum-selection-delete", removeSelection);
    return () => {
      window.removeEventListener("raum-view-forward", forward);
      window.removeEventListener("raum-inbox-toggle", inbox);
      window.removeEventListener("raum-selection-toggle", select);
      window.removeEventListener("raum-selection-delete", removeSelection);
    };
  }, [inboxOpen, mobileInbox, selectedIds, state.todos]);
  const [seriesQuestion, setSeriesQuestion] = useState<{
    title: string;
    resolve: (all: boolean | null) => void;
  } | null>(null);
  const [renameBlock, setRenameBlock] = useState<{
    old: string;
    title: string;
  } | null>(null);
  const calendarClick = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (calendarClick.current) clearTimeout(calendarClick.current);
    },
    [],
  );
  const askSeries = (title: string) =>
    new Promise<boolean | null>((resolve) =>
      setSeriesQuestion({ title, resolve }),
    );
  const mutate = async (body: unknown, ask = true) => {
    if (ask) {
      const command = body as {
        action: string;
        todo?: Todo;
        id?: string;
        plannedDate?: string | null;
        time?: string;
        duration?: number | null;
        moves?: Partial<Todo>[];
        changes?: { id: string; before: Todo | null; after: Todo | null }[];
      };
      const updates: Todo[] =
        command.action === "save" && command.todo
          ? [command.todo]
          : command.action === "schedule"
            ? state.todos
                .filter((t) => t.id === command.id)
                .map((t) => ({
                  ...t,
                  plannedDate: command.plannedDate ?? null,
                  time: command.time || "",
                  duration: command.duration ?? null,
                }))
            : command.action === "move"
              ? (command.moves || []).flatMap((m) => {
                  const t = state.todos.find((t) => t.id === m.id);
                  return t ? [{ ...t, ...m }] : [];
                })
              : command.action === "batch"
                ? (command.changes || []).flatMap((c) =>
                    c.before ? [c.before] : [],
                  )
                : [];
      const expanded = new Map(updates.map((t) => [t.id, t]));
      const asked = new Set<string>();
      let scopeAsked = false;
      for (const edited of updates) {
        const source = state.todos.find((t) => t.id === edited.id);
        if (
          !source?.seriesId ||
          asked.has(source.seriesId) ||
          !changedTaskFields(source, edited).length
        )
          continue;
        const chain = state.todos.filter((t) => t.seriesId === source.seriesId);
        if (chain.length < 2) continue;
        asked.add(source.seriesId);
        scopeAsked = true;
        const all = await askSeries(source.title);
        if (all === null) throw new Error("Änderung abgebrochen.");
        if (all)
          for (const target of chain)
            expanded.set(target.id, applySeriesEdit(source, edited, target));
      }
      if (scopeAsked)
        body = {
          action: "batch",
          changes: [...expanded.values()].map((t) => ({
            id: t.id,
            before: t,
            after: state.todos.find((x) => x.id === t.id) || null,
          })),
        };
    }
    if (lock.current)
      throw new Error(
        "Eine Änderung wird gerade gespeichert. Bitte kurz warten.",
      );
    lock.current = true;
    setBusy(true);
    try {
      const before = (await api("/api/state")).todos as Todo[];
      const result = await api("/api/todos", body);
      remember(
        before,
        result.todos,
        result.deleted
          ? [{ id: result.deleted.id, messages: result.messages }]
          : result.deletedMany,
        result.lifeChange,
      );
      setState((prev) => ({ ...prev, todos: result.todos }));
      if (result.lifeChange)
        window.dispatchEvent(new Event("raum-life-changed"));
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
    if (
      todo.seriesId &&
      state.todos.filter((t) => t.seriesId === todo.seriesId).length > 1
    ) {
      setDeleteSeries(todo);
      return;
    }
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
  const openCalendarTask = (id: string) => {
    setInboxOpen(false);
    setMobileInbox(false);
    setSelected(id);
    setPicked(id);
    setSelectedIds([id]);
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
  const pasteGroup = async (
    group: Todo[],
    day: string | null,
    time: string,
  ) => {
    if (!group.length) return;
    const moved = day ? moveTaskGroup(group, group[0], day, time) : group;
    const copies = moved.map((t, i) => ({
      ...structuredClone(t),
      id: crypto.randomUUID(),
      done: false,
      createdAt: new Date().toISOString(),
      position: state.todos.length + i + 1,
      subtasks: t.subtasks.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        done: false,
      })),
    }));
    await batchUpdate(copies);
    setSelectedIds(copies.map((t) => t.id));
    setPicked(copies[0]?.id || null);
    setToast({ text: `${copies.length} Termine eingefügt` });
  };
  const extendAcross = async (source: Todo, days: string[]) => {
    const dates = [...new Set(days)].filter((d) => d !== source.plannedDate);
    if (!dates.length) return;
    const copies = dates.map((day) => ({
      ...structuredClone(source),
      id: crypto.randomUUID(),
      seriesId: source.seriesId || source.id,
      plannedDate: day,
      done: false,
      createdAt: new Date().toISOString(),
      subtasks: source.subtasks.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        done: false,
      })),
    }));
    await mutate({
      action: "createMany",
      todos: copies,
      source: { ...source, seriesId: source.seriesId || source.id },
    });
    setDayPanel(null);
    setEditGroup([source.id, ...copies.map((t) => t.id)]);
    setSelected(source.id);
    setPicked(source.id);
  };
  const move = async ({
    active,
    over,
    activatorEvent,
    delta,
  }: DragEndEvent) => {
    setDragged(null);
    if (!over || active.id === over.id) return;
    let source = state.todos.find(
      (t) => t.id === (active.data.current?.todoId || active.id),
    );
    const suggestion = active.data.current?.suggestion;
    if (!source && suggestion) {
      source = {
        ...newTodo(suggestion.title, null, state.todos.length + 1),
        color: suggestion.color || "green",
        tags: suggestion.tags,
        notes: suggestion.notes + (suggestion.url ? `\n${suggestion.url}` : ""),
      };
      if (over.data.current?.kind !== "todo-priority")
        await mutate({ action: "save", todo: source });
    }
    if (!source) return;
    if (over.data.current?.kind === "inbox-return") {
      const returning =
        selectedIds.length > 1 && selectedIds.includes(source.id)
          ? state.todos.filter((t) => selectedIds.includes(t.id))
          : [source];
      await batchUpdate(
        returning.map((todo, i) => ({
          ...todo,
          plannedDate: null,
          time: "",
          duration: null,
          position: state.todos.length + i + 1,
        })),
      );
      setToast({
        text:
          returning.length > 1
            ? "Aufgaben zurück in der Inbox"
            : "Aufgabe zurück in der Inbox",
      });
      return;
    }
    if (source && over.data.current?.kind === "todo-priority") {
      const data = over.data.current;
      const inferred = source.priority;
      if (
        selectedIds.length > 1 &&
        selectedIds.includes(source.id) &&
        !suggestion
      ) {
        let current = state.todos;
        const changed = new Set<string>();
        for (const id of selectedIds) {
          const task = current.find((t) => t.id === id);
          if (!task) continue;
          const updates = priorityOrder(
            current,
            task,
            data.beforeId ?? null,
            data.priority || inferred,
            data.horizon,
          );
          updates.forEach((t) => changed.add(t.id));
          current = current.map((t) => updates.find((u) => u.id === t.id) || t);
        }
        await batchUpdate(current.filter((t) => changed.has(t.id)));
        return;
      }
      const updated = priorityOrder(
        state.todos,
        source,
        data.beforeId ?? null,
        data.priority || inferred,
        data.horizon,
      );
      if (suggestion) {
        const current = (await api("/api/state")).todos as Todo[];
        await mutate({
          action: "batch",
          changes: updated.map((t) => ({
            id: t.id,
            before: t,
            after: current.find((x) => x.id === t.id) || null,
          })),
        });
      } else await batchUpdate(updated);
      return;
    }

    if (["periodday", "periodpanel"].includes(over.data.current?.kind)) {
      const day = over.data.current!.day as string;
      if (selectedIds.length > 1 && selectedIds.includes(source.id)) {
        await batchUpdate(
          moveTaskGroup(
            state.todos.filter((t) => selectedIds.includes(t.id)),
            source,
            day,
          ),
        );
        if (!source.time) {
          setDayPanel(null);
          setEditGroup(selectedIds);
          setSelected(source.id);
        }
        return;
      }
      await mutate({
        action: "schedule",
        id: source.id,
        plannedDate: day,
        time: source.time || "",
        duration: source.duration,
      });
      setDayPanel(null);
      setEditGroup([source.id]);
      setSelected(source.id);
      setPicked(source.id);
      return;
    }
    if (over.data.current?.kind === "timegrid") {
      const day = over.data.current!.day as string;
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
          moveTaskGroup(
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
    if (selectedIds.length > 1 && selectedIds.includes(source.id)) {
      await batchUpdate(
        state.todos
          .filter((t) => selectedIds.includes(t.id))
          .map((t, i) => ({
            ...t,
            plannedDate: day,
            time: "",
            position: state.todos.length + i,
          })),
      );
      return;
    }
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
  const tags = [
    ...new Set(
      state.todos.flatMap((t) => t.tags.filter((x) => !/^(k|r|h):/.test(x))),
    ),
  ].sort();
  const current = state.todos.find((t) => t.id === selected);
  const eventsFor = (day: string) =>
    state.events.filter((e) =>
      e.allDay
        ? e.start.slice(0, 10) <= day && e.end.slice(0, 10) > day
        : new Date(e.start) <
            new Date(`${dateKey(addDays(parseDate(day), 1))}T00:00:00`) &&
          new Date(e.end) > new Date(`${day}T00:00:00`),
    );
  const navigate = useCallback(
    (direction: number) => {
      const next = parseDate(navigationAnchor.current);
      if (overview === "month") next.setDate(1);
      if (overview === "year") next.setMonth(0, 1);
      if (overview === "year") next.setFullYear(next.getFullYear() + direction);
      else if (overview === "month") next.setMonth(next.getMonth() + direction);
      else next.setDate(next.getDate() + direction * 7);
      navigationAnchor.current = dateKey(next);
      setAnchor(dateKey(next));
      setMobileDay(dateKey(next));
    },
    [overview],
  );

  useActionHints(shortcutHints.enabled);

  usePanelSwipe({
    navigate,
    openDetail: () => {
      if (picked && state.todos.some((todo) => todo.id === picked))
        setSelected(picked);
      else {
        setNewSlot({ day: dateKey(new Date()), time: "", drawn: false });
        setNewOpen(true);
      }
    },
    inboxOpen: inboxOpen || mobileInbox,
    detailOpen: Boolean(selected || newOpen),
    blocked: Boolean(dragged || selectionMode),
    setInbox: (open) => {
      if ((inboxOpen || mobileInbox) === open) return;
      setInboxOpen(open);
      setMobileInbox(open);
    },
  });

  return (
    <div
      className={`app-shell ${selectionMode ? "area-selection-mode" : ""} ${floatingInbox ? "floating-inbox-open" : ""}`}
      {...areaSelection.bind}
      onClickCapture={(event) => {
        const node = (event.target as Element).closest<HTMLElement>(
          "[data-calendar-task],[data-calendar-event]",
        );
        if (
          !node ||
          !(event.target as Element).closest(
            ".timeline,.timeline-scroll,.calendar-overview",
          )
        )
          return;
        event.stopPropagation();
        if (calendarClick.current) clearTimeout(calendarClick.current);
        if (event.detail > 1) return;
        const id = node.dataset.calendarTask,
          eventId = node.dataset.calendarEvent;
        const open = () => {
          if (id) {
            openCalendarTask(id);
          } else {
            const item = state.events.find((e) => e.id === eventId);
            if (item) setToast({ text: item.title });
          }
        };
        if (event.detail === 0) open();
        else calendarClick.current = setTimeout(open, 300);
      }}
      onDoubleClickCapture={(event) => {
        const node = (event.target as Element).closest<HTMLElement>(
          "[data-calendar-task],[data-calendar-event]",
        );
        if (
          !node ||
          !(event.target as Element).closest(
            ".timeline,.timeline-scroll,.calendar-overview",
          )
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (calendarClick.current) clearTimeout(calendarClick.current);
        const item = node.dataset.calendarTask
          ? state.todos.find((t) => t.id === node.dataset.calendarTask)
          : state.events.find((e) => e.id === node.dataset.calendarEvent);
        if (item) setRenameBlock({ old: item.title, title: item.title });
      }}
    >
      {shortcutHints.firstUse && (
        <ShortcutWelcome onChoose={shortcutHints.configure} />
      )}
      {areaSelection.rect && (
        <div
          className="selection-rectangle global-selection-rectangle"
          style={areaSelection.rect}
        />
      )}
      <DndContext
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        sensors={sensors}
        collisionDetection={(args) => {
          if (args.active.data.current?.kind === "life-tab") {
            const filtered = {
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) => c.data.current?.kind === "life-tab",
              ),
            };
            const tabHits = pointerWithin(filtered);
            return tabHits.length ? tabHits : closestCorners(filtered);
          }
          const scoped = {
            ...args,
            droppableContainers:
              dayPanel || selected || settings || planning || newOpen
                ? args.droppableContainers.filter((c) =>
                    c.node.current?.closest(
                      dayPanel
                        ? '.day-panel[role="dialog"],.sidebar'
                        : ".sidebar",
                    ),
                  )
                : args.droppableContainers,
          };
          const hits = pointerWithin(scoped);
          const inboxReturn = hits.find((hit) => hit.id === "inbox-return");
          if (inboxReturn) return [inboxReturn];
          if (hits.length)
            return [...hits].sort(
              (a, b) =>
                Number(
                  Boolean(
                    args.droppableContainers.find((c) => c.id === b.id)?.data
                      .current?.priority,
                  ),
                ) -
                  Number(
                    Boolean(
                      args.droppableContainers.find((c) => c.id === a.id)?.data
                        .current?.priority,
                    ),
                  ) ||
                (args.droppableRects.get(a.id)?.width || 0) *
                  (args.droppableRects.get(a.id)?.height || 0) -
                  (args.droppableRects.get(b.id)?.width || 0) *
                    (args.droppableRects.get(b.id)?.height || 0),
            );
          if (
            args.pointerCoordinates &&
            (dayPanel || selected || settings || planning || newOpen)
          )
            return [];
          return closestCorners(scoped);
        }}
        onDragStart={(e) =>
          setDragged(
            state.todos.find(
              (t) => t.id === (e.active.data.current?.todoId || e.active.id),
            ) ||
              (e.active.data.current?.suggestion
                ? {
                    ...newTodo(e.active.data.current.suggestion.title, null, 0),
                    color: e.active.data.current.suggestion.color || "green",
                  }
                : null),
          )
        }
        onDragMove={({ activatorEvent, delta }) => {
          if (
            "clientX" in activatorEvent &&
            Number(activatorEvent.clientX) + delta.x <= 26
          ) {
            setInboxOpen(true);
            setMobileInbox(true);
          }
        }}
        onDragCancel={() => setDragged(null)}
        onDragEnd={(event) => {
          if (event.active.data.current?.kind === "life-tab") {
            if (event.over?.data.current?.kind === "life-tab")
              window.dispatchEvent(
                new CustomEvent("raum-tab-reorder", {
                  detail: {
                    active: event.active.data.current.tabId,
                    over: event.over.data.current.tabId,
                  },
                }),
              );
            return;
          }
          void move(event).catch(handleError);
        }}
      >
        <div
          style={{ "--inbox-width": `${inboxWidth}px` } as React.CSSProperties}
          className={`workspace ${!inboxOpen ? "inbox-collapsed" : ""} ${mobileInbox ? "show-mobile-inbox" : ""}`}
        >
          <aside
            className="sidebar"
            onMouseLeave={(event) => {
              if (event.buttons || dragged || selectionMode) return;
              const next = event.relatedTarget;
              if (
                next instanceof Element &&
                next.closest('[role="menu"], [role="dialog"]')
              )
                return;
              setInboxOpen(false);
              setMobileInbox(false);
            }}
            data-escape-layer={floatingInbox ? "" : undefined}
            data-escape-modal={floatingInbox ? "" : undefined}
          >
            <div
              className="inbox-resize"
              role="separator"
              aria-label="Inboxbreite"
              aria-orientation="vertical"
              onPointerDown={(e) => {
                e.preventDefault();
                resizeStart.current = inboxWidth;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  const width = Math.max(
                    230,
                    Math.min(
                      650,
                      e.clientX -
                        e.currentTarget.parentElement!.getBoundingClientRect()
                          .left,
                    ),
                  );
                  setInboxWidth(width);
                  localStorage.setItem("raum-inbox-width", String(width));
                }
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                const before = resizeStart.current,
                  after = inboxWidth;
                const apply = async (w: number) => {
                  setInboxWidth(w);
                  localStorage.setItem("raum-inbox-width", String(w));
                };
                if (before !== after)
                  record({
                    undo: () => apply(before),
                    redo: () => apply(after),
                  });
              }}
            />

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
            <InboxReturnDrop todos={state.todos} />
            <LifeInbox
              events={state.events}
              todos={state.todos}
              onAdd={async (title, tags, notes, color) => {
                const task = {
                  ...newTodo(title, null, state.todos.length + 1),
                  tags,
                  notes,
                  color: color || "green",
                };
                await mutate({ action: "save", todo: task });
              }}
              onOpen={setSelected}
              onPriority={(todo, priority, horizon) => {
                const ranks = { high: 0, medium: 1, low: 2, none: 2 };
                const first = state.todos
                  .filter(
                    (t) =>
                      t.id !== todo.id &&
                      !t.plannedDate &&
                      !t.done &&
                      (t.tags.find((tag) => /^h:/.test(tag)) || "h:week") ===
                        `h:${horizon}` &&
                      ranks[t.priority] >= ranks[priority],
                  )
                  .sort(
                    (a, b) =>
                      ranks[a.priority] - ranks[b.priority] ||
                      a.position - b.position,
                  )[0];
                void batchUpdate(
                  priorityOrder(
                    state.todos,
                    todo,
                    first?.id || null,
                    priority,
                    horizon,
                  ),
                ).catch(handleError);
              }}
            >
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
                <button
                  className="text-button"
                  onClick={() => setSettings(true)}
                >
                  <Plus size={14} />
                  Kalender verbinden
                </button>
                {shortcutHints.enabled && (
                  <span className="keyboard-hint">
                    <kbd>N</kbd> Neue Aufgabe <kbd>T</kbd> Heute
                  </span>
                )}
              </div>
            </LifeInbox>
          </aside>
          <main ref={mainRef} className="main-content">
            <div className="planner-toolbar">
              <div className="week-nav">
                {!inboxOpen && (
                  <IconButton
                    title="Inbox öffnen"
                    onClick={() => {
                      setInboxOpen(true);
                      setMobileInbox(true);
                    }}
                  >
                    <PanelLeft size={17} />
                  </IconButton>
                )}
                <h2
                  className="overview-nav date-navigation"
                  onMouseLeave={() => setDatePreview(null)}
                >
                  <button
                    aria-label="Wochenübersicht öffnen"
                    onClick={() => {
                      setOverview(null);
                      setDatePreview(null);
                    }}
                    onMouseEnter={() =>
                      setDatePreview(`month:${anchor.slice(0, 7)}-01`)
                    }
                  >
                    {start.getDate()}.–{end.getDate()}.
                  </button>
                  <button
                    aria-label="Monatsübersicht öffnen"
                    onClick={() => {
                      setOverview("month");
                      setAnchor(`${anchor.slice(0, 7)}-01`);
                      setDatePreview(null);
                    }}
                    onMouseEnter={() =>
                      setDatePreview(`month:${anchor.slice(0, 7)}-01`)
                    }
                  >
                    {parseDate(anchor).toLocaleDateString("de-DE", {
                      month: "long",
                    })}
                  </button>
                  <button
                    className="header-year"
                    aria-label="Jahresübersicht öffnen"
                    onClick={() => {
                      setOverview("year");
                      setAnchor(`${anchor.slice(0, 4)}-01-01`);
                      setDatePreview(null);
                    }}
                    onMouseEnter={() =>
                      setDatePreview(`year:${anchor.slice(0, 4)}-01-01`)
                    }
                  >
                    {anchor.slice(2, 4)}
                  </button>
                  {datePreview && (
                    <div className="header-date-preview" data-escape-layer>
                      <button
                        hidden
                        data-close
                        type="button"
                        onClick={() => setDatePreview(null)}
                      >
                        Schließen
                      </button>
                      <CalendarOverview
                        period={datePreview}
                        todos={state.todos}
                        events={state.events}
                        connections={state.connections}
                        onPick={(day) => {
                          setAnchor(day);
                          setMobileDay(day);
                          setOverview(null);
                          setDatePreview(null);
                        }}
                        onNavigatePeriod={(period) => {
                          setAnchor(period.anchor);
                          setMobileDay(period.anchor);
                          setOverview(period.view);
                          setDatePreview(null);
                        }}
                      />
                    </div>
                  )}
                </h2>
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
              <form
                className="planning-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPlanning(true);
                }}
              >
                <Sparkles size={15} />
                <input
                  aria-label={`${overview === "year" ? "Jahr" : overview === "month" ? "Monat" : "Woche"} mit KI planen`}
                  placeholder={`${overview === "year" ? "Jahr" : overview === "month" ? "Monat" : "Woche"} planen, Ziele besprechen …`}
                  value={planningInput}
                  onChange={(e) => setPlanningInput(e.target.value)}
                />
                <button type="submit" aria-label="KI-Planung öffnen">
                  <ArrowRight size={14} />
                </button>
              </form>
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
              <IconButton
                title={dark ? "Helles Design" : "Dunkles Design"}
                onClick={() => {
                  const previous = dark;
                  setDark(!dark);
                  record({
                    undo: async () => setDark(previous),
                    redo: async () => setDark(!previous),
                  });
                }}
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
                onExtend={extendAcross}
                onCreate={(day) => {
                  setInboxOpen(false);
                  setMobileInbox(false);
                  setNewSlot({ day, time: "", drawn: false });
                  setNewOpen(true);
                }}
                onOpen={(id) => {
                  setEditGroup([id]);
                  openCalendarTask(id);
                }}
                period={`${overview}:${overview === "year" ? anchor.slice(0, 4) + "-01-01" : anchor.slice(0, 7) + "-01"}`}
                todos={state.todos.filter(visible)}
                events={state.events}
                connections={state.connections}
                onPick={(day) => {
                  setAnchor(day);
                  setMobileDay(day);
                  setOverview(null);
                }}
                onNavigatePeriod={(period) => {
                  setAnchor(period.anchor);
                  setMobileDay(period.anchor);
                  setOverview(period.view);
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
                  setPasteTarget(null);
                  openCalendarTask(id);
                }}
                onToggle={toggle}
                onResize={reschedule}
                onExtend={async (todo, days) => {
                  try {
                    await mutate({
                      action: "createMany",
                      source: { ...todo, seriesId: todo.seriesId || todo.id },
                      todos: days.map((day) => ({
                        ...structuredClone(todo),
                        id: crypto.randomUUID(),
                        seriesId: todo.seriesId || todo.id,
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
                onCreate={(day, time, duration, days, drawn) => {
                  setInboxOpen(false);
                  setMobileInbox(false);
                  setPasteTarget({ day, time });
                  setNewSlot({ day, time, duration, days, drawn });
                  setNewOpen(true);
                }}
                onEvent={(event) => setToast({ text: event.title })}
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
            <DayPanel
              inline
              key={`bottom:${overview}:${anchor}`}
              day={`${overview || "week"}:${overview === "year" ? anchor.slice(0, 4) + "-01-01" : overview === "month" ? anchor.slice(0, 7) + "-01" : dateKey(start)}`}
              state={state}
              onClose={() => {}}
              onOpen={(id) => {
                setSelected(id);
                setPicked(id);
              }}
              onAdd={async (title) => {
                const task = {
                  ...newTodo(title, null, state.todos.length + 1),
                  tags: [`h:${overview || "week"}`],
                };
                await save(task);
              }}
              onNote={async (content) => {
                const date = `${overview || "week"}:${overview === "year" ? anchor.slice(0, 4) + "-01-01" : overview === "month" ? anchor.slice(0, 7) + "-01" : dateKey(start)}`;
                await api("/api/notes", { date, content });
                setState((s) => ({
                  ...s,
                  dayNotes: { ...s.dayNotes, [date]: content },
                }));
              }}
              onConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
              onDay={(day) => {
                setAnchor(day);
                setMobileDay(day);
                setOverview(null);
              }}
              onExtend={extendAcross}
            />
            <Statistics
              state={state}
              anchor={anchor}
              kind={overview || "week"}
            />
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
            onExtend={extendAcross}
            state={state}
            onClose={() => {
              setDayPanel(null);
            }}
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
              setOverview(null);
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
          start={
            overview === "year"
              ? anchor.slice(0, 4) + "-01-01"
              : overview === "month"
                ? anchor.slice(0, 7) + "-01"
                : dateKey(start)
          }
          period={overview || "week"}
          initialMessage={planningInput}
          available={state.aiAvailable}
          onConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
          onAccepted={(todos) => {
            remember(state.todos, todos);
            setState((s) => ({ ...s, todos }));
          }}
          onClose={() => {
            setPlanning(false);
          }}
        />
      )}
      {current && (
        <Detail
          editSchedule={editGroup.includes(current.id)}
          groupCount={editGroup.length}
          key={current.id}
          onNavigate={(key) => navigateTask(current.id, key, true)}
          todo={current}
          onClose={() => {
            setSelected(null);
            setEditGroup([]);
          }}
          onSave={async (draft, imported) => {
            if (imported) {
              const tasks = screenshotTasks(
                draft,
                imported,
                () => crypto.randomUUID(),
                true,
              );
              await batchUpdate(tasks);
              if (tasks.length > 1)
                setToast({
                  text: `${tasks.length} Screenshot-Termine gespeichert`,
                });
              return;
            }
            if (editGroup.length > 1 && editGroup.includes(draft.id)) {
              await batchUpdate(
                state.todos
                  .filter((t) => editGroup.includes(t.id))
                  .map((t) => ({
                    ...t,
                    title: draft.title,
                    description: draft.description,
                    notes: draft.notes,
                    color: draft.color,
                    priority: draft.priority,
                    time: draft.time,
                    duration: draft.time ? draft.duration || 60 : null,
                    reminder: draft.reminder,
                  })),
              );
            } else await save(draft);
          }}
          onDelete={() => remove(current)}
          onRepeat={async (weekdays, weeks, source) => {
            await save(source);
            const result = await mutate({
              action: "repeat",
              todo: source,
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
          showSchedule={!newSlot?.drawn}
          todo={{
            ...newTodo("", newSlot?.day || null, state.todos.length + 1),
            time: newSlot?.time || "",
            duration: newSlot?.time ? newSlot.duration || 60 : null,
          }}
          onClose={() => {
            setNewOpen(false);
          }}
          onDelete={() => setNewOpen(false)}
          onRepeat={async (weekdays, weeks, source) => {
            await mutate({ action: "save", todo: source });
            await mutate({
              action: "repeat",
              id: source.id,
              todo: source,
              weekdays,
              weeks,
            });
            setNewOpen(false);
            setSelected(source.id);
          }}
          aiAvailable={state.aiAvailable}
          onAiConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
          onError={handleError}
          onSave={async (draft, imported) => {
            if (imported) {
              const tasks = screenshotTasks(draft, imported, () =>
                crypto.randomUUID(),
              );
              await mutate({ action: "createMany", todos: tasks });
              setToast({
                text:
                  tasks.length > 1
                    ? `${tasks.length} Screenshot-Termine erstellt`
                    : "Screenshot-Termin erstellt",
              });
              return;
            }
            const dates =
              (newSlot?.days?.length || 0) > 1
                ? newSlot!.days!
                : [draft.plannedDate];
            const todos = dates.map((day) => ({
              ...draft,
              id: crypto.randomUUID(),
              seriesId: dates.length > 1 ? draft.id : "",
              plannedDate: day,
              subtasks: draft.subtasks.map((t) => ({
                ...t,
                id: crypto.randomUUID(),
              })),
            }));
            await mutate({ action: "createMany", todos });
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
          shortcutHints={shortcutHints}
          onClose={() => {
            setSettings(false);
          }}
          onRefresh={load}
          onError={handleError}
          accent={accent}
          onAccent={(v) => {
            const previous = accent;
            const apply = async (value: string) => {
              setAccent(value);
              document.documentElement.dataset.accent = value;
              localStorage.setItem("raum-accent", value);
            };
            void apply(v);
            record({ undo: () => apply(previous), redo: () => apply(v) });
          }}
        />
      )}
      {seriesQuestion && (
        <div className="detail-backdrop" style={{ zIndex: 160 }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Wiederholung ändern"
            className="series-delete"
          >
            <button
              className="icon-button"
              aria-label="Rückfrage schließen"
              onClick={() => {
                seriesQuestion.resolve(null);
                setSeriesQuestion(null);
              }}
            >
              <X size={18} />
            </button>
            <h3>Änderung übernehmen für …</h3>
            <p>{seriesQuestion.title}</p>
            {[false, true].map((all) => (
              <button
                key={String(all)}
                className="secondary-button"
                onClick={() => {
                  seriesQuestion.resolve(all);
                  setSeriesQuestion(null);
                }}
              >
                {all ? "Alle wiederholten Termine" : "Nur diesen Termin"}
              </button>
            ))}
          </section>
        </div>
      )}
      {renameBlock && (
        <div className="detail-backdrop" style={{ zIndex: 160 }}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Themenname bearbeiten"
            className="series-delete"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!renameBlock.title.trim()) return;
              try {
                const result = await api("/api/block-names", {
                  action: "rename",
                  from: renameBlock.old,
                  to: renameBlock.title.trim(),
                });
                const apply = async (snapshot: unknown, expected: unknown) => {
                  await api("/api/block-names", {
                    action: "restore",
                    snapshot,
                    expected,
                  });
                  await load();
                };
                record({
                  undo: () => apply(result.before, result.after),
                  redo: () => apply(result.after, result.before),
                });
                await load();
                setRenameBlock(null);
                setToast({ text: "Gleichnamige Blöcke umbenannt" });
              } catch (e) {
                handleError(e);
              }
            }}
          >
            <button
              type="button"
              className="icon-button"
              aria-label="Namensbearbeitung schließen"
              onClick={() => setRenameBlock(null)}
            >
              <X size={18} />
            </button>
            <h3>Themenname</h3>
            <input
              autoFocus
              aria-label="Neuer Themenname"
              value={renameBlock.title}
              onChange={(e) =>
                setRenameBlock({ ...renameBlock, title: e.target.value })
              }
            />
            <p>Für alle Blöcke mit diesem Namen.</p>
            <button className="primary-button" type="submit">
              Übernehmen
            </button>
          </form>
        </div>
      )}
      {deleteSeries && (
        <div className="detail-backdrop" style={{ zIndex: 120 }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Termingruppe löschen"
            className="series-delete"
          >
            <button
              className="icon-button"
              aria-label="Löschfenster schließen"
              onClick={() => setDeleteSeries(null)}
            >
              <X size={18} />
            </button>
            <h3>Welche Termine löschen?</h3>
            <p>{deleteSeries.title}</p>
            {[
              ["one", "Nur diesen Termin"],
              ["following", "Diesen und alle folgenden"],
              ["all", "Die ganze Gruppe"],
            ].map(([scope, label]) => (
              <button
                key={scope}
                className="secondary-button"
                onClick={async () => {
                  try {
                    await mutate(
                      scope === "one"
                        ? { action: "delete", id: deleteSeries.id }
                        : {
                            action: "deleteSeries",
                            id: deleteSeries.id,
                            scope,
                          },
                    );
                    setDeleteSeries(null);
                    setSelected(null);
                  } catch (e) {
                    handleError(e);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>
            {toast.text}
            {toast.detail && (
              <small className="toast-detail">{toast.detail}</small>
            )}
          </span>
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
    <div className="day-note" data-escape-layer={open ? "" : undefined}>
      {open && (
        <button
          hidden
          data-close
          type="button"
          onClick={() => {
            if (draft !== value) onSave(draft);
            setOpen(false);
          }}
        >
          Schließen
        </button>
      )}
      {open ? (
        <div className="day-note-entry">
          <FileText size={12} aria-hidden="true" />
          <textarea
            autoFocus
            aria-label={`Tagesnotiz ${day}`}
            placeholder=""
            value={draft}
            maxLength={10000}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== value) onSave(draft);
              if (!draft) setOpen(false);
            }}
          />
        </div>
      ) : (
        <button
          aria-label={`Tagesnotiz ${day} bearbeiten`}
          title="Tagesnotiz"
          onClick={() => setOpen(true)}
        >
          <FileText size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
function Detail({
  isNew = false,
  editSchedule = false,
  showSchedule = true,
  groupCount = 1,
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
  editSchedule?: boolean;
  showSchedule?: boolean;
  groupCount?: number;
  onNavigate?: (key: string) => void;
  todo: Todo;
  onClose: () => void;
  onSave: (todo: Todo, imported?: ScreenshotEvent[]) => Promise<void>;
  onDelete: () => void;
  onRepeat: (days: number[], weeks: number, source: Todo) => Promise<void>;
  onAiConnected: () => void;
  aiAvailable: boolean;
  onError: (e: unknown) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [travelBusy, setTravelBusy] = useState(false);
  const [travelOrigin, setTravelOrigin] = useState("");
  const [travelOptions, setTravelOptions] = useState<
    {
      mode: "bike" | "transit";
      before?: number;
      after?: number;
      label?: string;
      error?: string;
    }[]
  >([]);
  const [routeLabel, setRouteLabel] = useState("");
  useEffect(() => {
    setTravelOrigin(localStorage.getItem("lifemap-travel-origin") || "");
  }, []);
  const imageRequest = useRef<AbortController | null>(null);
  useEffect(() => () => imageRequest.current?.abort(), []);
  const [draft, setDraft] = useState({
      ...todo,
      description: [todo.description, todo.notes].filter(Boolean).join("\n\n"),
      notes: "",
    }),
    [saving, setSaving] = useState(false),
    [subtask, setSubtask] = useState(""),
    [chat, setChat] = useState(false),
    [saved, setSaved] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]),
    [repeatWeeks, setRepeatWeeks] = useState(8),
    [repeating, setRepeating] = useState(false);
  const [screenshot, setScreenshot] = useState<ScreenshotImport | null>(null);
  const [importedFields, setImportedFields] = useState<string[]>([]);
  const dirty =
    Boolean(screenshot) || JSON.stringify(draft) !== JSON.stringify(todo);
  type DraftSnapshot = {
    todo: Todo;
    screenshot: ScreenshotImport | null;
    fields: string[];
  };
  const draftPast = useRef<DraftSnapshot[]>([]),
    draftFuture = useRef<DraftSnapshot[]>([]);
  const snapshot = (): DraftSnapshot => ({
    todo: draft,
    screenshot,
    fields: importedFields,
  });
  const restoreDraft = (value: DraftSnapshot) => {
    setDraft(value.todo);
    setScreenshot(value.screenshot);
    setImportedFields(value.fields);
  };
  const rememberDraft = () => {
    draftPast.current.push(snapshot());
    draftFuture.current = [];
    setSaved(false);
  };
  const update = (patch: Partial<Todo>) => {
    rememberDraft();
    setDraft((t) => ({ ...t, ...patch }));
  };
  const changeScreenshot = (plan: ScreenshotImport) => {
    rememberDraft();
    setScreenshot(plan);
  };
  const imported = (field: string) =>
    importedFields.includes(field) ? true : undefined;
  const extractTitle = (raw = draft.title) => {
    const parsed = parseAppointmentInput(
      raw,
      draft.plannedDate || dateKey(new Date()),
    );
    return {
      ...draft,
      title: parsed.title,
      location:
        parsed.location ||
        addressFromText(draft.description) ||
        draft.location ||
        "",
      description: [
        ...new Set(
          [draft.description, parsed.description]
            .filter(Boolean)
            .flatMap((text) => text.split(/\n+/)),
        ),
      ].join("\n"),
      plannedDate:
        parsed.plannedDate ||
        (parsed.time
          ? draft.plannedDate || dateKey(new Date())
          : draft.plannedDate),
      time: parsed.time || draft.time,
      duration:
        parsed.duration ||
        (parsed.time ? draft.duration || 60 : draft.duration),
    };
  };
  const applyTitle = (raw = draft.title) => {
    const next = extractTitle(raw);
    if (JSON.stringify(next) !== JSON.stringify(draft)) update(next);
  };
  const applyScreenshot = (text: string, before: string, after: string) => {
    const proposal = parseScreenshotImport(
      text,
      draft.plannedDate || dateKey(new Date()),
    );
    const first = proposal.events[0];
    const title =
      [before.trim(), first.title, after.trim()]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500) || draft.title;
    const next = {
      ...draft,
      title,
      plannedDate: first.plannedDate || draft.plannedDate,
      time: first.time || draft.time,
      duration:
        first.duration || (first.time ? draft.duration || 60 : draft.duration),
      location: first.location || draft.location || "",
    };
    const fields = (
      ["title", "plannedDate", "time", "duration", "location"] as const
    ).filter((field) => next[field] !== draft[field]);
    rememberDraft();
    setDraft(next);
    setScreenshot(proposal);
    setImportedFields([
      ...new Set([
        ...importedFields,
        ...fields,
        ...(proposal.events.length > 1 ? ["occurrences"] : []),
        ...(proposal.recurrence ? ["recurrence"] : []),
      ]),
    ]);
    if (next.location !== draft.location) setTravelOptions([]);
  };
  const destination =
    addressFromText(draft.title + "\n" + draft.description) ||
    draft.location ||
    "";
  const calculateTravel = async () => {
    if (!destination || !travelOrigin.trim() || travelBusy) return;
    setTravelBusy(true);
    try {
      const response = await fetch("/api/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: travelOrigin,
          destination,
          start: new Date(`${draft.plannedDate}T${draft.time}`).toISOString(),
          end: new Date(
            new Date(`${draft.plannedDate}T${draft.time}`).getTime() +
              (draft.duration || 60) * 60000,
          ).toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setTravelOptions(result.options);
      localStorage.setItem("lifemap-travel-origin", travelOrigin);
      setRouteLabel(`${result.origin} → ${result.destination}`);
    } catch (error) {
      onError(error);
    } finally {
      setTravelBusy(false);
    }
  };
  const persist = async () => {
    if (closing || (isNew && saved)) return false;
    if (readingImage || imageRequest.current || travelBusy) return false;
    setSaving(true);
    try {
      const parsed = extractTitle();
      await onSave(
        parsed,
        screenshot ? screenshotOccurrences(screenshot, parsed) : undefined,
      );
      setScreenshot(null);
      setImportedFields([]);
      draftPast.current = [];
      draftFuture.current = [];
      setSaved(true);
      return true;
    } catch (e) {
      onError(e);
      return false;
    } finally {
      setSaving(false);
    }
  };
  const beginClose = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, 220);
  };
  const close = async () => {
    if (closing) return;
    if (isNew || !dirty || (await persist())) beginClose();
  };
  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        ["z", "y"].includes(e.key.toLowerCase()) &&
        (Boolean(screenshot) ||
          !(e.target as HTMLElement).closest(
            "input,textarea,[contenteditable]",
          ))
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const redo = e.key.toLowerCase() === "y" || e.shiftKey;
        const from = redo ? draftFuture.current : draftPast.current,
          to = redo ? draftPast.current : draftFuture.current;
        if (from.length) {
          to.push(snapshot());
          restoreDraft(from.pop()!);
        } else void travel(redo);
        return;
      }
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
        taskColorForKey(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        e.preventDefault();
        update({
          color: taskColorForKey(e.key),
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
      className={`detail-backdrop task-detail-backdrop ${closing ? "is-closing" : ""}`}
      aria-hidden={closing || undefined}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside
        ref={panelRef}
        data-draft-editor
        className="detail-panel compact-detail"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Neue Aufgabe" : "Aufgabendetails"}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (
            e.key !== "Enter" ||
            e.defaultPrevented ||
            e.nativeEvent.isComposing ||
            e.repeat ||
            e.metaKey ||
            e.ctrlKey ||
            e.altKey ||
            e.shiftKey ||
            (e.target as HTMLElement).closest(
              "input,textarea,select,[contenteditable]",
            ) ||
            (e.target as HTMLElement).closest('[role="dialog"]') !==
              e.currentTarget
          )
            return;
          e.preventDefault();
          e.stopPropagation();
          if (saving || readingImage || !draft.title.trim()) return;
          void (async () => {
            if (isNew) {
              if (await persist()) beginClose();
            } else await close();
          })();
        }}
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
            <TaskPersonAvatar todo={draft} />
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
              data-shortcut="Enter → Termin erstellen / speichern · Shift Enter → neue Zeile"
              aria-label="Aufgabentitel"
              data-imported={imported("title")}
              value={draft.title}
              maxLength={500}
              onChange={(e) => update({ title: e.target.value })}
              onBlur={() => applyTitle()}
              onKeyDown={(e) => {
                if (
                  e.key !== "Enter" ||
                  e.shiftKey ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.altKey ||
                  e.nativeEvent.isComposing
                )
                  return;
                e.preventDefault();
                e.stopPropagation();
                if (
                  e.repeat ||
                  saving ||
                  readingImage ||
                  !extractTitle().title.trim()
                )
                  return;
                void (async () => {
                  if (await persist()) {
                    beginClose();
                  }
                })();
              }}
              disabled={readingImage}
              onPaste={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (readingImage || imageRequest.current) return;
                const input = e.currentTarget;
                const before = draft.title.slice(0, input.selectionStart);
                const after = draft.title.slice(input.selectionEnd);
                const text = e.clipboardData.getData("text/plain");
                const controller = new AbortController();
                imageRequest.current = controller;
                try {
                  const image = await pastedImage(e.clipboardData);
                  if (controller.signal.aborted) return;
                  if (!image) {
                    if (/^[©®™\uFFFC\s]+$/.test(text))
                      throw new Error(
                        "Das Bild wurde von der Zwischenablage nicht übergeben. Bitte den Screenshot erneut in die Zwischenablage kopieren und einfügen.",
                      );
                    if (text) applyTitle(before + text + after);
                    return;
                  }
                  setReadingImage(true);
                  const prepared = await prepareScreenshot(image);
                  const response = await fetch("/api/ocr", {
                    method: "POST",
                    body: prepared,
                    signal: controller.signal,
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error);
                  applyScreenshot(result.text, before, after);
                } catch (error) {
                  if (!controller.signal.aborted) onError(error);
                } finally {
                  imageRequest.current = null;
                  if (!controller.signal.aborted) setReadingImage(false);
                }
              }}
            />
          </div>
          {readingImage && (
            <p role="status" className="assessment-label">
              Screenshot wird gelesen …
            </p>
          )}
          <textarea
            className="description-input"
            aria-label="Beschreibung"
            data-imported={imported("description")}
            placeholder="Worum geht es? Ergänze eine Beschreibung …"
            value={draft.description}
            onChange={(e) => {
              const location =
                addressFromText(e.target.value) || addressFromText(draft.title);
              const changed = location !== (draft.location || "");
              if (changed) setTravelOptions([]);
              update({
                description: e.target.value,
                location,
                ...(changed
                  ? { travelBefore: 0, travelAfter: 0, travelMode: "" as const }
                  : {}),
              });
            }}
          />
          {destination && (
            <a
              className="address-link"
              data-imported={imported("location")}
              href={mapsAddress(destination)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {destination} ↗
            </a>
          )}
          {phonesFromText(draft.description).map((number) => (
            <a
              key={number}
              className="contact-detail-link"
              data-imported={imported("description")}
              href={phoneLink(number)}
            >
              {number} ↗
            </a>
          ))}
          {screenshot && (
            <ScreenshotImportReview
              plan={screenshot}
              draft={draft}
              onChange={changeScreenshot}
            />
          )}
          <div className="detail-fields">
            <div
              className="schedule-summary"
              data-imported={
                imported("plannedDate") ||
                imported("time") ||
                imported("duration")
              }
            >
              {draft.plannedDate
                ? `${parseDate(draft.plannedDate).toLocaleDateString("de-DE")}${draft.time ? ` · ${draft.time} · ${draft.duration || 60} Min.` : " · Ohne Zeit"}`
                : "Inbox"}
            </div>
            {((isNew && showSchedule) || screenshot) && (
              <ScheduleFields
                date={draft.plannedDate || ""}
                time={draft.time}
                duration={draft.duration || 60}
                imported={{
                  date: imported("plannedDate"),
                  time: imported("time"),
                  duration: imported("duration"),
                }}
                onChange={(patch) =>
                  update({
                    ...patch,
                    ...(patch.plannedDate !== undefined
                      ? { plannedDate: patch.plannedDate || null }
                      : {}),
                    ...(patch.time !== undefined
                      ? {
                          plannedDate: draft.plannedDate || dateKey(new Date()),
                          duration: draft.duration || 60,
                        }
                      : {}),
                  })
                }
              />
            )}
            {editSchedule && !isNew && (
              <ScheduleFields
                showDate={false}
                time={draft.time}
                duration={draft.duration || 60}
                groupLabel={
                  groupCount > 1 ? `Uhrzeit für ${groupCount} Tage` : "Uhrzeit"
                }
                labels={[
                  "Termindatum",
                  "Gemeinsame Uhrzeit",
                  "Dauer in Stunden",
                ]}
                onChange={(patch) =>
                  update({
                    ...patch,
                    duration: patch.duration || draft.duration || 60,
                  })
                }
              />
            )}
            <details className="travel-settings">
              <summary>
                Wegzeit berechnen
                {draft.travelBefore || draft.travelAfter
                  ? ` · ${(draft.travelBefore || 0) + (draft.travelAfter || 0)} Min.`
                  : ""}
              </summary>
              <div className="travel-form">
                <label>
                  Startadresse
                  <input
                    aria-label="Startadresse für Wegzeit"
                    value={travelOrigin}
                    onChange={(e) => {
                      setTravelOrigin(e.target.value);
                      setTravelOptions([]);
                    }}
                    placeholder="Straße, Hausnummer, Stadt"
                  />
                </label>
                <label>
                  Zieladresse
                  <input
                    aria-label="Zieladresse für Wegzeit"
                    value={destination}
                    onChange={(e) => update({ location: e.target.value })}
                    readOnly={Boolean(
                      addressFromText(draft.title + "\n" + draft.description),
                    )}
                    placeholder="Adresse in den Notizen ergänzen"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    !destination ||
                    !travelOrigin.trim() ||
                    travelBusy ||
                    !draft.time
                  }
                  onClick={() => void calculateTravel()}
                >
                  {travelBusy
                    ? "Route wird berechnet …"
                    : "Hin- und Rückweg berechnen"}
                </button>
                <div className="travel-choices">
                  {(travelOptions.length
                    ? travelOptions
                    : [{ mode: "transit" as const }, { mode: "bike" as const }]
                  ).map((option) => (
                    <div
                      key={option.mode}
                      className={`travel-choice ${draft.travelMode === option.mode ? "selected" : ""}`}
                    >
                      <button
                        type="button"
                        aria-pressed={draft.travelMode === option.mode}
                        disabled={travelBusy || !travelOptions.length}
                        onClick={() =>
                          update({
                            ...extractTitle(),
                            location: destination,
                            travelMode: option.mode,
                            travelBefore: option.before || 0,
                            travelAfter: option.after || 0,
                          })
                        }
                      >
                        <strong>
                          {option.mode === "bike" ? "Fahrrad" : "Bahn + Fußweg"}
                        </strong>
                        {option.before !== undefined ? (
                          <span>
                            {option.before} Min. hin · {option.after} Min.
                            zurück
                          </span>
                        ) : (
                          <span>
                            {option.error || "Nach Berechnung auswählen"}
                          </span>
                        )}
                      </button>
                      {destination && travelOrigin && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(travelOrigin)}&destination=${encodeURIComponent(destination)}&travelmode=${option.mode === "bike" ? "bicycling" : "transit"}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Verbindung in Google Maps ↗
                        </a>
                      )}
                      {option.label && <small>{option.label}</small>}
                    </div>
                  ))}
                </div>
                <small>
                  Fahrrad: OpenStreetMap · Bahn und Fußwege: Fahrplanauskunft
                </small>
                {routeLabel && <small>{routeLabel}</small>}
                {draft.travelMode || draft.travelBefore || draft.travelAfter ? (
                  <div className="travel-minutes">
                    <label>
                      Hinweg
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        aria-label="Hinweg in Minuten"
                        value={draft.travelBefore || 0}
                        onChange={(e) =>
                          update({
                            travelBefore: Math.max(
                              0,
                              Math.min(1440, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />{" "}
                      Min.
                    </label>
                    <label>
                      Rückweg
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        aria-label="Rückweg in Minuten"
                        value={draft.travelAfter || 0}
                        onChange={(e) =>
                          update({
                            travelAfter: Math.max(
                              0,
                              Math.min(1440, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />{" "}
                      Min.
                    </label>
                    <span>
                      Gesamt:{" "}
                      {(draft.duration || 60) +
                        (draft.travelBefore || 0) +
                        (draft.travelAfter || 0)}{" "}
                      Min.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          travelBefore: 0,
                          travelAfter: 0,
                          travelMode: "",
                        })
                      }
                    >
                      Wegzeit entfernen
                    </button>
                  </div>
                ) : null}
              </div>
            </details>
            <button
              type="button"
              className="reminder-toggle"
              aria-pressed={Boolean(draft.reminder)}
              onClick={() => update({ reminder: !draft.reminder })}
            >
              {draft.reminder ? "●" : "○"} Erinnerung · 1 Tag vorher
            </button>
            {!screenshot && (
              <details className="repeat-details">
                <summary>Wiederholen</summary>
                <fieldset className="repeat-picker">
                  <label>
                    Uhrzeit{" "}
                    <TimeInput
                      label="Uhrzeit der Wiederholungen"
                      value={draft.time}
                      onChange={(time) =>
                        update({ time, duration: draft.duration || 60 })
                      }
                    />
                  </label>
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
                        if (!isNew && dirty && !(await persist())) return;
                        await onRepeat(repeatDays, repeatWeeks, draft);
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
            <div className="detail-color-row">
              <ColorPicker
                value={draft.color}
                onChange={(color) => update({ color })}
              />
            </div>
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
            <label className="detail-tags">
              <span>
                <Layers2 size={15} /> Tags
              </span>
              <input
                aria-label="Tags, mit Komma getrennt"
                placeholder="Studium, Privat …"
                value={draft.tags
                  .filter((x) => !/^(k|r|h):/.test(x))
                  .join(", ")}
                onChange={(e) =>
                  update({
                    tags: [
                      ...draft.tags.filter((x) => /^(k|r|h):/.test(x)),
                      ...e.target.value.split(",").map((t) => t.trimStart()),
                    ],
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
          <p className="created-at">
            Erstellt am {new Date(todo.createdAt).toLocaleDateString("de-DE")}
          </p>
          <div
            className="assistant-section"
            data-escape-layer={chat ? "" : undefined}
          >
            {chat && (
              <button
                hidden
                data-close
                type="button"
                onClick={() => setChat(false)}
              >
                Schließen
              </button>
            )}
            <button
              className="assistant-heading"
              disabled={Boolean(screenshot)}
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
            disabled={
              saving || readingImage || travelBusy || !draft.title.trim()
            }
            onClick={async () => {
              if (await persist()) {
                if (isNew) beginClose();
              }
            }}
          >
            {saving ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}
            {screenshot
              ? "Screenshot übernehmen"
              : isNew
                ? "Aufgabe hinzufügen"
                : "Speichern"}
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
  shortcutHints,
  onClose,
  onRefresh,
  onError,
  accent,
  onAccent,
}: {
  state: AppState;
  shortcutHints: ReturnType<typeof useShortcutPreferences>;
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
        <ShortcutSettings
          preference={shortcutHints.preference}
          enabled={shortcutHints.enabled}
          onChange={shortcutHints.configure}
        />
        <div className="settings-section">
          <ReminderSetup />
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
