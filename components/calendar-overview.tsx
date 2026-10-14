"use client";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { CalendarEvent, Todo } from "@/lib/types";
import { eventsForDay } from "@/lib/day-assessment";
import { eventBlockTitle, eventPresentation } from "@/lib/subjects";
import { dateKey, parseDate } from "@/lib/dates";
import { periodRange } from "@/lib/calendar-interactions";
import PeriodTask from "./period-task";
import { TASK_COLOR_HEX } from "@/lib/task-colors";
import { calendarTitle } from "@/lib/calendar-title";
const dow = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
type Props = {
  period: string;
  todos: Todo[];
  events: CalendarEvent[];
  connections: { id: string; color: string }[];
  onPick: (day: string) => void;
  onNavigatePeriod?: (period: {
    view: "month" | "year" | null;
    anchor: string;
  }) => void;
  large?: boolean;
  onOpen?: (id: string) => void;
  onExtend?: (todo: Todo, days: string[]) => Promise<void>;
  onCreate?: (day: string) => void;
};
export function CalendarOverview(props: Props) {
  const range = periodRange(props.period);
  if (!range) return null;
  const annual = range.kind === "year";
  const months = annual
    ? Array.from(
        { length: 12 },
        (_, i) => new Date(Number(range.start.slice(0, 4)), i, 1),
      )
    : [parseDate(range.start)];
  return (
    <div
      className={`calendar-overview ${props.large ? "calendar-overview-large" : ""} ${annual ? "annual-overview" : ""}`}
    >
      {range.kind === "week" ? (
        <section className="mini-month">
          <div className="mini-weekdays">
            {range.days.map((d) => (
              <span key={d}>
                {parseDate(d).toLocaleDateString("de-DE", { weekday: "short" })}
              </span>
            ))}
          </div>
          <div className="mini-week-grid">
            {range.days.map((d) => (
              <DateCell key={d} day={d} {...props} compact={false} />
            ))}
          </div>
        </section>
      ) : (
        months.map((month) => (
          <section
            key={dateKey(month)}
            className={`mini-month ${annual ? "year-month" : ""}`}
          >
            <h3>
              <button
                className="overview-month-link"
                aria-label={`${month.toLocaleDateString("de-DE", { month: "long" })} öffnen`}
                onClick={() =>
                  props.onNavigatePeriod?.({
                    view: "month",
                    anchor: dateKey(month),
                  })
                }
              >
                {month.toLocaleDateString("de-DE", { month: "long" })}
              </button>
            </h3>
            <div className="mini-month-grid">
              {dow.map((d) => (
                <span className="overview-weekday" key={d}>
                  {d}
                </span>
              ))}
              {Array.from({ length: (month.getDay() + 6) % 7 }, (_, i) => (
                <span key={`blank${i}`} />
              ))}
              {Array.from(
                {
                  length: new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    0,
                  ).getDate(),
                },
                (_, i) => (
                  <DateCell
                    key={i}
                    day={dateKey(
                      new Date(month.getFullYear(), month.getMonth(), i + 1),
                    )}
                    {...props}
                    compact={annual}
                  />
                ),
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
function DateCell({
  day,
  compact,
  ...props
}: Props & { day: string; compact: boolean }) {
  const scope = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: `period-day:${scope}:${day}`,
    data: { kind: "periodday", day },
  });
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const own = props.todos.filter((t) => t.plannedDate === day);
  const all = [
    ...own.map((t) => ({
      id: t.id,
      title: t.title,
      time: t.time,
      color: TASK_COLOR_HEX[t.color || "green"],
      detail: `${t.title}${t.time ? `\n${t.time} · ${t.duration || 60} Min.` : ""}${t.description ? `\n${t.description}` : ""}`,
      todo: t,
      taskIds: [t.id],
    })),
    ...eventsForDay(props.events, day).map((e) => ({
      id: e.id,
      title: e.title,
      detail: `${e.title}\n${e.allDay ? "Ganztägig" : `${new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}${e.location ? `\n${e.location}` : ""}`,
      time: e.allDay
        ? ""
        : new Date(e.start).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      color: eventPresentation(
        e,
        props.connections.find((c) => c.id === e.connectionId)?.color,
      ).color,
      todo: undefined as Todo | undefined,
      taskIds: [] as string[],
    })),
  ].sort(
    (a, b) =>
      (a.time || "00:00").localeCompare(b.time || "00:00") ||
      a.title.localeCompare(b.title),
  );
  const high = own.some((t) => t.priority === "high" && !t.done);
  const monthEntries = Array.from(
    all.reduce((entries, entry) => {
      const key = eventBlockTitle(entry.title).toLocaleLowerCase("de-DE");
      const existing = entries.get(key);
      if (existing) {
        existing.detail += `\n\n${entry.detail}`;
        existing.taskIds = [
          ...new Set([...existing.taskIds, ...entry.taskIds]),
        ];
        if (!existing.todo && entry.todo) {
          existing.todo = entry.todo;
          existing.id = entry.id;
          existing.color = entry.color;
        }
      } else {
        entries.set(key, { ...entry });
      }
      return entries;
    }, new Map<string, (typeof all)[number]>()),
    ([, entry]) => entry,
  );
  return (
    <div
      ref={setNodeRef}
      data-calendar-date={day}
      className={`mini-date ${isOver ? "mini-date-over" : ""} ${high ? "has-high" : ""} ${day === dateKey(new Date()) ? "is-today" : ""}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button")) props.onPick(day);
      }}
      onMouseEnter={(e) => {
        if (!compact || !all.length) return;
        const r = e.currentTarget.getBoundingClientRect();
        setTip({
          x: Math.max(8, Math.min(window.innerWidth - 292, r.left)),
          y: Math.min(window.innerHeight - 210, r.bottom + 5),
        });
      }}
      onMouseLeave={() => setTip(null)}
    >
      <button
        className="calendar-date-button"
        onClick={() => props.onPick(day)}
        aria-label={`${day}${all.length ? `: ${all.map((e) => e.title).join(" · ")}` : ""}`}
        onFocus={(e) => {
          if (compact && all.length) {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({
              x: Math.max(8, Math.min(window.innerWidth - 292, r.left)),
              y: Math.min(window.innerHeight - 210, r.bottom + 5),
            });
          }
        }}
        onBlur={() => setTip(null)}
      >
        <span>{Number(day.slice(-2))}</span>
      </button>
      {(!props.large || compact) && all.length > 0 && (
        <span className="mini-dots">
          {compact ? (
            own.length ? (
              <TaskDot
                tasks={own}
                day={day}
                color={all[0].color}
                onPick={props.onPick}
              />
            ) : (
              <i className="mini-dot" style={{ background: all[0].color }} />
            )
          ) : (
            all.map((e) =>
              e.todo ? (
                <TaskDot
                  key={e.id}
                  tasks={[e.todo]}
                  day={day}
                  color={e.color}
                  onPick={props.onPick}
                />
              ) : (
                <i
                  key={e.id}
                  className="mini-dot"
                  style={{ background: e.color }}
                />
              ),
            )
          )}
        </span>
      )}
      {props.large && !compact && props.onCreate && (
        <button
          type="button"
          className="month-date-add"
          aria-label={`${day}: Termin erstellen`}
          title="Termin an diesem Tag erstellen"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onCreate?.(day);
          }}
        >
          +
        </button>
      )}
      {props.large && !compact && (
        <div className="month-entries">
          {monthEntries.map((e) =>
            e.todo ? (
              <PeriodTask
                key={e.id}
                compact
                abbreviated
                detail={e.detail}
                selectionIds={e.taskIds}
                todo={e.todo}
                onOpen={props.onOpen || (() => {})}
                onExtend={props.onExtend}
              />
            ) : (
              <div
                data-calendar-event={e.id}
                className="month-event"
                key={e.id}
                title={e.detail}
              >
                <i style={{ background: e.color }} />

                <span>{calendarTitle(e.title)}</span>
              </div>
            ),
          )}
        </div>
      )}
      {tip &&
        createPortal(
          <div
            className="year-hover-card"
            role="tooltip"
            style={{ left: tip.x, top: tip.y }}
          >
            <strong>
              {parseDate(day).toLocaleDateString("de-DE", {
                weekday: "short",
                day: "numeric",
                month: "long",
              })}
            </strong>
            {all.map((e) => (
              <div key={e.id}>
                <i style={{ background: e.color }} />
                <time>{e.time}</time>
                <span>{calendarTitle(e.title)}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function TaskDot({
  tasks,
  day,
  color,
  onPick,
}: {
  tasks: Todo[];
  day: string;
  color: string;
  onPick: (day: string) => void;
}) {
  const scope = useId();
  const first = tasks[0];
  const drag = useDraggable({
    id: `calendar-dot:${scope}:${first.id}`,
    data: { todoId: first.id },
  });
  return (
    <button
      ref={drag.setNodeRef}
      {...drag.attributes}
      {...drag.listeners}
      type="button"
      className="calendar-task-dot"
      data-task-id={first.id}
      data-task-ids={JSON.stringify(tasks.map((t) => t.id))}
      aria-label={`${day}: ${tasks.map((t) => t.title).join(" · ")}`}
      title={tasks.map((t) => t.title).join("\n")}
      style={{ touchAction: "none", opacity: drag.isDragging ? 0.4 : 1 }}
      onClick={(event) => {
        event.stopPropagation();
        onPick(day);
      }}
    >
      <i className="mini-dot" style={{ background: color }} />
    </button>
  );
}
