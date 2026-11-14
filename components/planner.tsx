"use client";
import { TaskPersonAvatar } from "./person-avatar";
import { changedTaskFields, applySeriesEdit } from "@/lib/series-edit";
import { priorityOrder } from "@/lib/priority-order";
import { goBackView, goForwardView, useViewHistory } from "@/lib/view-history";
import Statistics from "./statistics";
import PeriodReview from "./period-review";
import { useAreaSelection } from "./use-area-selection";
import {
  installHistory,
  record,
  travel,
  historySize,
} from "@/lib/client-history";
import ReminderSetup from "./reminder-setup";
import LifeInbox from "./life-inbox";
import { listenForViewSwipe } from "@/lib/lifemap-swipe";
import CalendarTabs from "./calendar-tabs";
import ZoneEditor from "./zone-editor";
import { RepeatPicker, RepeatDays, RepeatWeeks } from "./repeat-picker";
import type { CalendarZone } from "@/lib/calendar-zones";
import { parseQuadrant } from "@/lib/eisenhower";
import { quadrantOf, withQuadrant } from "@/lib/eisenhower";
import { hasMatchingCalendarTitle, nativeCalendarDefaults, nativeGroupColor, type NativeCalendarConfig } from "@/lib/calendar/overrides";
import { taskImportant, type TaskPeriod } from "./period-task-grid";
import NotebookNavigation, { notebookTitle } from "./notebook-navigation";
import { notebookFolder } from "@/lib/notebook";
import { autoSchedule, scheduleUntimedOnSave } from "@/lib/auto-schedule";
import { goalRange } from "@/lib/goals";
import ResourceDrawer from "./resource-drawer";
import InboxNotes from "./inbox-notes";
import NoteTodoBoard from "./note-todo-board";
import NoteSettings from "./note-settings";
import { defaultNotePreferences, noteFonts, notePeriods, notePeriod, waitingNoteTodo, putInNoteTodo, type NotePeriod, type NotePreferences } from "@/lib/note-todos";
import PlannerNotepad, { noteWithTasks, readNoteLines } from "./planner-notepad";
import { CalendarEventEditor, CalendarOptions } from "./calendar-editor";
import { useAutosaveText } from "./use-autosave-text";
import TaskImportanceButtons from "./task-importance-buttons";
import { taskDay, plannerPeriodTags, parkTask, restoreParkedTask, isFlexibleTask } from "@/lib/planner-day";
import ColorPicker from "./task-color-picker";
import TaskDescription from "./task-description";
import TaskPicture from "./task-picture";
import AddressInput from "./address-input";
import { mapsDirections } from "@/lib/maps-directions";
import { placeQueries, type PlaceProposal } from "@/lib/place-search";
import { useActionHints } from "./use-action-hints";
import {
  useShortcutPreferences,
  ShortcutWelcome,
  ShortcutSettings,
} from "./shortcut-hints";
import { taskColorForKey, type TaskColor } from "@/lib/task-colors";
import ScheduleFields from "./schedule-fields";
import TimeInput from "./time-input";
import TodoistSettings from "./todoist-settings";
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
import { parseAppointmentInput, parseRecurringAppointmentInput } from "@/lib/appointment-input";
import { repeatDates } from "@/lib/repeat";
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
  CalendarClock,
  Check,
  ChevronDown,
  Flag,
  Circle,
  Bell,
  Clock3,
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
  FileText,
  ExternalLink,
  RefreshCw,
  Download,
  Upload,
  CheckCheck,
} from "lucide-react";
import Timeline, { dragStartMinute, type TimeChange } from "./timeline";
import { gridMinute, scheduleAt, toMinutes } from "@/lib/schedule";
import CategoryIcon from "./category-icon";
import { useDialog } from "./use-dialog";
import { isTitleKey, typeTitle } from "./type-title";
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
  onImportance,
}: {
  todo: Todo;
  onOpen: (id: string) => void;
  onToggle: (todo: Todo) => void;
  overlay?: boolean;
  onImportance?: (todo:Todo,important:boolean)=>void;
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
      {onImportance && <TaskImportanceButtons onChange={(important)=>onImportance(todo,important)} />}
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
  onImportance,
}: {
  id: string;
  todos: Todo[];
  onOpen: (id: string) => void;
  onToggle: (todo: Todo) => void;
  children?: React.ReactNode;
  onImportance?: (todo:Todo,important:boolean)=>void;
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
            onImportance={onImportance}
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
  useEffect(() => {
    const embedded = window.parent !== window && new URLSearchParams(location.search).has("boardNotes");
    if (embedded) document.documentElement.classList.add("lifemap-notes-frame");
    let start: number | null = null;
    const touchStart = (event: TouchEvent) => { start = event.touches.length >= 2 ? event.touches[0].clientY : null; };
    const touchEnd = (event: TouchEvent) => {
      if (start !== null && event.changedTouches[0]?.clientY > start + 80) location.assign("/lifemap/board");
      start = null;
    };
    if (!embedded) {
      window.addEventListener("touchstart", touchStart, {passive:true});
      window.addEventListener("touchend", touchEnd, {passive:true});
    }
    const stopWheel = embedded ? undefined : listenForViewSwipe(-1, () => location.assign("/lifemap/board"),
      () => !document.querySelector('[role="dialog"],.notes-open') &&
        (document.querySelector(".timeline-scroll")?.scrollTop ?? 0) <= 0);
    return () => {
      stopWheel?.();
      document.documentElement.classList.remove("lifemap-notes-frame");
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchend", touchEnd);
    };
  }, []);
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
  const [selectionMenu, setSelectionMenu] = useState<{ x:number; y:number } | null>(null);
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
  const [zones,setZones]=useState<CalendarZone[]>([]);
  const [zoneMode,setZoneMode]=useState(false);
  const [zoneEdit,setZoneEdit]=useState<CalendarZone|null>(null);
  useEffect(()=>{
    const refresh=()=>void api("/api/zones").then(setZones).catch(()=>setToast({text:"Kalenderzonen konnten nicht geladen werden."}));
    refresh();
    window.addEventListener("raum-data-changed",refresh);
    return ()=>window.removeEventListener("raum-data-changed",refresh);
  },[]);
  const [calendarEventEdit,setCalendarEventEdit]=useState<CalendarEvent|null>(null);
  const [calendarDeleteOnly,setCalendarDeleteOnly]=useState(false);
  const [hiddenCalendars,setHiddenCalendars]=useState<string[]>([]);
  useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem("lifemap-hidden-calendars")||"[]");if(Array.isArray(stored))setHiddenCalendars(stored.filter((id)=>typeof id==="string"));}catch{}},[]);
  function toggleCalendar(id:string){
    let before=hiddenCalendars;
    try{
      const stored=JSON.parse(localStorage.getItem("lifemap-hidden-calendars") || "[]");
      if(Array.isArray(stored))before=stored.filter((key)=>typeof key==="string");
    }catch{}
    const after=before.includes(id)?before.filter((key)=>key!==id):[...before,id];
    const apply=async(next:string[])=>{localStorage.setItem("lifemap-hidden-calendars",JSON.stringify(next));setHiddenCalendars(next);};
    void apply(after);
    record({undo:()=>apply(before),redo:()=>apply(after)});
  }
  const [overview, setOverview] = useState<"day" | "month" | "week" | "year" | null>(
    null,
  );
  const [planning, setPlanning] = useState(false),
    [planningInput, setPlanningInput] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [tagFilter, setTagFilter] = useState(""),
    [showDone, setShowDone] = useState(true);
  const [settings, setSettings] = useState(false),
    [newOpen, setNewOpen] = useState(false),
    [dark, setDark] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const plannerNotePeriod:TaskPeriod=overview==="day"?"day":overview==="month" || overview==="year"?"month":"week";
  const calendarNoteKeys = [anchor, `week:${periodRange(`week:${anchor}`)!.start}`, `month:${periodRange(`month:${anchor}`)!.start}`];
  const calendarNoteKey = calendarNoteKeys[plannerNotePeriod==="day"?0:plannerNotePeriod==="week"?1:2];
  const [noteTabs,setNoteTabs]=useState<string[]>([]);
  const [activeNote,setActiveNote]=useState<string|null>(null);
  const [freshNote,setFreshNote]=useState<string|null>(null);
  const [notebookOpen,setNotebookOpen]=useState(false);
  const [noteTodosCollapsed,setNoteTodosCollapsed]=useState(false);
  useEffect(()=>setNoteTodosCollapsed(localStorage.getItem("lifemap-note-todos-collapsed")==="true"),[]);
  const toggleNoteTodos=()=>{
    const before=noteTodosCollapsed;
    const apply=async(value:boolean)=>{
      localStorage.setItem("lifemap-note-todos-collapsed",String(value));
      setNoteTodosCollapsed(value);
    };
    void apply(!before);
    record({undo:()=>apply(before),redo:()=>apply(!before)});
  };
  const availableTabs=noteTabs.filter((key)=>!notebookFolder(key) || !!state.dayNotes[key]);
  const plannerNoteKey=activeNote && availableTabs.includes(activeNote)?activeNote:calendarNoteKey;
  const visibleNoteTabs=[...new Set([calendarNoteKey,...availableTabs])];
  const openNote=(key:string)=>{
    setNoteTabs((current)=>current.includes(key)?current:[...current,key]);
    setActiveNote(key);
    setFreshNote(null);
  };
  const closeNote=(key:string)=>{
    if(key===plannerNoteKey)setActiveNote(null);
    setNoteTabs((current)=>current.filter((item)=>item!==key));
  };
  const [storagePinned, setStoragePinned] = useState(false);
  const closeStorage = () => {
    setStoragePinned(false);
    setStorageOpen(false);
  };
  const toggleStorage = () => {
    if (storageOpen && storagePinned) closeStorage();
    else {
      setStoragePinned(true);
      setStorageOpen(true);
    }
  };
  const areaSelection = useAreaSelection(selectionMode, selectedIds, (ids, keepMode) => {
    setSelectedIds(ids);
    setPicked(ids[0] || null);
    if(!keepMode)setSelectionMode(false);
  });
  const [editGroup, setEditGroup] = useState<string[]>([]);
  const [accent, setAccent] = useState("green");
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
      storageOpen,
      storagePinned,
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
      setStorageOpen(view.storageOpen);
      setStoragePinned(view.storagePinned);
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
        "storageOpen",
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
      if (zoneMode) {
        setZoneMode(false);
        event.preventDefault();
      } else if (selectionMode || selectedIds.length || picked) {
        setSelectionMode(false);
        setSelectedIds([]);
        setPicked(null);
        event.preventDefault();
      } else if (query) {
        setQuery("");
        event.preventDefault();
      } else if (storageOpen) {
        closeStorage();
        event.preventDefault();
      } else if (goBackView()) event.preventDefault();
    };
    window.addEventListener("raum-view-back", back);
    return () => window.removeEventListener("raum-view-back", back);
  }, [
    backView,
    zoneMode,
    selectionMode,
    selectedIds,
    picked,
    query,
    storageOpen,
    storagePinned,
  ]);
  const navigationAnchor = useRef(anchor);
  navigationAnchor.current = anchor;
  const [newSlot, setNewSlot] = useState<{
    day: string;
    time: string;
    duration?: number;
    days?: string[];
    drawn?: boolean;
    category?: { id: string; color: TaskColor; suggestions: string[] };
  } | null>(null);
  const [dragged, setDragged] = useState<Todo | null>(null),
    [toast, setToast] = useState<{
      text: string;
      undo?: () => Promise<void>;
      detail?: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  useDialog(
    Boolean(selected || settings || newOpen || planning || dayPanel || zoneEdit),
    selected ||
      dayPanel ||
      (zoneEdit ? `zone:${zoneEdit.id}` : planning ? "planning" : newOpen ? "new" : settings ? "settings" : ""),
  );
  const [notesPosition, setNotesPosition] = useState<"below" | "open" | "closing">("below");
  useEffect(() => {
    if (!document.documentElement.classList.contains("lifemap-notes-frame")) return;
    setNotesPosition("open");
    const panel = document.querySelector<HTMLElement>(".calendar-bottom-notes");
    if (!panel) return;
    const report = () => window.parent.postMessage({
      type: "lifemap-notepad-height", height: panel.scrollHeight,
    }, location.origin);
    const observer = new ResizeObserver(report);
    observer.observe(panel);
    report();
    return () => observer.disconnect();
  }, []);
  const visibleNotesPosition = newOpen && notesPosition==="open" ? "closing" : notesPosition;
  const [notePreferences,setNotePreferences]=useState(defaultNotePreferences);
  const [noteSettingsOpen,setNoteSettingsOpen]=useState(false);
  const [noteToday,setNoteToday]=useState(()=>dateKey(new Date()));
  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem("lifemap-note-preferences") || "null") as NotePreferences|null;
      if(saved){
        const columns=notePeriods.filter((period)=>saved.columns?.includes(period));
        setNotePreferences({
          height:Number.isInteger(saved.height) && saved.height>=8 && saved.height<=19?saved.height:14,
          font:Object.hasOwn(noteFonts,saved.font)?saved.font:"system",
          size:[12,14,16,18,20,24].includes(saved.size)?saved.size:14,
          columns:columns.length?columns:[...notePeriods],
        });
      }
    }catch{}
    const tick=()=>setNoteToday(dateKey(new Date()));
    const timer=window.setInterval(tick,30000);
    window.addEventListener("focus",tick);
    return ()=>{window.clearInterval(timer);window.removeEventListener("focus",tick);};
  },[]);
  const saveNotePreferences=(next:NotePreferences)=>{
    const before=notePreferences;
    const apply=async(value:NotePreferences)=>{
      localStorage.setItem("lifemap-note-preferences",JSON.stringify(value));
      setNotePreferences(value);
    };
    void apply(next);
    if(JSON.stringify(before)!==JSON.stringify(next))record({undo:()=>apply(before),redo:()=>apply(next)});
    setNoteSettingsOpen(false);
  };
  const workspaceRef=useRef<HTMLDivElement>(null);
  const notesPanelRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const panel=notesPanelRef.current;
    const main=panel?.closest("main");
    if(!panel || !main || visibleNotesPosition!=="below")return;
    const calendar=main.querySelector<HTMLElement>(".timeline-scroll,.calendar-overview-large");
    const editor=panel.querySelector<HTMLElement>(".inbox-notes");
    if(!calendar || !editor)return;
    const fit=()=>{
      const viewportTop=main.getBoundingClientRect().top+main.clientTop;
      const overhead=editor.getBoundingClientRect().top-viewportTop+main.scrollTop-calendar.getBoundingClientRect().height;
      main.style.setProperty("--calendar-before-notes",`${Math.max(180,Math.ceil(main.clientHeight-overhead))}px`);
    };
    fit();
    const observer=new ResizeObserver(fit);
    observer.observe(main);
    for(const item of [main.querySelector(".planner-toolbar"),panel.querySelector(".notebook-tabs"),panel.querySelector(".notebook-todo-heading")]){
      if(item)observer.observe(item);
    }
    return ()=>observer.disconnect();
  },[overview,visibleNotesPosition]);
  useEffect(()=>{
    const workspace=workspaceRef.current, panel=notesPanelRef.current;
    if(!workspace || !panel || visibleNotesPosition==="below")return;
    if(visibleNotesPosition==="open" && !document.documentElement.classList.contains("lifemap-notes-frame") && !panel.contains(document.activeElement))panel.focus({preventScroll:true});
    const setLimit=()=>{
      const timeline=workspace.querySelector<HTMLElement>(".timeline-scroll");
      const hour=String(notePreferences.height).padStart(2,"0")+":00";
      const slot=[...workspace.querySelectorAll<HTMLElement>(`.time-slot[aria-label*="um ${hour}"]`)].find((item)=>item.offsetWidth);
      const top=timeline?.getBoundingClientRect().top ?? 0;
      const line=slot?.getBoundingClientRect().top;
      const edge=line!==undefined && line>=top+65 ? line : Math.max(top+100,window.innerHeight*.42);
      workspace.style.setProperty("--note-overlay-max",`${Math.max(140,Math.min(window.innerHeight*.72,window.innerHeight-edge))}px`);
    };
    const measure=()=>workspace.style.setProperty("--calendar-note-clearance",`${panel.offsetHeight+12}px`);
    setLimit();measure();
    const observer=new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener("resize",setLimit);
    return ()=>{observer.disconnect();window.removeEventListener("resize",setLimit);
      workspace.style.removeProperty("--calendar-note-clearance");workspace.style.removeProperty("--note-overlay-max");};
  },[visibleNotesPosition,notePreferences.height]);
  const noteStore = useRef<((tasks:Todo[])=>Promise<void>)|null>(null);
  const noteLegacyDelete = useRef<((ids:string[])=>Promise<{before:string;after:string}>)|null>(null);
  const [calendarSettingsId,setCalendarSettingsId]=useState<string|null>(null);
  const [nativeCalendar,setNativeCalendar]=useState<NativeCalendarConfig>(nativeCalendarDefaults);
  const refreshNative=useCallback(async()=>setNativeCalendar(await api("/api/calendar-edit?id=lifemap")),[]);
  useEffect(()=>{
    const refresh=()=>void refreshNative().catch(()=>{});
    refresh();window.addEventListener("raum-data-changed",refresh);
    return ()=>window.removeEventListener("raum-data-changed",refresh);
  },[refreshNative]);
  const calendarSettings=calendarSettingsId==="lifemap"?nativeCalendar:state.connections.find((item)=>item.id===calendarSettingsId);
  useDialog(!!calendarSettings,calendarSettingsId || "");
  const toggleNotes = () => {
    setPasteTarget(null);
    setNotesPosition((position)=>position==="open"?"closing":"open");
  };
  const toggleZones = () => {
    if (!zoneMode && (overview==="month" || overview==="year")) {
      setOverview(null);
      setDatePreview(null);
    }
    setSelectionMode(false);
    setZoneMode((current)=>!current);
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const taskWriteVersion = useRef(0);
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
    // Refresh imported data while keeping editors and in-flight local mutations intact.
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const version = taskWriteVersion.current;
        const data = await api("/api/state");
        if (active)
          setState((prev) => ({
            ...prev,
            events: data.events,
            connections: data.connections,
            ...(!busy &&
            !selected &&
            !newOpen &&
            !lock.current &&
            version === taskWriteVersion.current
              ? { todos: data.todos }
              : {}),
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
  }, [busy, selected, newOpen]);
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
        !input && !(e.target as HTMLElement).closest("[data-type-title]") &&
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
        (calendarEventEdit || selectedIds.length > 1 || selectedIds.some((id)=>id.startsWith("note-checkbox:")) || state.events.some((event) => selectedIds.includes(event.id))) &&
        ["Delete", "Backspace"].includes(e.key)
      ) {
        e.preventDefault();
        if (!calendarDeleteOnly) void deleteGroup(calendarEventEdit ? [calendarEventEdit.id] : selectedIds).catch(handleError);
        return;
      }
      if (neutral && e.key.toLowerCase()==="z" && !e.repeat) {
        e.preventDefault();
        toggleZones();
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
        picked &&
        taskColorForKey(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const color = taskColorForKey(e.key)!;
        const targets = selectedIds.length
          ? state.todos.filter((t) => selectedIds.includes(t.id))
          : state.todos.filter((t) => t.id === picked);
        if (targets.length)
          void batchUpdate(targets.map((t) => ({ ...t, color }))).catch(
            handleError,
          );
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
    const notesKey=(event:KeyboardEvent)=>{
      if((event.code!=="Space" && event.key!==" ") || event.ctrlKey || event.altKey || event.metaKey ||
        dragged || !(event.target instanceof HTMLElement) ||
        event.target.closest("input,textarea,select,[contenteditable]") ||
        document.querySelector('[role="dialog"],[role="menu"]'))return;
      event.preventDefault();event.stopImmediatePropagation();
      if (document.documentElement.classList.contains("lifemap-notes-frame")) {
        if (!event.repeat) window.parent.postMessage("lifemap-close-notes", location.origin);
        return;
      }
      if(!event.repeat)toggleNotes();
    };
    window.addEventListener("keydown", notesKey,true);
    window.addEventListener("keydown", key);
    document.addEventListener("copy", copy);
    document.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("keydown",notesKey,true);
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
    state.events,
    calendarEventEdit,
    calendarDeleteOnly,
    zoneMode,
    overview,
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
    const inbox = (e: Event) => { e.preventDefault(); toggleNotes(); };
    const select = (e: Event) => {
      e.preventDefault();
      setZoneMode(false);
      setSelectionMode((v) => !v);
    };
    const removeSelection = (e: Event) => {
      if (calendarEventEdit || selectedIds.length) {
        e.preventDefault();
        if (calendarEventEdit) {
          if (!calendarDeleteOnly) void deleteGroup([calendarEventEdit.id]).catch(handleError);
        } else if (selectedIds.length === 1 && !selectedIds[0].startsWith("note-checkbox:") && !state.events.some((event)=>event.id===selectedIds[0])) {
          const task = state.todos.find((t) => t.id === selectedIds[0]);
          if (task) void remove(task).catch(handleError);
        } else if (!calendarDeleteOnly) void deleteGroup().catch(handleError);
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
  }, [selectedIds, state.todos, state.events, calendarEventEdit, calendarDeleteOnly]);
  const [seriesQuestion, setSeriesQuestion] = useState<{
    title: string;
    resolve: (all: boolean | null) => void;
  } | null>(null);
  const calendarClick = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calendarNameClicks = useRef(new Map<string,ReturnType<typeof setTimeout>>());
  useEffect(()=>{
    const clicks=calendarNameClicks.current;
    return ()=>{clicks.forEach(clearTimeout);clicks.clear();};
  },[]);
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
    taskWriteVersion.current++;
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
  const planOnSave = (tasks:Todo[]) => scheduleUntimedOnSave(tasks,state.todos,state.events,new Date(),zones);
  const add = async (
    title: string,
    day: string | null,
    time = "",
    duration: number | null = null,
    color: Todo["color"] = "green",
    notes = "",
  ) => {
    try {
      const parsed = parseAppointmentInput(title);
      const plannedDate =
        parsed.plannedDate || day || (parsed.time ? dateKey(new Date()) : null);
      const scheduledTime = parsed.time || time;
      const task:Todo={
        ...newTodo(
          parsed.title || title,
          plannedDate,
          Math.max(
            0,
            ...state.todos
              .filter((t) => t.plannedDate === day)
              .map((t) => t.position),
          ) + 1,
        ),
        time: plannedDate ? scheduledTime : "",
        duration: parsed.duration ?? duration ?? (scheduledTime ? 60 : null),
        location: parsed.location || "",
        description: parsed.description,
        ...(day && plannedDate ? {tags:plannerPeriodTags([],"day",plannedDate)} : {}),
        color,
        notes,
      };
      await save(day ? planOnSave([task])[0] : task);
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
    setSelected(id);
    setPicked(id);
    setSelectedIds([id]);
  };
  const openNoteTask = (id:string) => {
    if(calendarClick.current)clearTimeout(calendarClick.current);
    calendarClick.current=setTimeout(()=>openCalendarTask(id),300);
  };
  const batchUpdate = async (todos: Todo[], ids: string[] = [], askSeries = true) => {
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
      }, askSeries);
    } catch (e) {
      handleError(e);
      throw e;
    }
  };
  const storeInNote = async (tasks:Todo[], date:string, write?:()=>Promise<void>) => {
    if (write) await write();
    else {
      const content=noteWithTasks(state.dayNotes[date] || "",tasks,!!notebookFolder(date));
      await api("/api/notes",{date,content});
      setState((current)=>({...current,dayNotes:{...current.dayNotes,[date]:content}}));
    }
    await batchUpdate(tasks.map((todo)=>parkTask(todo,date)),[],false);
    setToast({text:"In Notizen abgelegt"});
  };
  const returnNoteTask = async (id:string) => {
    const task=state.todos.find((item)=>item.id===id && item.tags.includes("stored"));
    if(!task)return;
    const restored=restoreParkedTask(task,dateKey(new Date()));
    await batchUpdate([restored],[],false);
    if(restored.plannedDate){setAnchor(restored.plannedDate);setMobileDay(restored.plannedDate);}
    setToast({text:"Zurück im Kalender"});
  };
  const deleteGroup = async (ids = selectedIds) => {
    const events = state.events.filter((event) => ids.includes(event.id));
    const taskIds = state.todos.filter((todo) => ids.includes(todo.id)).map((todo) => todo.id);
    if (events.length===1 && !taskIds.length && (events[0].seriesId || hasMatchingCalendarTitle(state.events, events[0]))) {
      setCalendarDeleteOnly(true);
      setCalendarEventEdit(events[0]);
      return;
    }
    if (taskIds.length) await batchUpdate([], taskIds);
    const legacyIds=ids.filter((id)=>id.startsWith(`note-checkbox:${plannerNoteKey}:`));
    if(legacyIds.length && noteLegacyDelete.current){
      await noteLegacyDelete.current(legacyIds);
    }
    for (const event of events) await api("/api/calendar-edit", {action:"event",id:event.connectionId,eventId:event.id,scope:"event",hidden:true});
    if (events.length) {
      setCalendarEventEdit(null);
      await load();
    }
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
    if(active.data.current?.kind==="calendar-zone"){
      const {zone,day,night}=active.data.current as {zone:CalendarZone;day:string;night:boolean};
      const target=over.data.current?.day as string|undefined;
      if(!target)return;
      const grid=document.querySelector<HTMLElement>(`[data-day-grid="${target}"]`);
      const scale=Number(grid?.dataset.minuteHeight)||0.55;
      const shift=Math.round((Date.parse(`${target}T00:00Z`)-Date.parse(`${day}T00:00Z`))/86400000);
      const length=zone.end-zone.start;
      const start=Math.max(0,Math.min(1440-length,zone.start+Math.round(delta.y/scale*(night?6:1)/15)*15));
      const advance=(date:string)=>dateKey(addDays(parseDate(date),shift));
      const {zones:next}=await api("/api/zones",{action:"save",zone:{
        ...zone,start,end:start+length,days:zone.days.map(advance),until:zone.until?advance(zone.until):"",
      }});
      setZones(next);
      return;
    }
    const legacy=active.data.current?.legacyTodo as {id:string;noteDate:string;index:number;title:string;done:boolean}|undefined;
    if(legacy){
      const target=over.data.current;
      if(target?.kind==="legacy-note-row" && target.noteDate===legacy.noteDate){
        target.onMove(legacy.index);
        return;
      }
      const removeLegacy=noteLegacyDelete.current;
      if(!removeLegacy || !legacy.title.trim())return;
      let task={...newTodo(legacy.title.trim(),null,state.todos.length+1),done:legacy.done};
      let reordered:Todo[]=[];
      if(target?.kind==="note-todo"){
        const period=target.period as NotePeriod,important=!!target.important;
        const bucket=state.todos.filter((todo)=>waitingNoteTodo(todo,noteToday) && notePeriod(todo)===period && (todo.priority==="high")===important).sort((a,b)=>a.position-b.position);
        const before=bucket.findIndex((todo)=>todo.id===target.before);
        const position=before<0?bucket.length:before;
        task=putInNoteTodo(task,period,important,position);
        reordered=bucket.flatMap((todo,index)=>index>=position?[{...todo,position:index+1}]:[]);
      } else if(target?.kind==="timegrid" || target?.kind==="periodday"){
        const day=target.day as string;
        const period=legacy.noteDate.startsWith("week:")?"week":legacy.noteDate.startsWith("month:")?"month":"day";
        task={...putInNoteTodo(task,period,false,task.position),plannedDate:day};
        const grid=target.kind==="timegrid"?document.querySelector<HTMLElement>(`[data-day-grid="${day}"]`):null;
        if(grid)task={...task,...scheduleAt(dragStartMinute(active,activatorEvent,delta,grid.getBoundingClientRect().top,Number(grid.dataset.minuteHeight)||0.55),task.duration || 60)};
      } else return;
      await batchUpdate([task],[],false);
      try{await removeLegacy([legacy.id]);}catch(error){await batchUpdate([], [task.id], false);throw error;}
      if(reordered.length)await batchUpdate(reordered,[],false);
      setSelectedIds((current)=>current.filter((id)=>id!==legacy.id));
      return;
    }
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
    if(over.data.current?.kind==="note-todo"){
      const {period,important,before}=over.data.current as {period:NotePeriod;important:boolean;before?:string};
      const selected=selectedIds.includes(source.id)
        ? state.todos.filter((todo)=>selectedIds.includes(todo.id) && (todo.id===source!.id || notePeriod(todo)))
        : [source];
      const ids=new Set(selected.map((todo)=>todo.id));
      if(before && ids.has(before))return;
      const bucket=state.todos.filter((todo)=>!ids.has(todo.id) && waitingNoteTodo(todo,noteToday) &&
        notePeriod(todo)===period && (todo.priority==="high")===important).sort((a,b)=>a.position-b.position);
      const index=before?bucket.findIndex((todo)=>todo.id===before):-1;
      const moveDown=selected.length===1 && index>=0 && notePeriod(source)===period &&
        (source.priority==="high")===important && waitingNoteTodo(source,noteToday) && source.position<bucket[index].position;
      bucket.splice(index<0?bucket.length:index+Number(moveDown),0,...selected);
      const updates=bucket.flatMap((todo,position)=>ids.has(todo.id)?[putInNoteTodo(todo,period,important,position)]:
        todo.position!==position?[{...todo,position}]:[]);
      if(updates.length)await batchUpdate(updates,[],false);
      return;
    }
    if(waitingNoteTodo(source,noteToday))source={...source,plannedDate:null,time:""};

    if (over.data.current?.kind === "eisenhower") {
      const moving = selectedIds.includes(source.id) ? state.todos.filter((t) => selectedIds.includes(t.id)) : [source];
      await batchUpdate(moving.map((todo) => ({ ...todo, tags: withQuadrant(plannerPeriodTags(todo.tags,over.data.current?.period,anchor), over.data.current?.quadrant) })));
      return;
    }
    if (over.data.current?.kind === "note-storage") {
      const tasks = selectedIds.includes(source.id) ? state.todos.filter((t) => selectedIds.includes(t.id)) : [source];
      const date=over.data.current.date as string|undefined;
      if(!date)return;
      const content=noteWithTasks(over.data.current.value || state.dayNotes[date] || "",tasks,!!notebookFolder(date));
      if(typeof over.data.current.save!=="function")return;
      const saveNote=over.data.current.save;
      await storeInNote(tasks,date,()=>saveNote(content));
      return;
    }
    if(source.tags.includes("stored")) {
      const data=over.data.current;
      const target=state.todos.find((todo)=>todo.id===over.id);
      const day=data?.day || (target ? taskDay(target) : String(over.id).replace(/^tab:/,""));
      if(typeof day==="string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
        const grid=data?.kind==="timegrid" ? document.querySelector<HTMLElement>(`[data-day-grid="${day}"]`) : null;
        const change=grid ? scheduleAt(dragStartMinute(active,activatorEvent,delta,grid.getBoundingClientRect().top,
          Number(grid.dataset.minuteHeight)||0.55),source.duration || 60) : {time:"",duration:source.duration};
        await batchUpdate([restoreParkedTask(source,day,{day,...change})],[],false);
        setToast({text:"Zurück im Kalender"});
        return;
      }
    }
    if (over.data.current?.kind === "goal-category") {
      const category = `c:${over.data.current.categoryId}`;
      const tasks = selectedIds.includes(source.id)
        ? state.todos.filter((t) => selectedIds.includes(t.id))
        : [source];
      await batchUpdate(
        tasks.map((t) => ({ ...t, tags: [...new Set([...t.tags, category])] })),
      );
      return;
    }
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
      ? taskDay(target)
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
      .filter((t) => taskDay(t) === day && t.id !== source.id)
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
      plannedDate: t.id === source.id ? day : t.plannedDate,
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
  const calendarEvents = state.events.filter((event)=>!hiddenCalendars.includes(event.connectionId));
  const calendarTodos = hiddenCalendars.includes("lifemap") ? [] : state.todos.filter((todo)=>visible(todo) && !todo.tags.includes("stored") && !waitingNoteTodo(todo,noteToday))
    .map((todo)=>({...todo,calendarGroupColor:nativeGroupColor(todo.title,nativeCalendar.rules)}));
  const tags = [...new Set(state.todos.flatMap((todo)=>todo.tags))].filter((tag)=>!/^[chdnq]:|^note-origin:/.test(tag) && !["stored","auto:day"].includes(tag) && !tag.startsWith("note-todo:")).sort();
  const current = state.todos.find((todo)=>todo.id===selected);
  const eventsFor = (day: string) =>
    calendarEvents.filter((e) =>
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
      else next.setDate(next.getDate() + direction * (overview==="day"?1:7));
      navigationAnchor.current = dateKey(next);
      setAnchor(dateKey(next));
      setMobileDay(dateKey(next));
    },
    [overview],
  );

  const inboxAdd: React.ComponentProps<typeof LifeInbox>["onAdd"] = async (
    title,
    tags,
    notes,
    color,
  ) => {
    const daily = /\b(jeden\s+tag|täglich|taeglich|immer)\b/i.test(title);
    const todayKey=dateKey(new Date());
    const parsed = parseAppointmentInput(title.replace(/\b(jeden\s+tag|täglich|taeglich|immer)\b/gi, " "), todayKey, todayKey);
    const task = {
      ...newTodo(
        parsed.title || title,
        parsed.plannedDate || todayKey,
        state.todos.length + 1,
      ),
      time: parsed.time || "",
      duration: parsed.duration ?? (parsed.time ? 60 : null),
      location: parsed.location || "",
      description: parsed.description,
      tags: tags.includes("h:day") ? plannerPeriodTags(tags,"day",parsed.plannedDate || todayKey) : tags,
      notes,
      color: color || "green",
    };
    await mutate({ action: "save", todo: task });
    if (daily) {
      const base = parseDate(task.plannedDate || dateKey(new Date()));
      await batchUpdate(Array.from({ length: 365 }, (_, index) => ({ ...task, id: crypto.randomUUID(), plannedDate: dateKey(addDays(base, index + 1)) })));
      setToast({ text: "Tägliche Wiederholung für die nächsten 366 Tage angelegt." });
    }
  };
  const [autoPlanning,setAutoPlanning]=useState(false);
  const [autoPlanError,setAutoPlanError]=useState("");
  const autoPlanNotes = async () => {
    const range = plannerNotePeriod === "day" ? {start:anchor,end:anchor} : goalRange(anchor,plannerNotePeriod);
    const tasks = state.todos.filter((todo)=>{
      const day = taskDay(todo);
      return !todo.done && !todo.time && !todo.tags.includes("stored") && !waitingNoteTodo(todo,noteToday) && (isFlexibleTask(todo) || !day || (day>=range.start && day<=range.end));
    }).map((todo)=>({...todo,priority:todo.priority==="high" || quadrantOf(todo.tags)==="1" ? "high" as const : taskImportant(todo) ? "medium" as const : "low" as const}));
    if (!tasks.length) throw new Error(state.todos.some((todo)=>!todo.done && todo.tags.includes("stored"))
      ? "Aufgaben im Notizfeld werden ausgelassen. Doppelklicke eine Aufgabe, um sie zurück in den Kalender zu holen."
      : "Für diesen Zeitraum gibt es keine offenen Aufgaben ohne Uhrzeit.");
    const now=new Date();
    let result = autoSchedule(
      tasks,
      state.todos,
      state.events,
      range,
      now,
      zones,
    );
    const flexible=result.skipped.filter(isFlexibleTask);
    if(flexible.length){
      const today=dateKey(now);
      const nextStart=range.end<today?today:dateKey(addDays(parseDate(range.end),1));
      const nextEnd=dateKey(addDays(parseDate(nextStart),6));
      const next=autoSchedule(flexible,[...state.todos,...result.scheduled],state.events,{start:nextStart,end:nextEnd},now,zones);
      const added=new Set(next.scheduled.map((todo)=>todo.id));
      result={scheduled:[...result.scheduled,...next.scheduled],skipped:result.skipped.filter((todo)=>!added.has(todo.id))};
    }
    if (!result.scheduled.length)
      throw new Error(
        "Im gewählten Zeitraum ist kein freier Platz in den passenden Zonen oder regulären Planungszeiten verfügbar.",
      );
    await batchUpdate(result.scheduled.map((t) => ({ ...t, priority: state.todos.find((original) => original.id === t.id)?.priority || t.priority })), [], false);
    setSelectedIds([]);
    setPicked(null);
    setToast({
      text: `${result.scheduled.length} Aufgaben eingeplant${result.skipped.length ? ` · ${result.skipped.length} bleiben ohne Uhrzeit` : ""}`,
    });
  };
  const calendarFilters = (
    <div className="calendar-quick-filters" aria-label="Sichtbare Kalender">
      {[nativeCalendar,...state.connections].map((calendar)=>(
        <div className="calendar-visibility-row" key={calendar.id} title={calendar.name}>
          <button className="calendar-visibility-name" type="button"
            title="Klick zum Ein- oder Ausblenden · Doppelklick für Einstellungen"
            onClick={(event)=>{
              if(event.detail===0){toggleCalendar(calendar.id);return;}
              clearTimeout(calendarNameClicks.current.get(calendar.id));
              if(event.detail===1)calendarNameClicks.current.set(calendar.id,setTimeout(()=>{
                calendarNameClicks.current.delete(calendar.id);
                toggleCalendar(calendar.id);
              },350));
            }}
            onDoubleClick={()=>{
              clearTimeout(calendarNameClicks.current.get(calendar.id));
              calendarNameClicks.current.delete(calendar.id);
              setSelectionMode(false);
              setCalendarSettingsId(calendar.id);
            }}>{calendar.name}</button>
          <input type="checkbox" aria-label={`${calendar.name} anzeigen`} checked={!hiddenCalendars.includes(calendar.id)} onChange={()=>toggleCalendar(calendar.id)} style={{accentColor:calendar.color}}/>
        </div>
      ))}
    </div>
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
    storageOpen,
    setStorage: setStorageOpen,
    detailOpen: Boolean(selected || newOpen),
    blocked: Boolean(dragged || selected || dayPanel || planning || settings || newOpen || calendarEventEdit || calendarSettings || zoneEdit),
  });

  return (
    <div
      className={`app-shell ${selectionMode ? "area-selection-mode" : ""}`}
      {...areaSelection.bind}
      onContextMenu={(event) => {
        if (event.defaultPrevented) return;
        const target = event.target as Element;
        if (target.closest("input,textarea,select,[contenteditable],[role=dialog],[role=menu]") &&
            !target.closest(".legacy-note-todo.group-selected")) return;
        if (target.closest(".timeline-scroll,.calendar-overview-large")) {
          event.preventDefault();
          today();
          setOverview(null);
          setDatePreview(null);
          setPasteTarget(null);
          setPicked(null);
          setSelectedIds([]);
          setSelectionMode(false);
          setSelectionMenu(null);
        } else if (selectedIds.length) {
          event.preventDefault();
          setSelectionMenu({ x:event.clientX, y:event.clientY });
        }
      }}
      onClickCapture={(event) => {
        const target=event.target as Element;
        const notePanel=target.closest(".calendar-bottom-notes");
        const blankNoteArea=notePanel && !target.closest("button,a,input,textarea,select,label,summary,[contenteditable],[role=separator],[data-task-id],.selection-toolbar,.note-text-column,.notebook-sidebar");
        if(blankNoteArea && visibleNotesPosition==="below"){
          toggleNotes();
          return;
        }
        areaSelection.bind.onClickCapture(event);
        if (event.isPropagationStopped()) return;
        if (blankNoteArea || target.matches(".main-content,.planner-toolbar,.calendar-toolbar-leading,.calendar-category-bar,.calendar-category-zone,.timeline-scroll,.timeline-head,.timeline-body,.timeline-gutter-head,.time-axis,.time-axis span,.calendar-overview-large")) {
          setNotesPosition((position)=>position==="open"?"closing":position);
        }
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
        if (eventId) {
          const imported = state.events.find((item) => item.id === eventId);
          if (!imported) return;
                setSelected(null);
          setPicked(eventId);
          setSelectedIds([eventId]);
          setCalendarEventEdit(imported);
          return;
        }
        const open = () => { if(id)openCalendarTask(id); };
        if (event.detail === 0) open();
        else calendarClick.current = setTimeout(open, 300);
      }}
      onDoubleClickCapture={(event) => {
        const noteTask=(event.target as Element).closest<HTMLElement>("[data-note-task]");
        if(noteTask?.dataset.noteTask){
          event.preventDefault();event.stopPropagation();
          if(calendarClick.current)clearTimeout(calendarClick.current);
          void returnNoteTask(noteTask.dataset.noteTask).catch(handleError);
          return;
        }
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
        if (node.dataset.calendarEvent) {const imported=state.events.find((e)=>e.id===node.dataset.calendarEvent);if(imported)setCalendarEventEdit(imported);}
        else {
          const task=state.todos.find((todo)=>todo.id===node.dataset.calendarTask);
          if(task){
            const write=noteStore.current;
            void storeInNote([task],plannerNoteKey,write?()=>write([task]):undefined)
              .then(()=>setNotesPosition("open")).catch(handleError);
          }
        }
      }}
    >
      <ResourceDrawer
        open={storageOpen}
        pinned={storagePinned}
        onOpen={() => setStorageOpen(true)}
        onToggle={toggleStorage}
        onClose={closeStorage}
      />
      {shortcutHints.firstUse && (
        <ShortcutWelcome onChoose={shortcutHints.configure} />
      )}
      {areaSelection.rect && (
        <div
          className="selection-rectangle global-selection-rectangle"
          style={areaSelection.rect}
        />
      )}
      {selectionMenu && <div role="menu" className="planner-selection-menu selection-toolbar" style={{ position:"fixed", top:selectionMenu.y, left:selectionMenu.x, zIndex:1000 }}><button role="menuitem" onClick={() => { setSelectionMenu(null); void deleteGroup().catch(handleError); }}>Auswahl löschen</button><button role="menuitem" onClick={() => setSelectionMenu(null)}>Abbrechen</button></div>}
      <DndContext
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        sensors={sensors}
        collisionDetection={(args) => {
          if(args.active.data.current?.kind==="calendar-zone"){
            const scoped={...args,droppableContainers:args.droppableContainers.filter((item)=>item.data.current?.kind==="timegrid")};
            return args.pointerCoordinates?pointerWithin(scoped):closestCorners(scoped);
          }
          if (args.active.data.current?.kind === "life-tab") {
            const filtered = {
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) => c.data.current?.kind === "life-tab" && c.data.current.scope===args.active.data.current?.scope,
              ),
            };
            const tabHits = pointerWithin(filtered);
            return tabHits.length ? tabHits : closestCorners(filtered);
          }
          const scoped = {
            ...args,
            droppableContainers: dayPanel
              ? args.droppableContainers.filter((container)=>container.node.current?.closest('.day-panel[role="dialog"]'))
              : args.droppableContainers,
          };
          const hits = pointerWithin(scoped);
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
              (e.active.data.current?.legacyTodo
                ? newTodo(e.active.data.current.legacyTodo.title,null,0)
                : e.active.data.current?.suggestion
                ? {
                    ...newTodo(e.active.data.current.suggestion.title, null, 0),
                    color: e.active.data.current.suggestion.color || "green",
                  }
                : null),
          )
        }
        onDragCancel={()=>setDragged(null)}
        onDragEnd={(event)=>{
          if (event.active.data.current?.kind === "life-tab") {
            if (event.over?.data.current?.kind === "life-tab")
              window.dispatchEvent(
                new CustomEvent("raum-tab-reorder", {
                  detail: {
                    active: event.active.data.current.tabId,
                    over: event.over.data.current.tabId,
                    scope: event.active.data.current.scope,
                  },
                }),
              );
            return;
          }
          void move(event).catch(handleError);
        }}
      >
        <div ref={workspaceRef} className={`workspace calendar-workspace ${visibleNotesPosition==="open"?"notes-overlay-active":""}`}>
          <main className="main-content">
            <div className="planner-toolbar">
              <div className="calendar-toolbar-leading">
              <div className="week-nav">
                <h2
                  className="overview-nav date-navigation"
                  onMouseLeave={() => {
                    if (!selectionMode && !dragged) setDatePreview(null);
                  }}
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
                    {overview==="day"?`${parseDate(anchor).getDate()}.`:`${start.getDate()}.–${end.getDate()}.`}
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
                        onToggle={toggle}
                        period={datePreview}
                        todos={calendarTodos}
                        events={calendarEvents}
                        connections={state.connections}
                        onPick={(day) => {
                          setPasteTarget({ day, time: "" });
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
                <a className="today-button" href="/lifemap/board" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}} title="Freie LifeMap öffnen">◇ LifeMap</a>
              </div>
            <CalendarTabs onCreate={(id,color,suggestions)=>{
              setNewSlot({day:dateKey(new Date()),time:"",category:{id,color,suggestions}});
              setNewOpen(true);
            }} onAdd={(title,id,color)=>{
              const entry=parseQuadrant(title);
              return inboxAdd(entry.title,withQuadrant(["h:day",`c:${id}`],entry.quadrant),"",color);
            }} renderFeature={(id,close)=><LifeInbox key={id} featureTab={id} todos={state.todos} events={state.events}
              anchor={anchor} onAdd={inboxAdd} onOpen={(taskId)=>{close();setSelected(taskId);}} onPriority={()=>{}}/>}/>
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
              <button type="button" className="today-button zone-mode-toggle" aria-pressed={zoneMode} title="Zonenmodus (Z)" onClick={toggleZones}>Zonen</button>
              <span className="save-indicator" aria-live="polite">
                {busy ? "Speichert …" : ""}
              </span>
            </div>
            <nav className="mobile-tabs">
              {days.map((day, i) => (
                <MobileDay
                  key={dateKey(day)}
                  day={dateKey(day)}
                  active={dateKey(day) === mobileDay}
                  onClick={() => {
                    setMobileDay(dateKey(day));
                                  }}
                >
                  {DAYS[i].slice(0, 2)}
                  <b>{day.getDate()}</b>
                </MobileDay>
              ))}
            </nav>
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
            ) : overview === "month" || overview === "year" ? (
              <>
              {calendarFilters}
              <CalendarOverview
                onToggle={toggle}
                large
                onExtend={extendAcross}
                onCreate={(day) => {
                                setNewSlot({ day, time: "", drawn: false });
                  setNewOpen(true);
                }}
                onOpen={(id) => {
                  setEditGroup([id]);
                  openCalendarTask(id);
                }}
                period={`${overview}:${overview === "year" ? anchor.slice(0, 4) + "-01-01" : anchor.slice(0, 7) + "-01"}`}
                todos={calendarTodos}
                events={calendarEvents}
                connections={state.connections}
                onPick={(day) => {
                  setPasteTarget({ day, time: "" });
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
              </>
            ) : (
              <Timeline
                calendarFilters={calendarFilters}
                zoneMode={zoneMode}
                zones={zones}
                onZoneEdit={setZoneEdit}
                days={overview==="day"?[parseDate(anchor)]:days}
                mobileDay={mobileDay}
                todos={calendarTodos}
                events={calendarEvents}
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
                  if (zoneMode) {
                    const start=toMinutes(time);
                    setZoneEdit({id:crypto.randomUUID(),name:"",color:"#47866d",outline:false,start,
                      end:Math.min(1440,start+(duration || 60)),days:days?.length?days:[day],
                      repeat:"none",until:"",categories:[]});
                    setZoneMode(false);
                    return;
                  }
                                setPasteTarget({ day, time });
                  setNewSlot({ day, time, duration, days, drawn });
                  setNewOpen(true);
                }}
                onEvent={setCalendarEventEdit}
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
                          data-calendar-event={event.id}
                          data-task-id={event.id}
                        >
                          {event.title}
                        </button>
                      ))}
                    <TaskList
                      id={key}
                      todos={[]}
                      onOpen={setSelected}
                      onToggle={toggle}
                          >
                      <QuickAdd day={key} onAdd={add} />
                    </TaskList>
                    <DayNote
                      preferences={notePreferences}
                      tasks={state.todos}
                      onTaskOpen={openNoteTask}
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
            <section ref={notesPanelRef} tabIndex={-1} className={`calendar-bottom-notes notes-${visibleNotesPosition}`} aria-label="Kalendernotizen" inert={visibleNotesPosition==="closing"}
              onAnimationEnd={(event)=>{
                if(!newOpen && event.target===event.currentTarget && event.animationName==="notes-slide-out")
                  setNotesPosition((position)=>position==="closing"?"below":position);
              }}>
              <div className={`notebook-workspace${notebookOpen?" notebook-sidebar-open":""}${noteTodosCollapsed?" todos-folded":""}`}>
              <NotebookNavigation open={notebookOpen} onToggle={()=>{
                  setNotebookOpen((open)=>!open);
                  if(!notebookOpen && visibleNotesPosition==="below" && !notesPanelRef.current?.closest("main")?.scrollTop)toggleNotes();
                }}
                values={state.dayNotes} calendarKeys={calendarNoteKeys} pinned={calendarNoteKey} tabs={visibleNoteTabs} active={plannerNoteKey}
                onOpen={(key)=>{
                  openNote(key);
                  if(visibleNotesPosition==="below" && !notesPanelRef.current?.closest("main")?.scrollTop)toggleNotes();
                }} onClose={closeNote}
                onFolder={async(name)=>{
                  const date=`note-folder:${crypto.randomUUID()}`;
                  await api("/api/notes",{date,content:name});
                  setState((current)=>({...current,dayNotes:{...current.dayNotes,[date]:name}}));
                }}
                onCreate={(folder="root")=>{void (async()=>{
                  const date=`note:${folder}:${crypto.randomUUID()}`;
                  const content="Neue Notiz\n";
                  await api("/api/notes",{date,content});
                  setState((current)=>({...current,dayNotes:{...current.dayNotes,[date]:content}}));
                  openNote(date);
                  setFreshNote(date);
                  setNotesPosition("open");
                })().catch(handleError);}}
              />
              <InboxNotes
                key={plannerNoteKey}
                label={notebookTitle(plannerNoteKey,state.dayNotes[plannerNoteKey] || "")}
                titled={!!notebookFolder(plannerNoteKey)}
                focusTitle={freshNote===plannerNoteKey}
                noteDate={plannerNoteKey}
                tasks={state.todos}
                onTaskOpen={openNoteTask}
                preferences={notePreferences}
                todoPanel={<NoteTodoBoard todos={state.todos} today={noteToday} columns={notePreferences.columns} selected={selectedIds}
                  onToggle={(todo)=>void toggle(todo)} onOpen={openCalendarTask}
                  onAdd={async(title,period,important)=>{
                    const position=Math.max(-1,...state.todos.filter((todo)=>notePeriod(todo)===period).map((todo)=>todo.position))+1;
                    await save(putInNoteTodo(newTodo(title,null,position),period,important,position));
                  }}/>}
                registerStore={(store)=>{noteStore.current=store;}}
                registerLegacyDelete={(remove)=>{noteLegacyDelete.current=remove;}}
                value={state.dayNotes[plannerNoteKey] || ""}
                onSave={async(content)=>{
                  await api("/api/notes",{date:plannerNoteKey,content});
                  setState((current)=>({...current,dayNotes:{...current.dayNotes,[plannerNoteKey]:content}}));
                }}
                actions={<>
              <button type="button" className="secondary-button" aria-label="Notizfeld-Einstellungen" onClick={()=>setNoteSettingsOpen(true)}><Settings2 size={15}/></button>
              <button type="button" className="secondary-button auto-plan-button" disabled={autoPlanning}
                onClick={async()=>{
                  setAutoPlanning(true);setAutoPlanError("");
                  try{await autoPlanNotes();}catch(error){setAutoPlanError((error as Error).message);}finally{setAutoPlanning(false);}
                }}><CalendarClock size={16}/>{autoPlanning?"Wird eingeplant …":"Auto planen"}</button>
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
                </>}
              />
              <div className="notebook-todo-heading">
                {visibleNotesPosition==="below"?
                  <button type="button" onClick={toggleNotes} aria-label="Notepad öffnen · To-do-Liste">To-do-Liste</button>:
                  <strong>To-do-Liste</strong>}
                {(visibleNotesPosition==="below" || noteTodosCollapsed) && (["day","week"] as const).map((period)=>{
                  const open=state.todos.filter((todo)=>!todo.done && notePeriod(todo)===period && waitingNoteTodo(todo,noteToday));
                  const important=open.filter((todo)=>todo.priority==="high").length;
                  const legacy=readNoteLines(state.dayNotes[calendarNoteKeys[period==="day"?0:1]] || "")
                    .filter((line)=>line.box && !line.done && !line.taskId && line.text.trim()).length;
                  const normal=open.length-important+legacy;
                  return (important>0 || normal>0) && <span key={period} className="notebook-todo-badges">
                    <strong>{period==="day"?"T":"W"}</strong>
                    {important>0 && <span className="todo-rail-important" title={`${important} offene wichtige To-dos`}>{important}</span>}
                    {normal>0 && <span className="todo-rail-normal" title={`${normal} offene normale To-dos`}>{normal}</span>}
                  </span>;
                })}
              </div>
              {visibleNotesPosition!=="below" && <button type="button" className="notebook-todo-rail"
                aria-label={noteTodosCollapsed?"To-do-Liste ausklappen":"To-do-Liste einklappen"} aria-expanded={!noteTodosCollapsed} onClick={toggleNoteTodos}>
                {noteTodosCollapsed?<ArrowLeft size={14}/>:<ArrowRight size={14}/>}
              </button>}
              </div>
              {autoPlanError && <p role="alert">{autoPlanError}</p>}
            </section>
            {query && (
              <div className="search-outside">
                {state.todos
                  .filter(
                    (t) =>
                      (!taskDay(t) || !weekKeys.includes(taskDay(t)!)) && visible(t),
                  )
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        const day = taskDay(t);
                        if (day) {
                          setAnchor(day);
                          setMobileDay(day);
                        }
                        setSelected(t.id);
                      }}
                    >
                      <Search size={13} />
                      {t.title}
                      <span>
                        {taskDay(t) ? parseDate(taskDay(t)!).toLocaleDateString("de-DE") : "Ohne Kalendertag"}
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  ))}
              </div>
            )}
          </main>
        </div>
        <DragOverlay style={{pointerEvents:"none"}} dropAnimation={null} modifiers={[(args)=>{
          const {active,over,activeNodeRect,activatorEvent,transform}=args;
          if(!active || !over || !activeNodeRect || over.data.current?.kind!=="timegrid")return transform;
          const grid=document.querySelector<HTMLElement>(`[data-day-grid="${over.data.current.day}"]`);
          if(!grid)return transform;
          const rect=grid.getBoundingClientRect(), scale=Number(grid.dataset.minuteHeight)||.55;
          const {time}=scheduleAt(dragStartMinute(active,activatorEvent,transform,rect.top,scale));
          const minute=toMinutes(time);
          return {...transform,x:rect.left+3-activeNodeRect.left,y:rect.top+(minute<360?1080:gridMinute(minute))*scale-activeNodeRect.top};
        }]}>
          {dragged ? (
            <div
              className="task-drag-group"
              data-active-task-drag
              aria-label="Gezogene Aufgaben"
            >
              {(selectedIds.includes(dragged.id)
                ? state.todos.filter((t) => selectedIds.includes(t.id))
                : [dragged]
              ).map((todo) => (
                <div
                  key={todo.id}
                  className={`drag-group-item color-${todo.color || "green"}`}
                >
                  <CategoryIcon id={todo.tags.find((tag)=>tag.startsWith("c:"))?.slice(2) || "todo"} size={14} /><span>{todo.title}</span>
                </div>
              ))}
            </div>
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
        <PeriodReview
          state={state}
          ready={!loading}
          onAdd={async (title, day, tags, color) => {
            const parsed = parseAppointmentInput(title, day);
            const task = {
              ...newTodo(
                parsed.title || title,
                parsed.plannedDate || day,
                state.todos.length + 1,
              ),
              time: parsed.time || "",
              duration: parsed.duration ?? (parsed.time ? 60 : null),
              location: parsed.location || "",
              description: parsed.description,
              tags,
              color: color || "green",
            };
            await mutate({ action: "save", todo: task });
          }}
        />
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
          period={overview === "month" || overview === "year" ? overview : "week"}
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
          onSave={async (draft, imported, recurrence) => {
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
            if(recurrence && draft.plannedDate){
              const seriesId=draft.seriesId || draft.id;
              const existing=new Set(state.todos.filter((task)=>task.seriesId===seriesId).map((task)=>task.plannedDate));
              const dates=repeatDates(draft.plannedDate,recurrence.days,recurrence.weeks).filter((day)=>!existing.has(day));
              const source={...draft,seriesId};
              if(!dates.length){await save(source);return;}
              const todos=dates.map((day)=>({...source,id:crypto.randomUUID(),plannedDate:day,
                subtasks:source.subtasks.map((item)=>({...item,id:crypto.randomUUID()})),
              }));
              await mutate({action:"createMany",source,todos},false);
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
            } else await save(draft.plannedDate && draft.tags.includes("stored") ? restoreParkedTask(draft,draft.plannedDate,{
              day:draft.plannedDate,time:draft.time,duration:draft.duration,
            }) : draft);
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
          titleSuggestions={newSlot?.category?.suggestions}
          showSchedule={!newSlot?.drawn}
          todo={{
            ...newTodo("", newSlot?.day || null, state.todos.length + 1),
            ...(newSlot?.category ? {
              tags: plannerPeriodTags([`c:${newSlot.category.id}`,"auto:day"],"day",newSlot.day),
              color: newSlot.category.color,
            } : {}),
            time: newSlot?.time || "",
            duration: newSlot?.time ? newSlot.duration || 60 : null,
          }}
          onClose={() => {
            setNewOpen(false);
            setPicked(null);
            setSelectedIds([]);
            setPasteTarget(null);
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
            setSelected(null);
            setPicked(null);
            setSelectedIds([]);
            setPasteTarget(null);
          }}
          aiAvailable={state.aiAvailable}
          onAiConnected={() => setState((s) => ({ ...s, aiAvailable: true }))}
          onError={handleError}
          onSave={async (draft, imported, recurrence) => {
            if (imported) {
              const tasks = screenshotTasks(draft, imported, () =>
                crypto.randomUUID(),true,
              );
              await mutate({ action: "createMany", todos: planOnSave(tasks) });
              setToast({
                text:
                  tasks.length > 1
                    ? `${tasks.length} Screenshot-Termine erstellt`
                    : "Screenshot-Termin erstellt",
              });
              return;
            }
            const dates = recurrence && draft.plannedDate
              ? [draft.plannedDate,...repeatDates(draft.plannedDate,recurrence.days,recurrence.weeks)]
              : (newSlot?.days?.length || 0) > 1 ? newSlot!.days! : [draft.plannedDate];
            const todos = dates.map((day,index) => ({
              ...draft,
              id: index===0 ? draft.id : crypto.randomUUID(),
              seriesId: dates.length > 1 ? draft.id : "",
              plannedDate: day,
              tags:dates.length>1?draft.tags.filter((tag)=>tag!=="auto:day"):draft.tags,
              subtasks: draft.subtasks.map((t) => ({
                ...t,
                id: crypto.randomUUID(),
              })),
            }));
            const planned=planOnSave(todos);
            await mutate({ action: "createMany", todos:planned });
            if (newSlot?.category) {
              void api("/api/task-templates",{category:newSlot.category.id,title:draft.title,used:true})
                .then(()=>window.dispatchEvent(new Event("lifemap-templates-changed")))
                .catch(handleError);
            }
            setToast({
              text:
                todos.length > 1
                  ? `${todos.length} Termine erstellt${planned.some((task)=>!task.time)?" · Einige bleiben ohne Uhrzeit":""}`
                  : planned[0].time ? "Aufgabe erstellt" : "Aufgabe erstellt · Kein freier Zeitraum gefunden",
            });
          }}
        />
      )}
      {noteSettingsOpen && <NoteSettings value={notePreferences} onSave={saveNotePreferences} onClose={()=>setNoteSettingsOpen(false)}/>}
      {zoneEdit && <ZoneEditor key={zoneEdit.id} zone={zoneEdit} existing={zones.some((zone)=>zone.id===zoneEdit.id)}
        onClose={()=>setZoneEdit(null)}
        onSave={async(zone)=>setZones((await api("/api/zones",{action:"save",zone})).zones)}
        onDelete={async()=>setZones((await api("/api/zones",{action:"delete",id:zoneEdit.id})).zones)}/>}
      {calendarSettings && <CalendarOptions key={calendarSettings.id} connection={calendarSettings}
        onRefresh={async()=>{await Promise.all([load(),refreshNative()]);}} onClose={()=>setCalendarSettingsId(null)}/>}
      {calendarEventEdit && <CalendarEventEditor key={`${calendarEventEdit.id}:${calendarDeleteOnly}`} event={calendarEventEdit} deleteOnly={calendarDeleteOnly} matchingTitle={hasMatchingCalendarTitle(state.events, calendarEventEdit)} connection={state.connections.find((c)=>c.id===calendarEventEdit.connectionId)} onRefresh={async()=>{await load();setSelectedIds([]);setPicked(null);}} onClose={()=>{setCalendarEventEdit(null);setCalendarDeleteOnly(false);}}/>}
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
  preferences,
  tasks,
  onTaskOpen,
  day,
  value,
  onSave,
}: {
  preferences:NotePreferences;
  tasks: Todo[];
  onTaskOpen: (id:string)=>void;
  day: string;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const {text:draft,setText:setDraft,flush}=useAutosaveText(value,onSave);
  const wrapper=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !wrapper.current?.contains(event.target)){void flush();setOpen(false);}};document.addEventListener("pointerdown",outside,true);return()=>document.removeEventListener("pointerdown",outside,true);},[open,flush]);
  const preview=readNoteLines(draft).flatMap((line)=>{
    if(!line.taskId)return line.text.trim()?[line]:[];
    const task=tasks.find((todo)=>todo.id===line.taskId && todo.tags.includes("stored") && todo.tags.includes(`n:${day}`));
    return task?[{...line,text:task.title}]:[];
  });
  return (
    <div ref={wrapper} className="day-note" data-escape-layer={open ? "" : undefined}>
      {open && (
        <button
          hidden
          data-close
          type="button"
          onClick={() => {
            void flush();
            setOpen(false);
          }}
        >
          Schließen
        </button>
      )}
      {open ? (
        <div className="day-note-entry">
          <FileText size={12} aria-hidden="true" />
          <PlannerNotepad
            autoFocus
            compact
            preferences={preferences}
            noteDate={day}
            tasks={tasks}
            onTaskOpen={onTaskOpen}
            label={`Tagesnotiz ${day}`}
            value={draft}
            onChange={setDraft}
            onBlur={flush}
          />
          <button type="button" className="day-note-done" onClick={()=>{void flush();setOpen(false);}}>Fertig</button>
        </div>
      ) : (
        <button
          aria-label={`Tagesnotiz ${day} bearbeiten`}
          title="Tagesnotiz"
          className="day-note-preview"
          onClick={() => setOpen(true)}
        >
          <FileText size={12} aria-hidden="true" />
          {preview.length>0 && <span>{preview.slice(0,2).map((line,i)=><span key={i}>{line.box ? (line.done?"☑ ":"☐ "):""}{line.text}</span>)}{preview.length>2 && <small>+{preview.length-2}</small>}</span>}
        </button>
      )}
    </div>
  );
}
function Detail({
  isNew = false,
  titleSuggestions,
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
  titleSuggestions?: string[];
  editSchedule?: boolean;
  showSchedule?: boolean;
  groupCount?: number;
  onNavigate?: (key: string) => void;
  todo: Todo;
  onClose: () => void;
  onSave: (todo: Todo, imported?: ScreenshotEvent[], recurrence?: {days:number[];weeks:number}) => Promise<void>;
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
  const [travelOpen, setTravelOpen] = useState(false);
  const travelRequest = useRef<AbortController | null>(null);
  const travelTimer = useRef<number | null>(null);
  useEffect(() => () => travelRequest.current?.abort(), []);
  const [travelOrigin, setTravelOrigin] = useState("");
  const [chosenOrigin, setChosenOrigin] = useState("");
  const [chosenDestination, setChosenDestination] = useState("");
  const [travelOptions, setTravelOptions] = useState<
    {
      mode: "bike" | "transit";
      before?: number;
      after?: number;
      label?: string;
      error?: string;
    }[]
  >([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceProposal[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeSearchDone, setPlaceSearchDone] = useState(false);
  const placeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => placeRequest.current?.abort(), []);
  const findPlace = async (title = draft.title, context = "") => {
    const queries = placeQueries(title, context, "Köln");
    if (!queries.length) return;
    placeRequest.current?.abort();
    const controller = new AbortController();
    placeRequest.current = controller;
    setPlaceSearching(true);
    setPlaceSearchDone(false);
    setPlaceSuggestions([]);
    try {
      const r = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (!controller.signal.aborted) {
        setPlaceSuggestions(data.proposals || []);
        setPlaceSearchDone(true);
      }
    } catch (e) {
      if (!controller.signal.aborted) onError(e);
    } finally {
      if (!controller.signal.aborted) setPlaceSearching(false);
    }
  };
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
    setDraft((t) => ({ ...t, ...patch,
      ...("plannedDate" in patch ? {tags:(patch.tags || t.tags).filter((tag)=>tag!=="auto:day")} : {}),
    }));
  };
  const changeScreenshot = (plan: ScreenshotImport) => {
    rememberDraft();
    setScreenshot(plan);
  };
  const imported = (field: string) =>
    importedFields.includes(field) ? true : undefined;
  const readTitle = (raw=draft.title) => {
    const text=titleSuggestions ? parseQuadrant(raw).title : raw;
    if(!isNew && raw===todo.title)return {
      title:raw,description:"",plannedDate:undefined,time:undefined,duration:undefined,location:undefined,repeatDays:[] as number[],
    };
    return parseRecurringAppointmentInput(text,draft.plannedDate || dateKey(new Date()),dateKey(new Date()));
  };
  const recognized=readTitle();
  const extractTitle = (raw = draft.title) => {
    const categoryEntry = titleSuggestions ? parseQuadrant(raw) : undefined;
    const parsed = readTitle(raw);
    const tags=parsed.plannedDate ? draft.tags.filter((tag)=>tag!=="auto:day") : draft.tags;
    return {
      ...draft,
      title: parsed.title,
      tags: categoryEntry?.quadrant ? withQuadrant(tags,categoryEntry.quadrant) : tags,
      location:
        parsed.location ||
        draft.location ||
        addressFromText(draft.description) ||
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
      time: first.time || "",
      duration: first.time ? first.duration || 60 : null,
      location: addressFromText(first.location || "")
        ? first.location
        : draft.location || "",
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
    if (!addressFromText(first.location || "")) void findPlace(title, text);
  };
  const destination =
    draft.location ||
    addressFromText(draft.title + "\n" + draft.description) ||
    "";
  const routeReady = Boolean(
    (addressFromText(travelOrigin) ||
      /^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(travelOrigin) ||
      chosenOrigin === travelOrigin) &&
    (addressFromText(destination) || chosenDestination === destination),
  );
  const calculateTravel = async () => {
    if (!destination || !travelOrigin.trim()) return;
    if (!routeReady) return;
    if (!draft.plannedDate || !draft.time) return;
    if (travelTimer.current !== null) window.clearTimeout(travelTimer.current);
    travelRequest.current?.abort();
    const controller = new AbortController();
    travelRequest.current = controller;
    setTravelBusy(true);
    try {
      const response = await fetch("/api/travel", {
        signal: controller.signal,
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
      if (controller.signal.aborted) return;
      setTravelOptions(result.options);
      localStorage.setItem("lifemap-travel-origin", travelOrigin);
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      if (travelRequest.current === controller) setTravelBusy(false);
    }
  };
  useEffect(() => {
    travelRequest.current?.abort();
    setTravelBusy(false);
    setTravelOptions([]);
    if (
      travelOpen &&
      routeReady &&
      travelOrigin.trim() &&
      destination.trim() &&
      draft.plannedDate &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
    ) {
      travelTimer.current = window.setTimeout(
        () => void calculateTravel(),
        700,
      );
    }
    return () => {
      if (travelTimer.current !== null)
        window.clearTimeout(travelTimer.current);
    };
  }, [
    travelOpen,
    routeReady,
    travelOrigin,
    destination,
    draft.plannedDate,
    draft.time,
    draft.duration,
  ]);
  const persist = async () => {
    if (closing || (isNew && saved)) return false;
    if (readingImage || imageRequest.current || travelBusy) return false;
    setSaving(true);
    try {
      const parsed = extractTitle();
      await onSave(
        parsed,
        screenshot ? screenshotOccurrences(screenshot, parsed) : undefined,
        recognized.repeatDays.length ? {days:recognized.repeatDays,weeks:repeatWeeks} : undefined,
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
      if(e.target===panelRef.current && isTitleKey(e))return;
      if (
        (e.metaKey || e.ctrlKey) &&
        ["z", "y"].includes(e.key.toLowerCase()) &&
        (Boolean(screenshot) ||
          importedFields.length > 0 ||
          ((e.key.toLowerCase() === "y" || e.shiftKey) &&
            draftFuture.current.length > 0) ||
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
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
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
        data-initial-focus={isNew?undefined:true}
        data-type-title="task"
        data-draft-editor
        className="detail-panel compact-detail"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Neue Aufgabe" : "Aufgabendetails"}
        tabIndex={-1}
        onKeyDown={(e) => {
          if(typeTitle(e,(title)=>update({title})))return;
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
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        <div className="detail-scroll">
          <div className="detail-title">
            {notePeriod(draft) && <input type="checkbox" aria-label="To-do abhaken" checked={draft.done} onChange={()=>update({done:!draft.done})}/> }
            <TaskPicture todo={draft} editable />
            <TaskPersonAvatar todo={draft} />
            <textarea
              data-initial-focus={isNew ? true : undefined}
              data-title-field
              placeholder="Was möchtest du erledigen?"
              data-shortcut="Enter → Termin erstellen / speichern · Shift Enter → neue Zeile"
              aria-label="Aufgabentitel"
              data-imported={imported("title")}
              value={draft.title}
              maxLength={500}
              onChange={(e) => update({title:e.target.value})}
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
                    if (text) update({title:(before+text+after).slice(0,500)});
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
          {(recognized.time || recognized.plannedDate || recognized.duration || recognized.repeatDays.length>0) && (
            <div className="recognized-appointment" aria-label="Erkannte Terminangaben">
              {recognized.plannedDate && <span>{parseDate(recognized.plannedDate).toLocaleDateString("de-DE")}</span>}
              {recognized.time && <span>{recognized.time} Uhr</span>}
              {recognized.duration && <span>{recognized.duration} Min.</span>}
              {recognized.repeatDays.length>0 && <span>{recognized.repeatDays.length===7?"Täglich":recognized.repeatDays.map((day)=>DAYS[day].slice(0,2)).join(", ")} · {repeatWeeks} Wochen</span>}
            </div>
          )}
          {titleSuggestions && titleSuggestions.some((title)=>title.toLocaleLowerCase("de").includes(draft.title.toLocaleLowerCase("de"))) && (
            <select aria-label="Gespeicherte Aufgabenvorschläge" value="" onChange={(event)=>update({title:event.target.value})}>
              <option value="" disabled>Gespeicherte Vorschläge …</option>
              {titleSuggestions.filter((title)=>title.toLocaleLowerCase("de").includes(draft.title.toLocaleLowerCase("de"))).slice(0,12).map((title)=><option key={title}>{title}</option>)}
            </select>
          )}
          {readingImage && (
            <p role="status" className="assessment-label">
              Screenshot wird gelesen …
            </p>
          )}
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
          {screenshot && (placeSearching || placeSuggestions.length > 0) && (
            <div className="screenshot-place-suggestions">
              <small>
                {placeSearching
                  ? "Passender Ort wird gesucht …"
                  : "Adressvorschlag"}
              </small>
              {placeSuggestions.map((p) => (
                <div className="place-proposal" key={p.address}>
                  <button
                    type="button"
                    onClick={() => {
                      update({ location: p.address });
                      setTravelOptions([]);
                      setPlaceSuggestions([]);
                      setImportedFields((f) => [
                        ...new Set([...f, "location"]),
                      ]);
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span>{p.address}</span>
                    <small>Übernehmen</small>
                  </button>
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.source} ↗
                  </a>
                </div>
              ))}
            </div>
          )}
          <div className="detail-fields">
            {!(
              (isNew && showSchedule) ||
              screenshot ||
              editSchedule ||
              importedFields.some((f) =>
                ["plannedDate", "time", "duration"].includes(f),
              )
            ) && (
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
            )}
            {((isNew && showSchedule) ||
              screenshot ||
              importedFields.some((f) =>
                ["plannedDate", "time", "duration"].includes(f),
              )) && (
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
            {editSchedule &&
              !isNew &&
              !importedFields.some((f) =>
                ["plannedDate", "time", "duration"].includes(f),
              ) && (
                <ScheduleFields
                  showDate={false}
                  time={draft.time}
                  duration={draft.duration || 60}
                  groupLabel={
                    groupCount > 1
                      ? `Uhrzeit für ${groupCount} Tage`
                      : "Uhrzeit"
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
            <div className="detail-schedule-options">
            <details
              className="travel-settings"
              onToggle={(e) => {
                setTravelOpen(e.currentTarget.open);
                if (
                  e.currentTarget.open &&
                  !destination &&
                  !placeSearching &&
                  !placeSearchDone
                )
                  void findPlace();
              }}
            >
              <summary>
                Wegzeit berechnen
                {draft.travelBefore || draft.travelAfter
                  ? ` · ${(draft.travelBefore || 0) + (draft.travelAfter || 0)} Min.`
                  : ""}
              </summary>
              <div className="travel-form">
                <div className="travel-address-field">
                  <span>Startadresse</span>
                  <AddressInput
                    label="Startadresse für Wegzeit"
                    onChoose={setChosenOrigin}
                    value={travelOrigin}
                    locate
                    onError={onError}
                    onChange={(value) => {
                      setTravelOrigin(value);
                      setTravelOptions([]);
                    }}
                  />
                </div>
                <div className="travel-address-field">
                  <span>Zieladresse</span>
                  <AddressInput
                    label="Zieladresse für Wegzeit"
                    onChoose={setChosenDestination}
                    value={destination}
                    onError={onError}
                    onChange={(location) => {
                      update({ location });
                      setTravelOptions([]);
                    }}
                  />
                </div>
                <div className="place-proposals">
                  <button
                    type="button"
                    className="text-button"
                    disabled={placeSearching || !draft.title.trim()}
                    onClick={() => void findPlace()}
                  >
                    <Search size={14} />
                    {placeSearching ? "Ort wird gesucht …" : "Ort vorschlagen"}
                  </button>
                  {placeSuggestions.map((p) => (
                    <div className="place-proposal" key={p.address}>
                      <button
                        type="button"
                        onClick={() => {
                          update({ location: p.address });
                          setChosenDestination(p.address);
                          setTravelOptions([]);
                          setPlaceSuggestions([]);
                        }}
                      >
                        <strong>{p.name}</strong>
                        <span>{p.address}</span>
                        <small>Als Ziel übernehmen</small>
                      </button>
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        {p.source} ↗
                      </a>
                    </div>
                  ))}
                  {placeSearchDone &&
                    !placeSuggestions.length &&
                    !destination && (
                      <span className="place-empty">
                        Kein eindeutiger Ort gefunden.
                      </span>
                    )}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    !routeReady ||
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
                        disabled={
                          travelBusy ||
                          option.before === undefined ||
                          option.after === undefined
                        }
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
                        <div className="maps-trip-links">
                          <a
                            href={mapsDirections(
                              travelOrigin,
                              destination,
                              option.mode,
                              draft.plannedDate,
                              draft.time,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Google Maps · Hinweg ↗
                          </a>
                          <a
                            href={mapsDirections(
                              travelOrigin,
                              destination,
                              option.mode,
                              draft.plannedDate,
                              draft.time,
                              true,
                              draft.duration || 60,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Rückweg ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
            {!screenshot && (
              <RepeatPicker legend="Wöchentlich wiederholen">
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
                  <RepeatDays selected={repeatDays} onChange={setRepeatDays}/>
                  <RepeatWeeks value={repeatWeeks} onChange={setRepeatWeeks}/>
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
              </RepeatPicker>
            )}
            </div>
            <div className="detail-reminder-colors">
              <button
                type="button"
                className="reminder-toggle"
                aria-pressed={Boolean(draft.reminder)}
                onClick={() => update({ reminder: !draft.reminder })}
              >
                <Bell size={16} />
                <span>
                  Erinnerung<small>1 Tag vorher</small>
                </span>
              </button>
              <div className="detail-color-row">
                <ColorPicker
                  value={draft.color}
                  onChange={(color) => update({ color })}
                />
              </div>
            </div>
            <div className="detail-classification">
              <fieldset className="priority-picker">
                <legend className="visually-hidden">Wichtigkeit</legend>
                {(["medium","high"] as const).map((priority)=><button key={priority} type="button"
                  className={`task-flag-button flag-${priority==="high"?"red":"yellow"}`}
                  aria-label={priority==="high"?"Rote Flagge":"Gelbe Flagge"} aria-pressed={draft.priority===priority}
                  onClick={()=>update({priority:draft.priority===priority?"none":priority,tags:withQuadrant(draft.tags)})}>
                  <Flag size={16} fill={draft.priority===priority?"currentColor":"none"}/>
                </button>)}
              </fieldset>
              <label className="detail-tags">
                <span>
                  <Layers2 size={15} aria-hidden="true" />
                </span>
                <input
                  aria-label="Tags, mit Komma getrennt"
                  placeholder="Studium, Privat …"
                  value={draft.tags
                    .filter((x) => x!=="auto:day" && !/^(k|r|h|c|q|d|note-origin|note-todo):/.test(x))
                    .join(", ")}
                  onChange={(e) =>
                    update({
                      tags: [
                        ...draft.tags.filter((x) => x==="auto:day" || /^(k|r|h|c|q|d|note-origin|note-todo):/.test(x)),
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
          <TaskDescription
            value={draft.description}
            subtasks={draft.subtasks}
            imported={imported("description")}
            onChange={(patch) => {
              if (patch.description === undefined) {
                update(patch);
                return;
              }
              const location =
                addressFromText(patch.description) ||
                addressFromText(draft.title);
              const changed = location !== (draft.location || "");
              if (changed) setTravelOptions([]);
              update({
                ...patch,
                location,
                ...(changed
                  ? { travelBefore: 0, travelAfter: 0, travelMode: "" as const }
                  : {}),
              });
            }}
          />
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
          <h2>Einstellungen</h2>
          <IconButton title="Einstellungen schließen" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <h3>Kalender</h3>
        <div className="connection-list">
          {state.connections.map((c) => (
            <div className="connection" key={c.id}>
              <span className="connection-icon" style={{ color: c.color }}>
                <CalendarDays size={19} />
              </span>
              <div>
                <strong>{c.name}</strong>
                <CalendarOptions connection={c} onRefresh={onRefresh} />
                {c.lastError && (
                  <small className="sync-error" role="status">
                    {c.lastError}
                  </small>
                )}
              </div>
              {(
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
        <details className="settings-section"><summary>Verbindungen und Tastenkürzel</summary>
          <TodoistSettings onRefresh={onRefresh} />
          <ShortcutSettings preference={shortcutHints.preference} enabled={shortcutHints.enabled} onChange={shortcutHints.configure}/>
          <ReminderSetup />
        </details>
        <details className="settings-section"><summary>Designfarbe</summary>
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
        </details>
        <details className="settings-section"><summary>Kalender importieren</summary>
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
        </details>
        <details className="settings-section"><summary>Datensicherung</summary>
          <a className="secondary-button" href="/api/export" download>
            <Download size={15} />
            Datensicherung herunterladen
          </a>
        </details>
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
