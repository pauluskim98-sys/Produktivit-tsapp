"use client";

import { useRef, useState, type ReactNode } from "react";
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
  const drag = useRef<{ x: number; index: number; left: number; right: number } | null>(null);
  const [preview, setPreview] = useState<NotebookColumn[] | null>(null);
  const pending = useRef<NotebookColumn[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const columns = preview || layout.columns;

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
                {column.id === menu && <div className="notebook-column-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => {
                    setMenu(null);
                    void onRemove(column, columns.filter(item => item.id !== column.id));
                  }}>Spalte löschen</button>
                </div>}
                {index < columns.length - 1 && <div className="notebook-column-divider" tabIndex={0}
                  role="separator" aria-label={`Breite zwischen Spalte ${index + 1} und ${index + 2}`} aria-orientation="vertical"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    const pair = widths(index);
                    if (!pair) return;
                    event.preventDefault();
                    drag.current = { ...pair, x: event.clientX };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (!drag.current) return;
                    pending.current = resize(drag.current, event.clientX - drag.current.x);
                    setPreview(pending.current);
                  }}
                  onPointerCancel={() => { drag.current = null; pending.current = null; setPreview(null); }}
                  onLostPointerCapture={() => {
                    if (pending.current) onChange({ ...layout, columns: pending.current });
                    drag.current = null;
                    pending.current = null;
                    setPreview(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    const pair = widths(index);
                    if (!pair) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onChange({ ...layout, columns: resize(pair, event.key === "ArrowLeft" ? -12 : 12) });
                  }}/>}
              </div>
              {render(column, index)}
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
