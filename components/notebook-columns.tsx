"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import {
  notebookFeatures, type NotebookColumn, type NotebookLayout,
} from "@/lib/notebook-layout";

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const minimumWidth = 48;

export default function NotebookColumns({ layout, onChange, onRemove, onSettings, render, footer }: {
  layout: NotebookLayout;
  onChange: (layout: NotebookLayout) => void;
  onRemove: (column: NotebookColumn, remaining: NotebookColumn[]) => Promise<void>;
  onSettings: (column: NotebookColumn) => void;
  footer: ReactNode;
  render: (column: NotebookColumn, index: number) => ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<NotebookColumn[] | null>(null);
  const [alignedWidths, setAlignedWidths] = useState<number[] | null>(null);
  const alignWeek = notebookFeatures(layout).weekdays && layout.columns.length === 7 &&
    layout.columns.every(column => column.width === undefined);
  useEffect(() => {
    const list = grid.current;
    if (!alignWeek || !list) { setAlignedWidths(null); return; }
    const workspace = list.closest(".calendar-workspace");
    if (!workspace) return;
    let watched: Element[] = [];
    const observer = new ResizeObserver(measure);
    function measure() {
      const days = Array.from(workspace!.querySelectorAll(".timeline-head > .timeline-day-head"))
        .map(day => day.getBoundingClientRect()).filter(rect => rect.width > 0);
      if (days.length !== 7) { setAlignedWidths(null); return; }
      const start = list!.getBoundingClientRect().left + (list!.parentElement?.scrollLeft || 0);
      const widths = days.map((day,index) => day.right - (index === 0 ? start : days[index - 1].right));
      setAlignedWidths(previous => widths.every(width => width >= 48)
        ? previous?.every((width,index) => Math.abs(width - widths[index]) < 0.5) ? previous : widths
        : null);
    }
    function watch() {
      const targets = [list!, ...workspace!.querySelectorAll(".timeline-head")];
      if (targets.length !== watched.length || targets.some((target,index) => target !== watched[index])) {
        observer.disconnect();
        targets.forEach(target => observer.observe(target));
        watched = targets;
      }
      measure();
    }
    const mutations = new MutationObserver(watch);
    const main = workspace.querySelector("main");
    if (main) mutations.observe(main, {childList:true,subtree:true});
    watch();
    return () => {observer.disconnect(); mutations.disconnect();};
  }, [alignWeek]);
  const columns = preview || layout.columns;
  useEffect(() => () => drag.current?.abort(), []);

  function widths(index: number) {
    const left = grid.current?.children[index]?.getBoundingClientRect().width;
    const right = grid.current?.children[index + 1]?.getBoundingClientRect().width;
    return left && right ? { index, left, right } : null;
  }

  function resize(pair: NonNullable<ReturnType<typeof widths>>, offset: number) {
    const minimum = Math.min(minimumWidth, (pair.left + pair.right) / 2);
    const width = Math.max(minimum, Math.min(pair.left + pair.right - minimum, pair.left + offset));
    const lastFlexible = layout.columns.findLastIndex(column => column.width === undefined);
    return layout.columns.map((column, index) => {
      if (index === pair.index) return { ...column, width: index === lastFlexible && layout.columns[pair.index + 1].width !== undefined ? undefined : width };
      if (index === pair.index + 1) return { ...column, width: index === lastFlexible ? undefined : pair.left + pair.right - width };
      return column;
    });
  }

  function beginResize(event: ReactPointerEvent<HTMLDivElement>, index: number) {
    if (event.button !== 0) return;
    const pair = widths(index);
    if (!pair) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current?.abort();
    const controller = new AbortController();
    const { pointerId, clientX: start } = event;
    drag.current = controller;
    const options = { signal: controller.signal, capture: true };
    const finish = () => {
      controller.abort();
      drag.current = null;
      setPreview(null);
    };
    window.addEventListener("pointermove", move => {
      if (move.pointerId === pointerId) setPreview(resize(pair, move.clientX - start));
    }, options);
    window.addEventListener("pointerup", up => {
      if (up.pointerId !== pointerId) return;
      if (up.clientX !== start) onChange({ ...layout, columns: resize(pair, up.clientX - start) });
      finish();
    }, options);
    window.addEventListener("pointercancel", cancel => {
      if (cancel.pointerId === pointerId) finish();
    }, options);
    window.addEventListener("blur", finish, options);
  }

  return (
    <div className="notebook-column-editor note-text-column" data-design={layout.design} style={{ backgroundColor: layout.color || undefined }}>
      <div className="notebook-column-scroll">
        <div className="notebook-column-grid" ref={grid}
          style={{ gridTemplateColumns: columns.map((column,index) => {
            const width = column.width ?? (preview ? undefined : alignedWidths?.[index]);
            return width ? `${width}px` : "minmax(0, 1fr)";
          }).join(" ") }}>
          {columns.map((column, index) => (
            <section key={column.id} className="notebook-column" data-design={column.design}
              style={{backgroundColor:column.color || undefined}}>
              <div className="notebook-column-head">
                {notebookFeatures(layout,column).weekdays && <span className="notebook-weekday">{weekdays[index % 7]}</span>}
                <button className="notebook-add-column" type="button" aria-label={`Spalte vor Spalte ${index + 1} hinzufügen`}
                  onClick={() => {
                    const next = [...layout.columns];
                    next.splice(index,0,{id:crypto.randomUUID()});
                    onChange({...layout,columns:next});
                  }}><Plus size={14}/></button>
                <input
                  key={column.title || ""}
                  className="notebook-column-title"
                  aria-label={`Überschrift für Spalte ${index + 1}`}
                  placeholder="Überschrift"
                  defaultValue={column.title || ""}
                  maxLength={120}
                  onBlur={(event) => {
                    const title = event.currentTarget.value.trim();
                    if (title === (column.title || "")) return;
                    onChange({
                      ...layout,
                      columns: layout.columns.map(item => item.id === column.id ? { ...item, title } : item),
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.blur();
                  }}
                />
                <button className="notebook-column-action" type="button" aria-label={`Einstellungen für Spalte ${index + 1}`}
                  onClick={()=>onSettings(column)}><Settings2 size={13}/></button>
                {columns.length > 1 && <button className="notebook-column-action" type="button" aria-label={`Spalte ${index + 1} löschen`}
                  onClick={()=>void onRemove(column,layout.columns.filter(item=>item.id!==column.id))}><Trash2 size={13}/></button>}
              </div>
              {render(column, index)}
              {index < columns.length - 1 && <div className="notebook-column-divider" tabIndex={0}
                  role="separator" aria-label={`Breite zwischen Spalte ${index + 1} und ${index + 2}`} aria-orientation="vertical"
                  onPointerDown={event => beginResize(event, index)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    const pair = widths(index);
                    if (!pair) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onChange({ ...layout, columns: resize(pair, event.key === "ArrowLeft" ? -12 : 12) });
                  }}/>}
            </section>
          ))}
        </div>
      </div>
      <div className="note-actions notebook-column-actions">{footer}</div>
    </div>
  );
}
