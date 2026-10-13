"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
export function useAreaSelection(
  enabled: boolean,
  ids: string[],
  onSelection: (ids: string[]) => void,
) {
  const start = useRef<{
    x: number;
    y: number;
    pointer: number;
    scope: HTMLElement;
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
        .querySelectorAll<HTMLElement>("[data-task-id]")
        .forEach((el) =>
          el.classList.toggle(
            "group-selected",
            ids.includes(el.dataset.taskId!),
          ),
        );
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.body, { childList: true, subtree: true });
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
        const target = e.target as HTMLElement;
        if (
          !enabled ||
          e.button !== 0 ||
          target.closest("input,textarea,select,[contenteditable]")
        )
          return;
        const scope =
          target.closest<HTMLElement>(
            '.timeline-scroll,[role="dialog"],.sidebar,.period-overview,.calendar-overview',
          ) || e.currentTarget;
        if (!scope.querySelector("[data-task-id]")) return;
        e.preventDefault();
        e.stopPropagation();
        start.current = {
          x: e.clientX,
          y: e.clientY,
          pointer: e.pointerId,
          scope,
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
          start.current.scope.querySelectorAll<HTMLElement>("[data-task-id]"),
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
          .map((el) => el.dataset.taskId!);
        start.current = null;
        setRect(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
        onSelection([...new Set(selected)]);
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (enabled) {
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
