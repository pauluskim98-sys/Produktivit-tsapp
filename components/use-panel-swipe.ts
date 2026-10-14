"use client";
import { useEffect, useRef } from "react";

type Options = {
  inboxOpen: boolean;
  detailOpen: boolean;
  blocked: boolean;
  setInbox: (open: boolean) => void;
  navigate: (direction: number) => void;
  openDetail: () => void;
  storageOpen?: boolean;
  setStorage?: (open: boolean) => void;
};

/** Normal gestures turn the calendar; deliberate gestures share keyboard history. */
export function usePanelSwipe(options: Options) {
  const current = useRef(options);
  current.current = options;
  useEffect(() => {
    let amount = 0,
      lastWheel = 0,
      committed = false;
    let inPanel = false;
    let edge: "left" | "right" | null = null;
    let origin: { x: number; y: number } | null = null;
    let settleTimer: ReturnType<typeof setTimeout>;
    const isPanel = (node: Element) =>
      Boolean(
        node.closest(
          '.sidebar,.resource-drawer,.detail-backdrop,.modal-backdrop,.compact-detail,[role="dialog"],[role="menu"]',
        ),
      );
    const finish = (offset: number, final = false) => {
      if (committed) return;
      if (!inPanel && Math.abs(offset) >= 34) {
        committed = true;
        current.current.navigate(offset < 0 ? 1 : -1);
      } else if (inPanel && Math.abs(offset) >= 160) {
        committed = true;
        window.dispatchEvent(
          new CustomEvent("raum-navigation", {
            detail: offset > 0 ? "back" : "forward",
            cancelable: true,
          }),
        );
      } else if (final && !inPanel && Math.abs(offset) >= 25) {
        committed = true;
        current.current.navigate(offset < 0 ? 1 : -1);
      }
    };
    const wheel = (event: WheelEvent) => {
      const node = event.target;
      if (
        !(node instanceof Element) ||
        !node.closest(".app-shell") ||
        event.ctrlKey ||
        current.current.blocked ||
        Math.abs(event.deltaX) < 0.5 ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.15
      )
        return;
      event.preventDefault();
      const now = performance.now();
      if (
        !lastWheel ||
        now - lastWheel > 160 ||
        (amount && Math.sign(amount) === Math.sign(event.deltaX))
      ) {
        amount = 0;
        committed = false;
        inPanel = isPanel(node);
      }
      lastWheel = now;
      if (!committed) {
        amount -=
          event.deltaX *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? window.innerWidth
              : 1);
        finish(amount);
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => finish(amount, true), 80);
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1 || current.current.blocked) return;
      const node = event.target;
      if (
        !(node instanceof Element) ||
        !node.closest(".app-shell") ||
        node.closest(
          "input,textarea,select,[contenteditable],.timed-task,.task-card,.overview-task",
        )
      )
        return;
      inPanel = isPanel(node);
      committed = false;
      origin = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const move = (event: TouchEvent) => {
      if (!origin || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - origin.x,
        dy = event.touches[0].clientY - origin.y;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        event.preventDefault();
        finish(dx);
      }
    };
    const end = (event: TouchEvent) => {
      if (!origin || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - origin.x,
        dy = event.changedTouches[0].clientY - origin.y;
      if (Math.abs(dx) > Math.abs(dy) * 1.35) finish(dx, true);
      origin = null;
    };
    const hover = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        event.buttons ||
        current.current.blocked
      )
        return;
      const next =
        event.clientX <= 3
          ? "left"
          : event.clientX >= window.innerWidth - 4
            ? "right"
            : null;
      if (next === edge) return;
      edge = next;
      if (!next) return;
      // A foreground dialog keeps its own controls accessible at the screen edge.
      const modal = [
        ...document.querySelectorAll<HTMLElement>(
          '[role="dialog"],[role="menu"]',
        ),
      ].some(
        (el) =>
          !el.matches(".compact-detail") &&
          el.offsetParent !== null &&
          getComputedStyle(el).visibility !== "hidden",
      );
      if (modal) return;
      if (next === "left" && !current.current.inboxOpen)
        current.current.setInbox(true);
      if (next === "right" && !current.current.storageOpen)
        current.current.setStorage?.(true);
    };
    const cancel = () => {
      origin = null;
      committed = false;
    };
    window.addEventListener("wheel", wheel, { passive: false, capture: true });
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", cancel);
    window.addEventListener("pointermove", hover);
    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", cancel);
      window.removeEventListener("pointermove", hover);
    };
  }, []);
}
