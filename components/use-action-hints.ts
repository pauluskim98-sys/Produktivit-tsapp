"use client";
import { useEffect } from "react";

// Only map actions supported by the actual keyboard/gesture handlers.
function shortcutFor(
  target: Element,
): { element: HTMLElement; text: string } | null {
  const explicit = target.closest<HTMLElement>("[data-shortcut]");
  if (explicit)
    return { element: explicit, text: explicit.dataset.shortcut || "" };
  const rules: [string, string][] = [
    ['[aria-label="Inbox öffnen"],[aria-label="Inbox einklappen"]', "Tab"],
    [".today-button", "T"],
    [".search-field", "⌘ K · Ctrl K"],
    ['[aria-label="Aufgabe löschen"]', "⌫ / Delete · ohne Texteingabe"],
    [
      '[aria-label="Details schließen und speichern"]',
      "Esc · Enter außerhalb der Eingabefelder",
    ],
    ['button[aria-label*="schließen"]', "Esc"],
    ['.quick-add input,.quick-add button[type="submit"]', "Enter"],
    [".side-handle", "Seitlich ziehen → auf weitere Tage kopieren"],
    [".resize-handle", "Ziehen · ↑ / ↓ in 15-Minuten-Schritten"],
    [
      "[data-calendar-task],.task-card[data-task-id],.overview-task[data-task-id],[data-task-id]",
      "A Auswahl · ⌘ C Kopieren · ⌫ Löschen · 1–0 Farbe",
    ],
    [".time-slot", "Gedrückt halten & ziehen → Länge und Tage festlegen"],
    [
      ".timeline-scroll,.calendar-overview-large",
      "Links / rechts wischen → Kalender wechseln",
    ],
  ];
  for (const [selector, text] of rules) {
    const element = target.closest<HTMLElement>(selector);
    if (element) return { element, text };
  }
  return null;
}

export function useActionHints(shortcuts: boolean) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active: HTMLElement | null = null;
    let originalTitle: string | null = null;
    let describedBy: string | null = null;
    let signature = "";
    const tip = document.createElement("div");
    tip.id = "lifemap-action-hint";
    tip.className = "fast-hover-hint";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);
    const hide = () => {
      clearTimeout(timer);
      tip.hidden = true;
      if (active) {
        if (originalTitle !== null) active.setAttribute("title", originalTitle);
        if (describedBy !== null)
          active.setAttribute("aria-describedby", describedBy);
        else active.removeAttribute("aria-describedby");
      }
      active = null;
      signature = "";
    };
    const position = (x: number, y: number) => {
      tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, x + 12))}px`;
      tip.style.top = `${Math.max(8, Math.min(window.innerHeight - tip.offsetHeight - 8, y + 16))}px`;
    };
    const enter = (event: PointerEvent | FocusEvent) => {
      if (
        event instanceof PointerEvent &&
        (event.pointerType !== "mouse" || event.buttons)
      )
        return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".app-shell")) return;
      const shortcut = shortcuts ? shortcutFor(target) : null;
      const titled =
        target.closest<HTMLElement>("[title]") ||
        (active?.contains(target) ? active : null);
      const el = shortcut?.element || titled;
      if (!el) {
        hide();
        return;
      }
      const text =
        titled === active
          ? originalTitle || ""
          : titled?.getAttribute("title") || "";
      const key = shortcut?.text || "";
      const next = `${text}\n${key}`;
      if (active !== el || next !== signature) {
        hide();
        active = el;
        originalTitle = el.getAttribute("title");
        describedBy = el.getAttribute("aria-describedby");
        signature = next;
        // Prevent the browser from displaying a second, slower tooltip.
        el.removeAttribute("title");
        tip.replaceChildren();
        if (text || !key) {
          const label = document.createElement("div");
          label.textContent = text;
          tip.append(label);
        }
        if (key) {
          const row = document.createElement("div");
          row.className = "action-shortcut";
          const badge = document.createElement("kbd");
          badge.textContent = key;
          row.append(badge);
          tip.append(row);
        }
        if (!text && !key) {
          hide();
          return;
        }
        const rect = el.getBoundingClientRect();
        const x = event instanceof PointerEvent ? event.clientX : rect.left;
        const y = event instanceof PointerEvent ? event.clientY : rect.bottom;
        timer = setTimeout(() => {
          if (active !== el || !el.isConnected) return;
          el.setAttribute(
            "aria-describedby",
            [describedBy, tip.id].filter(Boolean).join(" "),
          );
          tip.hidden = false;
          position(x, y);
        }, 70);
      }
    };
    const move = (event: PointerEvent) => {
      if (active && !tip.hidden) position(event.clientX, event.clientY);
    };
    const leave = (event: PointerEvent | FocusEvent) => {
      if (
        active &&
        !(
          event.relatedTarget instanceof Node &&
          active.contains(event.relatedTarget)
        )
      )
        hide();
    };
    window.addEventListener("pointerover", enter, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerout", leave, true);
    window.addEventListener("focusin", enter, true);
    window.addEventListener("focusout", leave, true);
    window.addEventListener("pointerdown", hide, true);
    window.addEventListener("wheel", hide, true);
    window.addEventListener("keydown", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      hide();
      tip.remove();
      window.removeEventListener("pointerover", enter, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerout", leave, true);
      window.removeEventListener("focusin", enter, true);
      window.removeEventListener("focusout", leave, true);
      window.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("wheel", hide, true);
      window.removeEventListener("keydown", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, [shortcuts]);
}
