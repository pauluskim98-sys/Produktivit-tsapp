"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  addNotebookColumns, type NotebookColumn, type NotebookLayout,
} from "@/lib/notebook-layout";

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const minimumWidth = 88;

export default function NotebookColumns({ layout, onChange, onRemove, render, footer }: {
  layout: NotebookLayout;
  onChange: (layout: NotebookLayout) => void;
  onRemove: (column: NotebookColumn, remaining: NotebookColumn[]) => Promise<void>;
  footer: ReactNode;
  render: (column: NotebookColumn, index: number) => ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<NotebookColumn[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const columns = preview || layout.columns;
  useEffect(() => () => drag.current?.abort(), []);

  function widths(index: number) {
    const left = grid.current?.children[index]?.getBoundingClientRect().width;
    const right = grid.current?.children[index + 1]?.getBoundingClientRect().width;
    return left && right ? { index, left, right } : null;
  }

  function resize(pair: NonNullable<ReturnType<typeof widths>>, offset: number) {
    const width = Math.max(minimumWidth, Math.min(pair.left + pair.right - minimumWidth, pair.left + offset));
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
    setMenu(null);
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
    <div className="notebook-column-editor note-text-column" data-design={layout.design} style={{ backgroundColor: layout.color || undefined }}
      onPointerDown={(event) => { if (!(event.target as Element).closest(".notebook-column-menu")) setMenu(null); }}
      onKeyDown={(event) => { if (event.key === "Escape") setMenu(null); }}>
      <div className="notebook-column-scroll">
        <div className="notebook-column-grid" ref={grid}
          style={{ gridTemplateColumns: columns.map(column => column.width ? `${column.width}px` : `minmax(${minimumWidth}px, 1fr)`).join(" ") }}>
          {columns.map((column, index) => (
            <section key={column.id} className="notebook-column"
              onContextMenu={(event) => {
                if (columns.length < 2 || (event.target as Element).closest("input,textarea,[contenteditable]")) return;
                event.preventDefault();
                event.stopPropagation();
                setMenu(column.id);
              }}>
              <div className="notebook-column-head">
                {layout.kind === "weekly" && <span>{weekdays[index % 7]}</span>}
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
                {column.id === menu && <div className="notebook-column-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => {
                    setMenu(null);
                    void onRemove(column, columns.filter(item => item.id !== column.id));
                  }}>Spalte löschen</button>
                </div>}
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
      <button className="notebook-add-column" type="button" aria-label="Spalte hinzufügen" title="Spalte hinzufügen"
        onClick={() => onChange({ ...layout, columns: addNotebookColumns(layout.columns, layout.columns.length + 1) })}><Plus size={15}/></button>
      <div className="note-actions notebook-column-actions">{footer}</div>
    </div>
  );
}
