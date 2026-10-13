"use client";
import { applyHistoryDelta } from "./history-delta";
import { rememberViewClose } from "./view-history";
type Command = { undo: () => Promise<void>; redo: () => Promise<void> };
const past: Command[] = [],
  future: Command[] = [];
let running = false;
export function record(command: Command) {
  if (running) return;
  past.push(command);
  if (past.length > 100) past.shift();
  future.length = 0;
  window.dispatchEvent(new Event("raum-history-count"));
}
export async function travel(redo = false) {
  const from = redo ? future : past,
    to = redo ? past : future;
  if (running || !from.length) return;
  running = true;
  try {
    const c = from.at(-1)!;
    await (redo ? c.redo() : c.undo());
    from.pop();
    to.push(c);
    window.dispatchEvent(new Event("raum-data-changed"));
  } catch (e) {
    window.dispatchEvent(
      new CustomEvent("raum-history-error", { detail: (e as Error).message }),
    );
  } finally {
    running = false;
    window.dispatchEvent(new Event("raum-history-count"));
  }
}
export function historySize() {
  return past.length;
}
export function installHistory() {
  const original = window.fetch;
  const layerSelector =
    '[role="dialog"], [role="menu"], [data-escape-layer], details[open]';
  const opened = new WeakMap<Element, number>();
  const openers = new WeakMap<Element, HTMLElement>();
  let sequence = 0;
  const rememberLayers = () =>
    document.querySelectorAll(layerSelector).forEach((el) => {
      if (!opened.has(el)) {
        opened.set(el, ++sequence);
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          active.matches("button,summary") &&
          !el.contains(active)
        )
          openers.set(el, active);
      }
    });
  rememberLayers();
  const layers = new MutationObserver((records) => {
    for (const record of records)
      if (
        record.type === "attributes" &&
        record.target instanceof Element &&
        record.target.matches(layerSelector)
      )
        opened.set(record.target, ++sequence);
    rememberLayers();
  });
  layers.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open", "data-escape-layer"],
  });
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const path = new URL(url, location.href).pathname;
    if (
      running ||
      init?.method !== "POST" ||
      !["/api/life", "/api/notes", "/api/calendar"].includes(path)
    )
      return original(input, init);
    if (path === "/api/calendar") {
      const response = await original(input, init);
      if (response.ok) {
        const data = await response.clone().json();
        if (data.historyToken) {
          const apply = async (redo: boolean) => {
            const r = await original(path, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "history",
                id: data.historyToken,
                redo,
              }),
            });
            if (!r.ok) throw new Error((await r.json()).error);
          };
          record({ undo: () => apply(false), redo: () => apply(true) });
        }
      }
      return response;
    }
    const state = await (
      await original(path === "/api/life" ? path : "/api/state")
    ).json();
    const body = JSON.parse(String(init.body));
    const result = await original(input, init);
    if (result.ok) {
      const after = path === "/api/life" ? await result.clone().json() : body;
      const before =
        path === "/api/life"
          ? state
          : { date: body.date, content: state.dayNotes[body.date] || "" };
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        const apply = async (data: unknown, expected: unknown) => {
          let value = data;
          if (path === "/api/life") {
            const current = await (await original(path)).json();
            value = applyHistoryDelta(current, expected, data);
          } else {
            const current = await (await original("/api/state")).json();
            if (
              (current.dayNotes[body.date] || "") !==
              (expected as { content: string }).content
            )
              throw new Error("Diese Notiz wurde inzwischen geändert.");
          }
          const r = await original(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          });
          if (!r.ok) throw new Error((await r.json()).error);
        };
        record({
          undo: () => apply(before, after),
          redo: () => apply(after, before),
        });
      }
    }
    return result;
  };
  const navigateBack = (e: Event) => {
    const visible = [
      ...document.querySelectorAll<HTMLElement>(layerSelector),
    ].filter(
      (el) =>
        el.offsetParent !== null &&
        getComputedStyle(el).visibility !== "hidden" &&
        (!el.matches("details") ||
          el.closest('[role="dialog"]') ||
          el.matches(".planner-statistics")),
    );
    const modal = visible
      .filter((el) =>
        el.matches('[role="dialog"], [role="menu"], [data-escape-modal]'),
      )
      .sort((a, b) => (opened.get(a) || 0) - (opened.get(b) || 0))
      .at(-1);
    const candidates = modal
      ? visible.filter((el) => el === modal || modal.contains(el))
      : visible;
    const dialog = candidates
      .sort((a, b) => (opened.get(a) || 0) - (opened.get(b) || 0))
      .at(-1);
    if (dialog?.matches("details[open]")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const summary = dialog.querySelector("summary")?.textContent;
      const label = dialog
        .closest('[role="dialog"]')
        ?.getAttribute("aria-label");
      const resolve = () =>
        dialog.isConnected
          ? dialog
          : [...document.querySelectorAll<HTMLDetailsElement>("details")].find(
              (el) =>
                el.querySelector("summary")?.textContent === summary &&
                el.closest('[role="dialog"]')?.getAttribute("aria-label") ===
                  label,
            );
      rememberViewClose(
        () => {
          const el = resolve();
          if (el) (el as HTMLDetailsElement).open = false;
        },
        () => {
          const el = resolve();
          if (el) (el as HTMLDetailsElement).open = true;
        },
      );
      (dialog as HTMLDetailsElement).open = false;
      dialog.querySelector<HTMLElement>("summary")?.focus();
      return;
    }
    const close = dialog?.querySelector<HTMLButtonElement>(
      'button[aria-label*="schließen"], button[aria-label="Inbox einklappen"], button[data-close]',
    );
    if (close) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const opener =
        dialog &&
        !dialog.matches('[role="dialog"], [role="menu"], [data-escape-modal]')
          ? openers.get(dialog)
          : null;
      if (opener?.isConnected)
        rememberViewClose(
          () => {
            if (close.isConnected) close.click();
          },
          () => {
            if (opener.isConnected) opener.click();
          },
        );
      close.click();
      return;
    }
    const back = new CustomEvent("raum-view-back", { cancelable: true });
    window.dispatchEvent(back);
    if (back.defaultPrevented) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
  };
  const navigation = (e: Event) => {
    if ((e as CustomEvent).detail === "back") navigateBack(e);
    else
      window.dispatchEvent(
        new CustomEvent("raum-view-forward", { cancelable: true }),
      );
  };
  const key = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).closest(".shortcut-welcome") &&
      e.key !== "Escape"
    )
      return;
    const editing = (e.target as HTMLElement).closest(
      "input,textarea,select,[contenteditable]",
    );
    if (
      (!editing || (e.key === "Tab" && !e.shiftKey)) &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (e.key === "Tab" ||
        e.key === "^" ||
        (e.key === "Dead" && ["Backquote", "IntlBackslash"].includes(e.code)) ||
        (e.key.toLowerCase() === "a" && e.shiftKey) ||
        ["Delete", "Backspace"].includes(e.key))
    ) {
      const name =
        e.key === "Tab"
          ? "raum-inbox-toggle"
          : e.key === "^" ||
              (e.key === "Dead" &&
                ["Backquote", "IntlBackslash"].includes(e.code))
            ? "raum-view-forward"
            : e.key.toLowerCase() === "a"
              ? "raum-selection-toggle"
              : "raum-selection-delete";
      const action = new CustomEvent(name, { cancelable: true });
      window.dispatchEvent(action);
      if (action.defaultPrevented) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
    if (e.key === "Escape") {
      navigateBack(e);
      return;
    }

    if (!(e.metaKey || e.ctrlKey) || !["z", "y"].includes(e.key.toLowerCase()))
      return;
    if ((e.target as HTMLElement).closest("input,textarea,[contenteditable]")) {
      if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        document.execCommand("redo");
      }
      return;
    }
    if ((e.target as HTMLElement).closest("[data-draft-editor]")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    void travel(e.key.toLowerCase() === "y" || e.shiftKey);
  };
  window.addEventListener("keydown", key, true);
  window.addEventListener("raum-navigation", navigation);
  return () => {
    layers.disconnect();
    window.fetch = original;
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("raum-navigation", navigation);
  };
}
