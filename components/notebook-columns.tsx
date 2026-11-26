"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import {
  notebookFeatures, type NotebookColumn, type NotebookLayout,
} from "@/lib/notebook-layout";

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const minimumWidth = 48;

export default function NotebookColumns({ layout, onChange, onRemove, onSettings, renderMood, renderLesson, heading, onHeading, onAddRow, onJournal, highlight, render, footer }: {
  layout: NotebookLayout;
  onChange: (layout: NotebookLayout) => void;
  onRemove: (column: NotebookColumn, remaining: NotebookColumn[]) => Promise<void>;
  onSettings: (column: NotebookColumn) => void;
  renderMood?: (column:NotebookColumn,index:number)=>ReactNode;
  renderLesson?: (column:NotebookColumn,index:number)=>ReactNode;
  heading: (column:NotebookColumn)=>string;
  onHeading: (column:NotebookColumn,title:string)=>void;
  onAddRow: (column:NotebookColumn)=>void;
  onJournal?: (index:number)=>void;
  highlight?: number;
  footer: ReactNode;
  render: (column: NotebookColumn, index: number) => ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<AbortController | null>(null);
  const [columnMenu,setColumnMenu]=useState<string|null>(null);
  const [preview, setPreview] = useState<NotebookColumn[] | null>(null);
  const [alignedWidths, setAlignedWidths] = useState<number[] | null>(null);
  const planning = layout.columns[0]?.planning;
  const dayIndexFor = (column: NotebookColumn, index: number) =>
    column.weeklySlot !== undefined ? column.weekday : index - (planning ? 1 : 0);
  const alignWeek = notebookFeatures(layout).weekdays && layout.columns.length === (planning ? 8 : 7) &&
    layout.columns.every((column,index) => column.width === undefined &&
      (planning && index === 0 || dayIndexFor(column,index) === index - (planning ? 1 : 0) && notebookFeatures(layout,column).weekdays));
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
      const widths = planning
        ? [days[0].left-start,...days.map((day,index)=>day.right-(index===0?day.left:days[index-1].right))]
        : days.map((day,index) => day.right - (index === 0 ? start : days[index - 1].right));
      setAlignedWidths(previous => widths.every((width,index) => width >= (planning && index===0 ? 12 : 48))
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
  }, [alignWeek,planning]);
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

  function insertColumn(index: number) {
    const next = [...layout.columns];
    next.splice(index,0,{id:crypto.randomUUID()});
    onChange({...layout,columns:next});
  }

  return (
    <div className="notebook-column-editor note-text-column" data-design={layout.design} style={{ backgroundColor: layout.color || undefined }}>
      <div className="notebook-column-scroll">
        <div className="notebook-column-grid" ref={grid}
          style={{ gridTemplateColumns: columns.map((column,index) => {
            const width = column.width ?? (preview ? undefined : alignedWidths?.[index]);
            return width ? `${width}px` : "minmax(0, 1fr)";
          }).join(" ") }}>
          {!columns.length && <div className="notebook-empty-columns">
            <button className="secondary-button" type="button" onClick={()=>insertColumn(0)}><Plus size={14}/> Spalte hinzufügen</button>
          </div>}
          {columns.map((column, index) => {
            const dayIndex=dayIndexFor(column,index);
            const hasWeekday=dayIndex!==undefined && dayIndex>=0 && dayIndex<7 && notebookFeatures(layout,column).weekdays;
            const title=heading(column);
            return (
            <section key={column.id} className="notebook-column" data-design={column.design}
              data-highlighted={hasWeekday && highlight===dayIndex || undefined} data-week-planning={column.planning || undefined}
              onContextMenu={event=>{
                if((event.target as Element).closest("input,textarea,[contenteditable],button,.notebook-picture"))return;
                event.preventDefault();event.stopPropagation();
                setColumnMenu(column.id);
              }}
              style={{backgroundColor:column.color || undefined}}>
              <div className="notebook-column-head">
                {hasWeekday && <div className="notebook-weekday">{onJournal ? <button type="button" className="notebook-day-name" aria-label={`Tagebuch für ${weekdays[dayIndex]} öffnen`} onClick={()=>onJournal(dayIndex)}>{weekdays[dayIndex]}</button> : <span>{weekdays[dayIndex]}</span>}{renderMood?.(column,dayIndex)}</div>}
                <button className="notebook-add-column" type="button" aria-label={`Spalte vor Spalte ${index + 1} hinzufügen`} title="Spalte hinzufügen"
                  onClick={() => insertColumn(index)}><Plus size={14}/></button>
                <input
                  key={title}
                  className="notebook-column-title"
                  aria-label={`Überschrift für Spalte ${index + 1}`}
                  defaultValue={title}
                  maxLength={120}
                  onBlur={(event) => {
                    const title = event.currentTarget.value.trim();
                    if (title !== heading(column))onHeading(column,title);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.blur();
                    event.currentTarget.closest(".notebook-column")?.querySelector<HTMLElement>(".rich-note-field")?.focus();

                  }}
                />
                <button className="notebook-column-action" type="button" aria-label={`Einstellungen für Spalte ${index + 1}`}
                  onClick={()=>onSettings(column)}><Settings2 size={13}/></button>
                {(layout.nextWeeklySlot !== undefined || columns.length > 1) && <button className="notebook-column-action" type="button" aria-label={`Spalte ${index + 1} löschen`}
                  onClick={()=>void onRemove(column,layout.columns.filter(item=>item.id!==column.id))}><Trash2 size={13}/></button>}
              </div>
              {columnMenu===column.id && <div className="notebook-column-context selection-toolbar" role="menu" onPointerLeave={()=>setColumnMenu(null)}>
                <button type="button" onClick={event=>{event.currentTarget.closest(".notebook-column")?.querySelector<HTMLInputElement>(".notebook-column-title")?.focus();setColumnMenu(null);}}>Überschrift bearbeiten</button>
                {(layout.nextWeeklySlot !== undefined || columns.length > 1) && <button type="button"
                  onClick={()=>{setColumnMenu(null);void onRemove(column,layout.columns.filter(item=>item.id!==column.id));}}>Spalte löschen</button>}
              </div>}
              {render(column, index)}
              {hasWeekday && renderLesson?.(column,dayIndex)}
              <div className="notebook-column-footer">
                <button type="button" title="Zeile hinzufügen" aria-label={`Zeile in Spalte ${index+1} hinzufügen`} onClick={()=>onAddRow(column)}><Plus size={13}/></button>
              </div>
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
          );})}
        </div>
      </div>
      <div className="note-actions notebook-column-actions">{footer}</div>
    </div>
  );
}
