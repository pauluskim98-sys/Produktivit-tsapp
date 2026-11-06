"use client";
import { useEffect, useRef } from "react";

type Options = {
  inboxOpen?: boolean;
  detailOpen: boolean;
  blocked: boolean;
  setInbox?: (open: boolean) => void;
  navigate: (direction: number) => void;
  openDetail: () => void;
  openPlan?: () => void;
  stepNotes?: (direction:number)=>void;
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
      steps = 0,
      peak = 0;
    let inPanel = false;
    let inNotes = false;
    let edge: "left" | "right" | "bottom" | null = null;
    let origin: { x: number; y: number } | null = null;
    let settleTimer: ReturnType<typeof setTimeout>;
    const isPanel = (node: Element) =>
      Boolean(
        node.closest(
          '.sidebar,.resource-drawer,.detail-backdrop,.modal-backdrop,.compact-detail,[role="dialog"],[role="menu"]',
        ),
      );
    const finish = (offset: number, impulse: number) => {
      const distance = Math.abs(offset);
      if (inNotes) {
        if (!steps && distance >= 36) {
          steps=1;
          current.current.stepNotes?.(offset<0?1:-1);
        }
      } else if (!inPanel) {
        const target = distance >= 720 && impulse >= 195 ? 3
          : distance >= 420 && impulse >= 150 ? 2
          : distance >= 36 ? 1 : 0;
        if (target <= steps) return;
        current.current.navigate((offset < 0 ? 1 : -1) * (target - steps));
        steps = target;
      } else if (!steps && distance >= 160) {
        steps = 1;
        window.dispatchEvent(
          new CustomEvent("raum-navigation", {
            detail: offset > 0 ? "back" : "forward",
            cancelable: true,
          }),
        );
      }
    };
    const wheel = (event: WheelEvent) => {
      // Trackpad scrolling can remain latched to a previously used panel. Route
      // by the pointer's current position, independently of keyboard focus.
      const node =
        document.elementFromPoint(event.clientX, event.clientY) || event.target;
      if (
        !(node instanceof Element) ||
        !node.closest(".app-shell") ||
        node.closest(".weather-hours") ||
        (!current.current.stepNotes && node.closest(".calendar-bottom-notes")) ||
        event.ctrlKey ||
        event.buttons ||
        current.current.blocked ||
        Math.abs(event.deltaX) < 0.5 ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.05
      )
        return;
      event.preventDefault();
      const now = performance.now();
      const overNotes=!!current.current.stepNotes && !!node.closest(".calendar-bottom-notes .note-checklist");
      if (
        !lastWheel ||
        inPanel !== isPanel(node) ||
        inNotes !== overNotes ||
        now - lastWheel > 145
      ) {
        amount = 0;
        steps = 0;
        peak = 0;
        inPanel = isPanel(node);
        inNotes = overNotes;
      }
      lastWheel = now;
      const delta = -event.deltaX *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? window.innerWidth
              : 1);
      if (amount && Math.sign(amount) !== Math.sign(delta) && !steps) {
        amount = 0;
        peak = 0;
      }
      if (!amount || Math.sign(amount) === Math.sign(delta)) {
        amount += delta;
        peak = Math.max(peak, Math.abs(delta));
        finish(amount, peak);
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        amount = 0;
        steps = 0;
        peak = 0;
        lastWheel = 0;
      }, 145);
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1 || current.current.blocked) return;
      const node = event.target;
      const overNotes=node instanceof Element && !!current.current.stepNotes &&
        !!node.closest(".calendar-bottom-notes .note-checklist");
      if (
        !(node instanceof Element) ||
        !node.closest(".app-shell") ||
        (!current.current.stepNotes && node.closest(".calendar-bottom-notes")) ||
        (!overNotes && node.closest(
          "input,textarea,select,[contenteditable],.timed-task,.task-card,.overview-task,.weather-hours",
        ))
      )
        return;
      inPanel = isPanel(node);
      inNotes = overNotes;
      steps = 0;
      origin = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const move = (event: TouchEvent) => {
      if (!origin || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - origin.x,
        dy = event.touches[0].clientY - origin.y;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        event.preventDefault();
        finish(dx, Math.abs(dx));
      }
    };
    const end = (event: TouchEvent) => {
      if (!origin || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - origin.x,
        dy = event.changedTouches[0].clientY - origin.y;
      if (Math.abs(dx) > Math.abs(dy) * 1.35) finish(dx, Math.abs(dx));
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
            : event.clientY >= window.innerHeight - 4
              ? "bottom"
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
      if (modal || (next === "bottom" && current.current.detailOpen)) return;
      if (next === "bottom") {
        current.current.openPlan?.();
        return;
      }
      if (next === "left" && !current.current.inboxOpen)
        current.current.setInbox?.(true);
      if (next === "right" && !current.current.storageOpen)
        current.current.setStorage?.(true);
    };
    const cancel = () => {
      origin = null;
      steps = 0;
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
