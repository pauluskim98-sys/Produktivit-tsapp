"use client";
import { freeTime } from "@/lib/free-time";
import { totalDuration } from "@/lib/schedule";
import { useEffect, useState } from "react";
import { periodRange } from "@/lib/calendar-interactions";
import type { AppState } from "@/lib/types";
import type { LifeState } from "@/lib/life";
import { BarChart3, ChevronDown } from "lucide-react";
export default function Statistics({
  state,
  anchor,
  kind,
}: {
  state: AppState;
  anchor: string;
  kind: string;
}) {
  const [life, setLife] = useState<LifeState | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/life")
        .then((r) => r.json())
        .then(setLife);
    void load();
    window.addEventListener("raum-data-changed", load);
    window.addEventListener("raum-life-changed", load);
    return () => {
      window.removeEventListener("raum-data-changed", load);
      window.removeEventListener("raum-life-changed", load);
    };
  }, []);
  const range = periodRange(`${kind}:${anchor}`)!;
  const time = freeTime(range.days, state.todos, state.events);
  const tasks = state.todos.filter(
    (t) =>
      t.plannedDate &&
      t.plannedDate >= range.start &&
      t.plannedDate <= range.end,
  );
  const done = tasks.filter((t) => t.done).length,
    hours = tasks.reduce((n, t) => n + (t.time ? totalDuration(t) : 0), 0) / 60;
  const buckets = Array.from({ length: 7 }, (_, i) => ({
    name: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i],
    hours:
      tasks
        .filter(
          (t) =>
            (new Date(t.plannedDate! + "T12:00:00").getDay() + 6) % 7 === i,
        )
        .reduce((n, t) => n + (t.time ? totalDuration(t) : 0), 0) / 60,
  }));
  const max = Math.max(1, ...buckets.map((d) => d.hours)),
    meals = (life?.meals || []).filter(
      (m) => m.day >= range.start && m.day <= range.end,
    );
  const meat = new Set(
      meals.filter((m) => m.diet === "meat").map((m) => m.day),
    ),
    veg = new Set(
      meals
        .filter((m) => m.diet === "vegetarian" && !meat.has(m.day))
        .map((m) => m.day),
    );
  return (
    <details className="planner-statistics" aria-label="Statistik">
      <summary>
        <BarChart3 size={18} />
        <h3>Dein Überblick in Zahlen</h3>
        <small>
          {range.start} – {range.end}
        </small>
        <ChevronDown className="statistics-chevron" size={16} />
      </summary>
      <div className="stat-grid">
        <article>
          <small>Erledigt</small>
          <strong>
            {done}
            <span> / {tasks.length}</span>
          </strong>
          <progress value={done} max={Math.max(1, tasks.length)} />
        </article>
        <article>
          <small>Geplante Aufgabenzeit</small>
          <strong>
            {hours.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
            <span> h</span>
          </strong>
        </article>
        <article>
          <small>Freie Zeit</small>
          <strong>
            {time.free.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
            <span> h</span>
          </strong>
          <small>Unverplant · 06–24 Uhr</small>
          <progress value={time.free} max={time.available} />
        </article>
        <article>
          <small>Belegte Zeit inkl. Kalender</small>
          <strong>
            {time.occupied.toLocaleString("de-DE", {
              maximumFractionDigits: 1,
            })}
            <span> h</span>
          </strong>
          <small>Überschneidungen nur einmal</small>
        </article>
        <article>
          <small>Ausgewählte Gerichte</small>
          <strong>{meals.length}</strong>
          <small>
            {meat.size} Tage Fleisch/Fisch · {veg.size} vegetarisch
          </small>
        </article>
      </div>
      <div
        className="statistics-bars"
        role="img"
        aria-label={`Aufgabenstunden nach Wochentag: ${buckets.map((d) => `${d.name} ${d.hours}`).join(", ")}`}
      >
        {buckets.map((d) => (
          <div key={d.name}>
            <small>
              {d.hours.toLocaleString("de-DE", { maximumFractionDigits: 1 })} h
            </small>
            <i style={{ height: `${Math.max(3, (d.hours / max) * 70)}px` }} />
            <span>{d.name}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
