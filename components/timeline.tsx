"use client";
import { TaskPersonAvatar } from "./person-avatar";
import { useEffect, useRef, useState } from "react";
import {
  useDraggable,
  useDroppable,
  useDndContext,
  useDndMonitor,
} from "@dnd-kit/core";
import FitTitle from "./fit-title";
import { Check, GripVertical } from "lucide-react";
import type { Todo, CalendarEvent } from "@/lib/types";
import { eventPresentation, eventBlockTitle } from "@/lib/subjects";
import { dateKey, addDays } from "@/lib/dates";
import {
  creationRange as rawCreationRange,
  MINUTE_HEIGHT,
  gridMinute as rawGridMinute,
  clockMinute as rawClockMinute,
  splitAtSix,
  toMinutes,
  toTime,
  taskSegment,
  layoutIntervals,
  resizeSchedule,
  scheduleAt,
} from "@/lib/schedule";
function gridMinute(minute: number) {
  return minute < 360 ? 1080 : rawGridMinute(minute);
}
function clockMinute(position: number) {
  return position >= 1080 ? 0 : rawClockMinute(position);
}
function creationRange(anchor: number, current: number) {
  const expand = (p: number) => (p >= 1080 ? 1080 + (p - 1080) * 6 : p);
  const compact = (p: number) => (p >= 1080 ? 1080 + (p - 1080) / 6 : p);
  const r = rawCreationRange(expand(anchor), expand(current));
  return { ...r, start: compact(r.start), end: compact(r.end) };
}
const DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];
export interface TimeChange {
  time: string;
  duration: number;
}
interface Props {
  days: Date[];
  mobileDay: string;
  todos: Todo[];
  events: CalendarEvent[];
  colors: Record<string, string>;
  renderUnscheduled: (day: string) => React.ReactNode;
  selected?: string | null;
  selectedIds?: string[];
  selectionMode?: boolean;
  onSelection?: (ids: string[]) => void;
  scale?: number;
  onOpen: (id: string) => void;
  onToggle: (todo: Todo) => void;
  onResize: (todo: Todo, change: TimeChange) => Promise<void>;
  onExtend: (todo: Todo, days: string[]) => Promise<void>;
  onCreate: (
    day: string,
    time: string,
    duration?: number,
    days?: string[],
    drawn?: boolean,
  ) => void;
  onSelectSlot: (day: string, time: string) => void;
  onDayOpen: (day: string) => void;
  targetSlot: { day: string; time: string } | null;
  onEvent: (event: CalendarEvent) => void;
}
export function dragStartMinute(
  active: {
    rect: { current: { translated: { top: number } | null } };
    data: { current?: Record<string, unknown> };
  },
  activatorEvent: Event | null,
  delta: { y: number },
  gridTop: number,
  scale = MINUTE_HEIGHT,
) {
  const y =
    activatorEvent && "clientY" in activatorEvent
      ? Number(activatorEvent.clientY) + delta.y - gridTop
      : (active.rect.current.translated?.top ?? gridTop) - gridTop;
  // Timed blocks keep their grabbed offset; inbox tasks follow the pointer.
  const relative =
    active.data.current?.timed && active.rect.current.translated
      ? active.rect.current.translated.top - gridTop
      : y;
  return clockMinute(
    relative / scale +
      (active.data.current?.timed
        ? Number(active.data.current.travelBefore || 0)
        : 0),
  );
}
function TimedTask({
  todo,
  day,
  start,
  end,
  offset,
  lane,
  lanes,
  onOpen,
  onToggle,
  onResize,
  onExtend,
  scale = MINUTE_HEIGHT,
  selected,
}: {
  scale?: number;
  selected?: string | null;
  todo: Todo;
  day: string;
  start: number;
  end: number;
  offset: number;
  lane: number;
  lanes: number;
  onOpen: Props["onOpen"];
  onToggle: Props["onToggle"];
  onResize: Props["onResize"];
  onExtend: Props["onExtend"];
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `scheduled:${todo.id}:${day}:${start < 360 ? "early" : "day"}`,
    data: {
      todoId: todo.id,
      timed: true,
      travelBefore: todo.travelBefore || 0,
    },
    disabled: offset !== 0,
  });
  const [preview, setPreview] = useState<TimeChange | null>(null),
    [saving, setSaving] = useState(false);
  const gesture = useRef<{
    edge: "start" | "end";
    y: number;
    scroll: number;
    scroller: HTMLElement | null;
    next: TimeChange;
  } | null>(null);
  const [extension, setExtension] = useState(0);
  const side = useRef<{
    x: number;
    day: string;
    left: number;
    right: number;
  } | null>(null);
  function sideHandle(edge: "left" | "right") {
    return (
      <button
        type="button"
        className={`side-handle side-${edge}`}
        aria-label={`${todo.title} nach ${edge === "left" ? "links" : "rechts"} auf weitere Tage erweitern`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const bounds = e.currentTarget
            .closest("article")!
            .getBoundingClientRect();
          side.current = {
            x: e.clientX,
            day,
            left: bounds.left,
            right: bounds.right,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!side.current) return;
          const cols = Array.from(
            document.querySelectorAll<HTMLElement>("[data-day-grid]"),
          );
          const col = cols.find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && e.clientX >= r.left && e.clientX < r.right;
          });
          if (col) {
            side.current.day = col.dataset.dayGrid!;
            const r = col.getBoundingClientRect();
            const own = side.current;
            setExtension(
              edge === "right"
                ? Math.max(0, r.right - own.right)
                : Math.min(0, r.left - own.left),
            );
          }
        }}
        onPointerUp={(e) => {
          const g = side.current;
          side.current = null;
          setExtension(0);
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (!g || Math.abs(e.clientX - g.x) < 5) return;
          const keys = Array.from(
            document.querySelectorAll<HTMLElement>("[data-day-grid]"),
          )
            .map((el) => el.dataset.dayGrid!)
            .filter(
              (d) =>
                d !== day &&
                (edge === "right"
                  ? d > day && d <= g.day
                  : d < day && d >= g.day),
            );
          if (keys.length) void onExtend(todo, keys);
        }}
        onPointerCancel={() => {
          side.current = null;
          setExtension(0);
        }}
        onLostPointerCapture={() => {
          side.current = null;
          setExtension(0);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  const shown = { ...todo, ...preview };
  const segment = taskSegment(shown, day)!;
  const early = start < 360;
  const displayedStart = Math.max(early ? 0 : 360, segment?.start ?? start),
    displayedEnd = Math.min(early ? 360 : 1440, segment?.end ?? end);
  const mainStart = toMinutes(shown.time) - segment.offset,
    mainEnd = mainStart + (shown.duration || 60);
  const length = Math.max(1, displayedEnd - displayedStart);
  const before =
    (Math.max(0, Math.min(displayedEnd, mainStart) - displayedStart) / length) *
    100;
  const after =
    (Math.max(0, displayedEnd - Math.max(displayedStart, mainEnd)) / length) *
    100;
  const originalStart = toMinutes(todo.time),
    originalEnd = originalStart + (todo.duration || 60);
  const endText =
    toTime(originalEnd % 1440) +
    (originalEnd >= 1440 ? ` +${Math.floor(originalEnd / 1440)} Tag(e)` : "");
  function begin(
    e: React.PointerEvent<HTMLButtonElement>,
    edge: "start" | "end",
  ) {
    e.stopPropagation();
    e.preventDefault();
    if (saving) return;
    const scroller = e.currentTarget.closest(
      ".timeline-scroll",
    ) as HTMLElement | null;
    gesture.current = {
      edge,
      y: e.clientY,
      scroll: scroller?.scrollTop || 0,
      scroller,
      next: { time: todo.time, duration: todo.duration || 60 },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g) return;
    const bounds = g.scroller?.getBoundingClientRect();
    if (bounds && g.scroller) {
      if (e.clientY > bounds.bottom - 28) g.scroller.scrollTop += 12;
      else if (e.clientY < bounds.top + 100) g.scroller.scrollTop -= 12;
    }
    g.next = resizeSchedule(
      todo.time,
      todo.duration || 60,
      g.edge,
      (e.clientY - g.y + (g.scroller?.scrollTop || 0) - g.scroll) / scale,
      offset,
    );
    setPreview(g.next);
  }
  async function commit(change: TimeChange) {
    setSaving(true);
    try {
      await onResize(todo, change);
    } finally {
      setSaving(false);
      setPreview(null);
    }
  }
  function finish(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (g.next.time !== todo.time || g.next.duration !== (todo.duration || 60))
      void commit(g.next);
    else setPreview(null);
  }
  function handle(edge: "start" | "end") {
    return (
      <button
        type="button"
        style={
          edge === "start" ? { top: `${before}%` } : { bottom: `${after}%` }
        }
        className={`resize-handle resize-${edge}`}
        aria-label={`${edge === "start" ? "Beginn" : "Ende"} von ${todo.title} ändern`}
        title="Ziehen oder Pfeiltasten: 15-Minuten-Schritte"
        disabled={saving}
        onPointerDown={(e) => begin(e, edge)}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          gesture.current = null;
          setPreview(null);
        }}
        onLostPointerCapture={() => {
          if (gesture.current) {
            gesture.current = null;
            setPreview(null);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            void commit(
              resizeSchedule(
                todo.time,
                todo.duration || 60,
                edge,
                e.key === "ArrowDown" ? 15 : -15,
                offset,
              ),
            );
          }
        }}
      >
        <span />
      </button>
    );
  }
  return (
    <article
      ref={setNodeRef}
      className={`timed-task ${todo.priority === "high" ? "priority-high" : ""} ${selected === todo.id ? "is-selected" : ""} color-${todo.color || "green"} ${todo.done ? "is-done" : ""} ${preview ? "is-resizing" : ""} ${saving ? "is-saving" : ""}`}
      style={{
        top: gridMinute(displayedStart) * scale,
        height: Math.max(8, (displayedEnd - displayedStart) * scale),
        left: `calc(${(lane / lanes) * 100}% + 2px + ${Math.min(0, extension)}px)`,
        width: `calc(${100 / lanes}% - 5px + ${Math.abs(extension)}px)`,
        zIndex: extension ? 20 : undefined,
        opacity: isDragging ? 0.25 : 1,
      }}
      data-task-id={todo.id}
      title={`${todo.title}\n${todo.time}–${endText}\n${todo.duration || 60} Minuten · Wegzeit ${(todo.travelBefore || 0) + (todo.travelAfter || 0)} Min. · Gesamt ${(todo.duration || 60) + (todo.travelBefore || 0) + (todo.travelAfter || 0)} Min.`}
    >
      {before > 0 && (
        <button
          className="travel-part travel-before"
          style={{ height: `${before}%` }}
          onClick={() => onOpen(todo.id)}
          title={`Hinweg · ${todo.travelBefore} Min.`}
        >
          Hinweg
        </button>
      )}
      {after > 0 && (
        <button
          className="travel-part travel-after"
          style={{ height: `${after}%` }}
          onClick={() => onOpen(todo.id)}
          title={`Rückweg · ${todo.travelAfter} Min.`}
        >
          Rückweg
        </button>
      )}
      {!segment?.continuesBefore &&
        displayedStart === (segment?.start ?? start) &&
        handle("start")}
      <button
        className="timed-check"
        style={{ top: `calc(${before}% + 5px)` }}
        aria-label={`${todo.title} ${todo.done ? "wieder öffnen" : "erledigen"}`}
        onClick={() => onToggle(todo)}
      >
        {todo.done ? <Check size={10} /> : null}
      </button>
      <button
        data-calendar-task={todo.id}
        className="timed-main"
        style={{ top: `${before}%`, bottom: `${after}%` }}
        {...attributes}
        {...listeners}
        onClick={() => onOpen(todo.id)}
        aria-label={`${todo.title}, ${shown.time}, ${shown.duration || 60} Minuten`}
      >
        <TaskPersonAvatar todo={todo} small />
        <FitTitle>
          {segment?.continuesBefore ? "↳ " : ""}
          {todo.title}
        </FitTitle>
      </button>
      {!segment?.continuesAfter &&
        displayedEnd === (segment?.end ?? end) &&
        handle("end")}
      {offset === 0 && (
        <>
          {sideHandle("left")}
          {sideHandle("right")}
        </>
      )}
      {preview && (
        <span className="resize-label">
          {shown.time} · {shown.duration} Min.
        </span>
      )}
    </article>
  );
}
function TimeColumn({
  day,
  todos,
  events,
  colors,
  onCreate,
  onOpen,
  onToggle,
  onResize,
  onExtend,
  onEvent,
  onSelectSlot,
  targetSlot,
  scale = MINUTE_HEIGHT,
  selected,
  selectedIds,
}: Omit<Props, "days" | "mobileDay" | "renderUnscheduled"> & { day: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timegrid:${day}`,
    data: { kind: "timegrid", day },
  });
  const grid = useRef<HTMLDivElement | null>(null);
  const { active, activatorEvent } = useDndContext();
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  useDndMonitor({
    onDragMove: (e) => setDelta(e.delta),
    onDragEnd: () => setDelta({ x: 0, y: 0 }),
  });
  const items: {
    id: string;
    start: number;
    end: number;
    todo?: Todo;
    event?: CalendarEvent;
    offset?: number;
  }[] = [];
  for (const todo of todos) {
    const seg = taskSegment(todo, day);
    if (seg)
      for (const part of splitAtSix(seg.start, seg.end).filter(
        (p) => p.start >= 360,
      ))
        items.push({ id: `${todo.id}:${part.start}`, ...seg, ...part, todo });
  }
  const midnight = new Date(`${day}T00:00:00`),
    nextMidnight = new Date(midnight);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  for (const event of events) {
    if (event.allDay) continue;
    const start = new Date(event.start),
      end = new Date(event.end);
    if (start >= nextMidnight || end <= midnight) continue;
    items.push({
      id: event.id,
      start: start < midnight ? 0 : start.getHours() * 60 + start.getMinutes(),
      end: end >= nextMidnight ? 1440 : end.getHours() * 60 + end.getMinutes(),
      event,
    });
  }
  const layout = layoutIntervals(
    items.flatMap((item) =>
      item.event
        ? splitAtSix(item.start, item.end)
            .filter((p) => p.start >= 360)
            .map((part) => ({
              ...item,
              ...part,
              id: `${item.id}:${part.start}`,
            }))
        : [item],
    ),
  );
  const hover =
    isOver && active && grid.current
      ? scheduleAt(
          dragStartMinute(
            active,
            activatorEvent,
            delta,
            grid.current.getBoundingClientRect().top,
            scale,
          ),
        ).time
      : null;
  const now = new Date(),
    currentMinute = now.getHours() * 60 + now.getMinutes();
  return (
    <div
      className="time-column"
      data-day-grid={day}
      data-minute-height={scale}
      ref={(el) => {
        grid.current = el;
        setNodeRef(el);
      }}
      style={{ height: 1140 * scale }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button,article")) return;
        const minutes =
          (e.clientY - e.currentTarget.getBoundingClientRect().top) / scale;
        onCreate(day, scheduleAt(clockMinute(minutes)).time);
      }}
    >
      {Array.from({ length: 18 }, (_, i) => {
        const hour = (i + 6) % 24;
        return (
          <button
            key={hour}
            className="time-slot"
            style={{ top: gridMinute(hour * 60) * scale, height: 60 * scale }}
            tabIndex={-1}
            aria-label={`Aufgabe am ${day} um ${toTime(hour * 60)} erstellen`}
            onClick={(e) => {
              const minutes =
                (e.clientY -
                  e.currentTarget.parentElement!.getBoundingClientRect().top) /
                scale;
              onCreate(day, scheduleAt(clockMinute(minutes)).time, 60);
            }}
            onDoubleClick={(e) => {
              const minutes =
                (e.clientY -
                  e.currentTarget.parentElement!.getBoundingClientRect().top) /
                scale;
              onCreate(day, scheduleAt(clockMinute(minutes)).time);
            }}
          />
        );
      })}
      <div
        className="night-strip"
        style={{ top: 1080 * scale, height: 60 * scale }}
      >
        <button
          className="night-create"
          aria-label={`Aufgabe am ${day} in der Nacht erstellen`}
          onClick={() => onCreate(day, "00:00", 360)}
        />
        {todos
          .filter((t) => {
            const seg = taskSegment(t, day);
            return seg && seg.start < 360;
          })
          .map((t) => (
            <button
              key={t.id}
              data-calendar-task={t.id}
              className={`night-task color-${t.color || "green"} ${t.priority === "high" ? "priority-high" : ""}`}
              onClick={() => onOpen(t.id)}
              title={`${t.time} · ${t.title}`}
            >
              <TaskPersonAvatar todo={t} small />
              {t.title}
            </button>
          ))}
        {events
          .filter(
            (e) =>
              !e.allDay &&
              new Date(e.start) < new Date(`${day}T06:00:00`) &&
              new Date(e.end) > midnight,
          )
          .map((e) => (
            <button
              className="night-task"
              key={e.id}
              data-calendar-event={e.id}
              onClick={() => onEvent(e)}
              title={`${e.title}\n${new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}\n${e.location}`}
            >
              {e.title}
            </button>
          ))}
      </div>
      {layout.map((item) =>
        item.todo ? (
          <TimedTask
            key={item.id}
            todo={item.todo}
            day={day}
            start={item.start}
            end={item.end}
            offset={item.offset || 0}
            lane={item.lane}
            lanes={item.lanes}
            onOpen={onOpen}
            onToggle={onToggle}
            onResize={onResize}
            onExtend={onExtend}
            scale={scale}
            selected={
              selectedIds?.includes(item.todo.id) ? item.todo.id : selected
            }
          />
        ) : (
          <button
            key={item.id}
            data-calendar-event={item.event!.id}
            className="timed-event"
            style={{
              top: gridMinute(item.start) * scale,
              height: Math.max(18, (item.end - item.start) * scale),
              left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
              width: `calc(${100 / item.lanes}% - 5px)`,
              borderLeftColor: eventPresentation(
                item.event!,
                colors[item.event!.connectionId],
              ).color,
              backgroundColor: `color-mix(in srgb, ${eventPresentation(item.event!, colors[item.event!.connectionId]).color} 16%, var(--surface))`,
            }}
            onClick={() => onEvent(item.event!)}
            title={`${item.event!.title}\n${new Date(item.event!.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${new Date(item.event!.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}\n${item.event!.location}`}
          >
            <FitTitle>{eventBlockTitle(item.event!.title)}</FitTitle>
          </button>
        ),
      )}
      {hover && (
        <div
          className="time-drop-preview"
          style={{ top: gridMinute(toMinutes(hover)) * scale }}
        >
          {hover}
        </div>
      )}
      {dateKey(now) === day && (
        <div
          className="now-line"
          style={{ top: gridMinute(currentMinute) * scale }}
        >
          <i />
        </div>
      )}
    </div>
  );
}
export default function Timeline(props: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const selectGesture = useRef<{
    x: number;
    y: number;
    pointer: number;
  } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const updateSelection = (x: number, y: number) => {
    const g = selectGesture.current;
    if (!g) return;
    setSelectionRect({
      left: Math.min(x, g.x),
      top: Math.min(y, g.y),
      width: Math.abs(x - g.x),
      height: Math.abs(y - g.y),
    });
  };

  type Draw = {
    pointer: number;
    x: number;
    y: number;
    anchor: number;
    day: string;
    endDay: string;
    current: number;
    moved: boolean;
  };
  const drawing = useRef<Draw | null>(null);
  const [draft, setDraft] = useState<Draw | null>(null);
  const suppressClick = useRef(false);
  const cancelDraw = () => {
    drawing.current = null;
    setDraft(null);
  };
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", cancelDraw);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", cancelDraw);
    };
  }, []);
  const updateDraw = (x: number, y: number) => {
    const d = drawing.current;
    if (!d || !scroll.current) return;
    const columns = Array.from(
      scroll.current.querySelectorAll<HTMLElement>("[data-day-grid]"),
    ).filter((el) => el.getBoundingClientRect().width > 0);
    const column =
      columns.find((el) => {
        const r = el.getBoundingClientRect();
        return x >= r.left && x < r.right;
      }) ||
      (x < (columns[0]?.getBoundingClientRect().left ?? 0)
        ? columns[0]
        : columns.at(-1));
    if (!column) return;
    const moved = d.moved || Math.hypot(x - d.x, y - d.y) >= 5;
    drawing.current = {
      ...d,
      endDay: column.dataset.dayGrid!,
      current: Math.max(
        0,
        Math.min(1140, (y - column.getBoundingClientRect().top) / scale),
      ),
      moved,
    };
    setDraft(moved ? drawing.current : null);
  };
  const [tick, setTick] = useState(0);
  const [scale, setScale] = useState(MINUTE_HEIGHT);
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const resize = () => {
      const head =
        el.querySelector(".timeline-head")?.getBoundingClientRect().height ||
        90;
      setScale(Math.max(0.25, (el.clientHeight - head - 14) / 1140));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const head = el.querySelector(".timeline-head");
    if (head) observer.observe(head);
    resize();
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);
  return (
    <div
      className={`timeline-scroll ${props.selectionMode ? "selection-mode" : ""}`}
      ref={scroll}
      aria-label="Wochenkalender mit Stundenraster"
      data-clock-tick={tick}
      onPointerDownCapture={(e) => {
        if (e.pointerType === "touch") return;
        if (
          props.selectionMode &&
          e.button === 0 &&
          (e.target as HTMLElement).closest(".timeline-body")
        ) {
          e.preventDefault();
          e.stopPropagation();
          selectGesture.current = {
            x: e.clientX,
            y: e.clientY,
            pointer: e.pointerId,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          updateSelection(e.clientX, e.clientY);
          return;
        }
        if (e.button !== 0 || !(e.target as HTMLElement).closest(".time-slot"))
          return;
        const column = (e.target as HTMLElement).closest<HTMLElement>(
          "[data-day-grid]",
        )!;
        const anchor = (e.clientY - column.getBoundingClientRect().top) / scale;
        suppressClick.current = false;
        drawing.current = {
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          anchor,
          current: anchor,
          day: column.dataset.dayGrid!,
          endDay: column.dataset.dayGrid!,
          moved: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (selectGesture.current) {
          updateSelection(e.clientX, e.clientY);
          return;
        }
        if (drawing.current?.pointer !== e.pointerId) return;
        updateDraw(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (selectGesture.current) {
          const g = selectGesture.current;
          const left = Math.min(g.x, e.clientX),
            right = Math.max(g.x, e.clientX),
            top = Math.min(g.y, e.clientY),
            bottom = Math.max(g.y, e.clientY);
          const ids = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>("[data-task-id]"),
          )
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.right >= left &&
                r.left <= right &&
                r.bottom >= top &&
                r.top <= bottom
              );
            })
            .map((el) => el.dataset.taskId!);
          selectGesture.current = null;
          setSelectionRect(null);
          suppressClick.current = true;
          e.currentTarget.releasePointerCapture(e.pointerId);
          props.onSelection?.([...new Set(ids)]);
          return;
        }
        const d = drawing.current;
        if (!d || d.pointer !== e.pointerId) return;
        updateDraw(e.clientX, e.clientY);
        const final = drawing.current!;
        cancelDraw();
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        if (final.moved) {
          suppressClick.current = true;
          const range = creationRange(final.anchor, final.current);
          const days = props.days
            .map(dateKey)
            .filter(
              (day) =>
                day >= [final.day, final.endDay].sort()[0] &&
                day <= [final.day, final.endDay].sort()[1],
            );
          props.onCreate(days[0], range.time, range.duration, days, true);
        } else {
          // Pointer capture targets the container on release, so handle taps here.
          suppressClick.current = true;
          props.onCreate(d.day, scheduleAt(clockMinute(d.anchor)).time, 60);
        }
      }}
      onPointerCancel={() => {
        cancelDraw();
        selectGesture.current = null;
        setSelectionRect(null);
      }}
      onLostPointerCapture={() => {
        cancelDraw();
        selectGesture.current = null;
        setSelectionRect(null);
      }}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={{ "--hour-height": `${scale * 60}px` } as React.CSSProperties}
    >
      {selectionRect && (
        <div className="selection-rectangle" style={selectionRect} />
      )}
      <div className="timeline-head">
        <div className="timeline-gutter-head">
          <span aria-hidden="true" />
        </div>
        {props.days.map((date, i) => {
          const day = dateKey(date);
          return (
            <section
              key={day}
              className={`timeline-day-head ${day === props.mobileDay ? "mobile-active" : ""} ${day === dateKey(new Date()) ? "is-today" : ""}`}
            >
              <button
                type="button"
                className="timeline-date"
                onClick={() => props.onDayOpen(day)}
                aria-label={`${DAYS[i]}, ${day} öffnen`}
              >
                <span>{DAYS[i]}</span>
                {day === dateKey(new Date()) && <em>Heute</em>}
                <b>{date.getDate()}</b>
              </button>
              <div className="unscheduled-tasks">
                {props.renderUnscheduled(day)}
              </div>
            </section>
          );
        })}
      </div>
      <div className="timeline-body">
        <div className="time-axis" style={{ height: 1140 * scale }}>
          {Array.from({ length: 19 }, (_, i) => {
            const h = (i + 6) % 24;
            return (
              <span key={i} style={{ top: i * 60 * scale }}>
                {i === 18 ? "Nacht" : toTime(h * 60)}
              </span>
            );
          })}
        </div>
        {props.days.map((date) => {
          const day = dateKey(date);
          return (
            <div
              className={`timeline-day ${day === props.mobileDay ? "mobile-active" : ""} ${day === dateKey(new Date()) ? "is-today" : ""}`}
              key={day}
            >
              <TimeColumn {...props} day={day} scale={scale} />
              {draft &&
                day >= [draft.day, draft.endDay].sort()[0] &&
                day <= [draft.day, draft.endDay].sort()[1] &&
                (() => {
                  const range = creationRange(draft.anchor, draft.current);
                  return (
                    <div
                      className="creation-preview"
                      style={{
                        top: range.start * scale,
                        height: Math.max(8, range.duration * scale),
                      }}
                    >
                      <span>
                        {range.time} –{" "}
                        {toTime(
                          (toMinutes(range.time) + range.duration) % 1440,
                        )}
                      </span>
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
