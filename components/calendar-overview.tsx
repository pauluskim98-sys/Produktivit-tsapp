"use client";
import { useId } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CalendarEvent, Todo } from "@/lib/types";
import { eventsForDay } from "@/lib/day-assessment";
import { eventPresentation } from "@/lib/subjects";
import { dateKey, parseDate } from "@/lib/dates";
import { periodRange } from "@/lib/calendar-interactions";
const dow = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export function CalendarOverview({
  period,
  todos,
  events,
  connections,
  onPick,
  large = false,
}: {
  period: string;
  todos: Todo[];
  events: CalendarEvent[];
  connections: { id: string; color: string }[];
  onPick: (day: string) => void;
  large?: boolean;
}) {
  const range = periodRange(period);
  if (!range) return null;
  const year = range.kind === "year";
  const monthly = range.kind === "month";
  const months = year
    ? Array.from(
        { length: 12 },
        (_, i) => new Date(Number(range.start.slice(0, 4)), i, 1),
      )
    : monthly
      ? [parseDate(range.start)]
      : [];
  return (
    <div
      className={`calendar-overview ${large ? "calendar-overview-large" : ""} ${year ? "annual-overview" : ""}`}
    >
      {year ? (
        months.map((month) => (
          <MonthGrid
            key={dateKey(month)}
            month={month}
            yearMode
            showTasks={false}
            onPick={onPick}
            todos={todos}
            events={events}
            connections={connections}
          />
        ))
      ) : monthly ? (
        <MonthGrid
          showTasks={large}
          month={months[0]}
          onPick={onPick}
          todos={todos}
          events={events}
          connections={connections}
        />
      ) : (
        <WeekGrid
          showTasks={large}
          days={range.days}
          onPick={onPick}
          todos={todos}
          events={events}
          connections={connections}
        />
      )}
    </div>
  );
}
function MonthGrid({
  month,
  yearMode = false,
  showTasks,
  onPick,
  todos,
  events,
  connections,
}: {
  month: Date;
  yearMode?: boolean;
  showTasks: boolean;
  onPick: (d: string) => void;
  todos: Todo[];
  events: CalendarEvent[];
  connections: { id: string; color: string }[];
}) {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <section className={`mini-month ${yearMode ? "year-month" : ""}`}>
      <h3>
        {month.toLocaleDateString("de-DE", {
          month: "long",
          ...(yearMode ? { year: "numeric" } : {}),
        })}
      </h3>
      {!yearMode && (
        <div className="mini-weekdays">
          {dow.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      )}
      <div className="mini-month-grid">
        {dow.map((d) => (
          <span className="mini-year-weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: (month.getDay() + 6) % 7 }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = dateKey(
            new Date(month.getFullYear(), month.getMonth(), i + 1),
          );
          return (
            <DateCell
              key={day}
              day={day}
              todos={todos}
              events={events}
              connections={connections}
              onPick={onPick}
              compact={yearMode}
              showTasks={showTasks}
            />
          );
        })}
      </div>
    </section>
  );
}
function WeekGrid({
  showTasks,
  days,
  onPick,
  todos,
  events,
  connections,
}: {
  days: string[];
  showTasks: boolean;
  onPick: (d: string) => void;
  todos: Todo[];
  events: CalendarEvent[];
  connections: { id: string; color: string }[];
}) {
  return (
    <section className="mini-month">
      <div className="mini-weekdays">
        {days.map((d) => (
          <span key={d}>
            {new Date(d + "T12:00:00").toLocaleDateString("de-DE", {
              weekday: "short",
              day: "numeric",
            })}
          </span>
        ))}
      </div>
      <div className="mini-week-grid">
        {days.map((day) => (
          <DateCell
            key={day}
            day={day}
            todos={todos}
            events={events}
            connections={connections}
            onPick={onPick}
            compact={false}
            showTasks={showTasks}
          />
        ))}
      </div>
    </section>
  );
}
function DateCell({
  day,
  todos,
  events,
  connections,
  onPick,
  compact,
  showTasks,
}: {
  day: string;
  todos: Todo[];
  events: CalendarEvent[];
  connections: { id: string; color: string }[];
  onPick: (d: string) => void;
  compact: boolean;
  showTasks?: boolean;
}) {
  const scope = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: `period-day:${scope}:${day}`,
    data: { kind: "periodday", day },
  });
  const own = todos.filter((t) => t.plannedDate === day),
    imported = eventsForDay(events, day),
    all = own
      .map((t) => ({
        name: t.title,
        color:
          t.color === "blue"
            ? "#5391c9"
            : t.color === "purple"
              ? "#9772c8"
              : t.color === "orange"
                ? "#d59e42"
                : t.color === "pink"
                  ? "#d86e83"
                  : "#54a478",
        high: t.priority === "high",
      }))
      .concat(
        imported.map((e) => {
          const p = eventPresentation(
            e,
            connections.find((c) => c.id === e.connectionId)?.color,
          );
          return { name: e.title, color: p.color, high: false };
        }),
      );
  const titles = all.map((x) => x.name).join(" · ");
  const hasHigh = all.some((x) => x.high);
  const single = compact;
  return (
    <div
      ref={setNodeRef}
      className={`mini-date ${day === dateKey(new Date()) ? "is-today" : ""} ${isOver ? "mini-date-over" : ""} ${hasHigh ? "has-high" : ""}`}
      onClick={() => onPick(day)}
      data-calendar-date={day}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPick(day);
        }}
        aria-label={`${day}${all.length ? `: ${titles}` : ""}`}
      >
        <span>{Number(day.slice(-2))}</span>
        {all.length > 0 && (
          <i className="mini-dots">
            {single ? (
              <i
                className="mini-dot"
                style={{ background: hasHigh ? "#df5b50" : all[0].color }}
              />
            ) : (
              all.map((x, i) => (
                <i
                  key={i}
                  className="mini-dot"
                  style={{ background: x.color }}
                />
              ))
            )}
          </i>
        )}
      </button>
      {compact && all.length > 0 && (
        <div className="calendar-day-tooltip" role="tooltip">
          {all.map((item, i) => (
            <div key={i}>
              <i style={{ background: item.color }} />
              {item.name}
            </div>
          ))}
        </div>
      )}
      {showTasks && own.length > 0 && (
        <div className="overview-day-tasks">
          {own.slice(0, compact ? 1 : 5).map((task) => (
            <OverviewTask key={task.id} todo={task} />
          ))}
          {own.length > (compact ? 1 : 5) && (
            <small>+{own.length - (compact ? 1 : 5)}</small>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewTask({ todo }: { todo: Todo }) {
  const scope = useId();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `overview:${scope}:${todo.id}`,
    data: { todoId: todo.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`overview-task color-${todo.color || "green"}`}
      style={{ opacity: isDragging ? 0.35 : 1, touchAction: "none" }}
      onClick={(e) => e.stopPropagation()}
      title={todo.title}
    >
      {todo.title}
    </div>
  );
}
