"use client";
import { representedTaskIds } from "@/lib/task-selection";
import { useEffect, useRef, useState, type PointerEvent } from "react";
function toggleSelection(current:string[], clicked:string[]) {
  if(!clicked.length)return [];
  return clicked.every((id)=>current.includes(id)) ? current.filter((id)=>!clicked.includes(id)) : [...new Set([...current,...clicked])];
}
export function useAreaSelection(
  enabled: boolean,
  ids: string[],
  onSelection: (ids: string[], keepMode?: boolean) => void,
) {
  const suppressClick = useRef(false);
  const start = useRef<{
    x: number;
    y: number;
    pointer: number;
    scope: HTMLElement;
    taskIds: string[];
  } | null>(null);
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    const paint = () =>
      document
        .querySelectorAll<HTMLElement>("[data-task-id],[data-task-ids]")
        .forEach((el) =>
          el.classList.toggle(
            "group-selected",
            representedTaskIds(el.dataset.taskId, el.dataset.taskIds).some(
              (id) => ids.includes(id),
            ),
          ),
        );
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-task-id", "data-task-ids"],
    });
    return () => {
      observer.disconnect();
    };
  }, [ids]);
  useEffect(() => {
    if (!enabled) {
      start.current = null;
      setRect(null);
    }
  }, [enabled]);
  const bounds = (x: number, y: number) => ({
    left: Math.min(start.current!.x, x),
    top: Math.min(start.current!.y, y),
    width: Math.abs(start.current!.x - x),
    height: Math.abs(start.current!.y - y),
  });
  return {
    rect,
    bind: {
      onPointerDownCapture: (e: PointerEvent<HTMLDivElement>) => {
        suppressClick.current=false;
        const target = e.target as HTMLElement;
        if(target.closest(".calendar-quick-filters,.note-splitter,.selection-toolbar"))return;
        const noteTask=target.closest<HTMLElement>(".note-todo-row[data-task-id]");
        const notePanel=target.closest<HTMLElement>(".calendar-bottom-notes");
        if (notePanel?.classList.contains("notes-below") && !noteTask &&
            !target.closest("input,textarea,select,[contenteditable],button,a")) return;
        if (
          enabled &&
          !noteTask &&
          (target.closest(
            "input,textarea,select,[contenteditable],.life-tabs",
          ) ||
            (target.closest(".planner-toolbar") &&
              !target.closest(".header-date-preview")))
        ) {
          onSelection([]);
          return;
        }
        if (!enabled && ids.length) {
          const task = target.closest<HTMLElement>(
            "[data-task-id],[data-task-ids]",
          );
          if (task) return;
          onSelection([]);
          if (target.closest(".timeline-scroll,.calendar-overview,.note-todo-board")) {
            suppressClick.current = true;
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
        if (
          !enabled ||
          e.button !== 0 ||
          (target.closest(".planner-toolbar") &&
            !target.closest(".header-date-preview")) ||
          (!noteTask && target.closest(
            "input,textarea,select,[contenteditable],.selection-toolbar,.life-tabs",
          ))
        )
          return;
        const scope =
          target.closest<HTMLElement>(
            '.note-todo-column,.timeline-scroll,[role="dialog"],.sidebar,.period-overview,.calendar-overview',
          ) || notePanel?.querySelector<HTMLElement>(".note-todo-column") || e.currentTarget;
        if (!scope.querySelector("[data-task-id],[data-task-ids]")) {
          onSelection([]);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        suppressClick.current = true;
        const task=target.closest<HTMLElement>("[data-task-id],[data-task-ids]");
        start.current = {
          x: e.clientX,
          y: e.clientY,
          pointer: e.pointerId,
          scope,
          taskIds: task ? representedTaskIds(task.dataset.taskId,task.dataset.taskIds) : [],
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        setRect(bounds(e.clientX, e.clientY));
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        if (start.current) {
          e.stopPropagation();
          setRect(bounds(e.clientX, e.clientY));
        }
      },
      onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
        if (!start.current) return;
        e.preventDefault();
        e.stopPropagation();
        const r = bounds(e.clientX, e.clientY);
        const selected = Array.from(
          start.current.scope.querySelectorAll<HTMLElement>(
            "[data-task-id],[data-task-ids]",
          ),
        )
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.width > 0 &&
              b.height > 0 &&
              el.offsetParent !== null &&
              getComputedStyle(el).visibility !== "hidden" &&
              b.right >= r.left &&
              b.left <= r.left + r.width &&
              b.bottom >= r.top &&
              b.top <= r.top + r.height
            );
          })
          .flatMap((el) =>
            representedTaskIds(el.dataset.taskId, el.dataset.taskIds),
          );
        const clickedIds=start.current.taskIds;
        const keepMode=start.current.scope.classList.contains("note-todo-column");
        start.current = null;
        setRect(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
        onSelection(r.width < 4 && r.height < 4 ? toggleSelection(ids,clickedIds) : [...new Set(selected)], keepMode);
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (
          (e.target as Element).closest(".selection-toolbar,.life-tabs,.calendar-quick-filters,.note-splitter") ||
          ((e.target as Element).closest(".planner-toolbar") &&
            !(e.target as Element).closest(".header-date-preview"))
        )
          return;
        const task=(e.target as Element).closest<HTMLElement>("[data-task-id],[data-task-ids]");
        if (!enabled && !suppressClick.current && ids.length && task && e.detail>0) {
          e.preventDefault();e.stopPropagation();onSelection(toggleSelection(ids,representedTaskIds(task.dataset.taskId,task.dataset.taskIds)));return;
        }
        if (enabled && !suppressClick.current && !task &&
            (e.target as Element).closest(".calendar-bottom-notes input,.calendar-bottom-notes [contenteditable],.note-actions"))return;
        if (enabled || suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
      onPointerCancel: () => {
        start.current = null;
        setRect(null);
      },
    },
  };
}
