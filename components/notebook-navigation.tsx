"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Folder, PanelLeft, Plus, Search, X } from "lucide-react";
import { readNoteLines } from "./planner-notepad";
import { isNotebookFolder, notebookFolder } from "@/lib/notebook";

type Entry = { key: string; title: string; content: string; folder?: string };
export function notebookTitle(key: string, value: string) {
  if (notebookFolder(key))
    return readNoteLines(value)[0]?.text.trim() || "Unbenannte Notiz";
  const [period, date] = key.includes(":") ? key.split(":") : ["day", key];
  return `${period === "week" ? "Woche" : period === "month" ? "Monat" : "Tag"} · ${date.split("-").reverse().join(".")}`;
}

export default function NotebookNavigation({
  open,
  onToggle,
  values,
  calendarKeys,
  pinned,
  tabs,
  active,
  onOpen,
  onClose,
  onCreate,
  onFolder,
}: {
  open: boolean;
  onToggle: () => void;
  values: Record<string, string>;
  calendarKeys: string[];
  pinned: string;
  tabs: string[];
  active: string;
  onOpen: (key: string) => void;
  onClose: (key: string) => void;
  onCreate: (folder?: string) => void;
  onFolder: (name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [folderDraft, setFolderDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [maps, setMaps] = useState<
    { id: string; title: string; color: string }[]
  >([]);
  const [map, setMap] = useState<string | null>(null);
  const [sizeTab, setSizeTab] = useState<string | null>(null);
  const [size, setSize] = useState(320);
  const resizeStart = useRef<{ y: number; height: number; key: string } | null>(
    null,
  );
  useEffect(() => {
    const reload = () => {
      try {
        setMaps(JSON.parse(localStorage.getItem("notebook-lifemaps") || "[]"));
      } catch {}
    };
    reload();
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, []);
  const typeOf = (key: string) => (key.startsWith("map:") ? "map" : "note");
  const applyHeight = (key: string) => {
    const panel = document.querySelector<HTMLElement>(".calendar-bottom-notes");
    if (!panel) return;
    const saved = Number(
      localStorage.getItem("notepad-height:" + key) ||
        localStorage.getItem("notepad-height:" + typeOf(key)) ||
        localStorage.getItem("notepad-height:all"),
    );
    panel.style.height = saved
      ? Math.min(saved, window.parent.innerHeight * 0.85) + "px"
      : "";
    panel.toggleAttribute("data-custom-height", Boolean(saved));
  };
  useEffect(() => {
    applyHeight(map ? "map:" + map : active);
  }, [active, map]);
  const beginSize = (key: string) => {
    setSizeTab(key);
    setSize(
      document.querySelector(".calendar-bottom-notes")?.getBoundingClientRect()
        .height ?? 320,
    );
  };
  const folders = Object.entries(values)
    .filter(([key, name]) => isNotebookFolder(key) && name)
    .sort((a, b) => a[1].localeCompare(b[1], "de"));
  const calendar = /^(?:(?:week|month):)?\d{4}-\d{2}-\d{2}$/;
  const entries: Entry[] = [
    ...new Set([
      ...calendarKeys,
      ...Object.keys(values).filter(
        (key) => values[key] && (calendar.test(key) || notebookFolder(key)),
      ),
    ]),
  ].map((key) => ({
    key,
    title: notebookTitle(key, values[key] || ""),
    folder: notebookFolder(key),
    content: readNoteLines(values[key] || "")
      .map((line) => line.text)
      .join(" "),
  }));
  const terms = query
    .trim()
    .toLocaleLowerCase("de")
    .split(/\s+/)
    .filter(Boolean);
  const matches = entries.filter((entry) =>
    terms.every((term) =>
      `${entry.title} ${entry.content}`.toLocaleLowerCase("de").includes(term),
    ),
  );
  const entryButton = (entry: Entry) => (
    <button
      key={entry.key}
      type="button"
      className="notebook-entry"
      aria-current={active === entry.key ? "true" : undefined}
      onClick={() => onOpen(entry.key)}
    >
      <FileText size={14} />
      <span>{entry.title}</span>
    </button>
  );
  return (
    <>
      <button
        type="button"
        className="notebook-rail"
        aria-label={open ? "Notizliste schließen" : "Notizliste öffnen"}
        aria-expanded={open}
        onClick={onToggle}
      >
        <PanelLeft size={15} />
      </button>
      {open && (
        <aside className="notebook-sidebar" aria-label="Notizliste">
          <label className="notebook-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Notizen durchsuchen"
              aria-label="Notizinhalte durchsuchen"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="notebook-sidebar-actions">
            <button type="button" onClick={() => onCreate()}>
              <Plus size={14} /> Notiz
            </button>
            <button type="button" onClick={() => setFolderDraft("")}>
              <Folder size={14} /> Ordner
            </button>
          </div>
          {folderDraft !== null && (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!folderDraft.trim() || saving) return;
                setSaving(true);
                setError("");
                try {
                  await onFolder(folderDraft.trim());
                  setFolderDraft(null);
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <input
                autoFocus
                aria-label="Ordnername"
                placeholder="Ordnername"
                maxLength={80}
                value={folderDraft}
                onChange={(event) => setFolderDraft(event.target.value)}
              />
              <button type="submit" disabled={saving}>
                Erstellen
              </button>
              <button
                type="button"
                aria-label="Abbrechen"
                onClick={() => setFolderDraft(null)}
              >
                <X size={14} />
              </button>
            </form>
          )}
          {error && <small role="alert">{error}</small>}
          <div className="notebook-list">
            {terms.length ? (
              matches.length ? (
                matches.map(entryButton)
              ) : (
                <small>Keine passenden Notizen</small>
              )
            ) : (
              <>
                {entries.filter((entry) => !entry.folder).map(entryButton)}
                {entries
                  .filter(
                    (entry) =>
                      entry.folder === "root" ||
                      (entry.folder &&
                        !folders.some(
                          ([key]) => key === `note-folder:${entry.folder}`,
                        )),
                  )
                  .map(entryButton)}
                {folders.map(([key, name]) => (
                  <details open key={key}>
                    <summary>
                      <Folder size={14} />
                      <span>{name}</span>
                    </summary>
                    <button
                      type="button"
                      className="notebook-entry"
                      onClick={() => onCreate(key.slice("note-folder:".length))}
                    >
                      <Plus size={14} /> Notiz im Ordner
                    </button>
                    {entries
                      .filter((entry) => key === `note-folder:${entry.folder}`)
                      .map(entryButton)}
                  </details>
                ))}
              </>
            )}
          </div>
        </aside>
      )}
      <div
        className="notebook-tabs"
        aria-label="Offene Notizen"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-lifemap-tab"))
            e.preventDefault();
        }}
        onDrop={(e) => {
          try {
            const item = JSON.parse(
              e.dataTransfer.getData("application/x-lifemap-tab"),
            );
            if (
              typeof item.title !== "string" ||
              !/^(main|[a-f0-9-]{36})$/.test(item.id)
            )
              return;
            e.preventDefault();
            const next = [
              ...maps.filter((t) => t.id !== item.id),
              {
                id: item.id,
                title: item.title,
                color: /^#[a-f0-9]{6}$/i.test(item.color)
                  ? item.color
                  : "#9360c9",
              },
            ];
            setMaps(next);
            localStorage.setItem("notebook-lifemaps", JSON.stringify(next));
            setMap(item.id);
          } catch {}
        }}
      >
        {tabs.map((key) => (
          <div
            className="notebook-tab"
            key={key}
            data-active={(!map && active === key) || undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              beginSize(key);
            }}
          >
            <button
              type="button"
              aria-current={!map && active === key ? "page" : undefined}
              onClick={() => {
                setMap(null);
                onOpen(key);
              }}
            >
              {notebookTitle(key, values[key] || "")}
            </button>
            {key !== pinned && (
              <button
                type="button"
                aria-label={`${notebookTitle(key, values[key] || "")} schließen`}
                onClick={() => onClose(key)}
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {maps.map((item) => (
          <div
            className="notebook-tab notebook-map-tab"
            style={{ borderColor: item.color, color: item.color }}
            key={item.id}
            data-active={map === item.id || undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              beginSize("map:" + item.id);
            }}
          >
            <button type="button" onClick={() => setMap(item.id)}>
              {item.title}
            </button>
            <button
              type="button"
              aria-label={item.title + " entfernen"}
              onClick={() => {
                const next = maps.filter((m) => m.id !== item.id);
                setMaps(next);
                localStorage.setItem("notebook-lifemaps", JSON.stringify(next));
                if (map === item.id) setMap(null);
              }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="notebook-new-tab"
          aria-label="Neue Notiz"
          onClick={() => onCreate()}
        >
          <Plus size={16} />
        </button>
      </div>
      <button
        className="notepad-size-grip"
        type="button"
        aria-label="Notepad-Höhe ziehen"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const panel = e.currentTarget.closest(".calendar-bottom-notes");
          if (!panel) return;
          resizeStart.current = {
            y: e.screenY,
            height: panel.getBoundingClientRect().height,
            key: map ? "map:" + map : active,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const start = resizeStart.current;
          if (!start || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const panel = document.querySelector<HTMLElement>(
            ".calendar-bottom-notes",
          );
          if (panel) {
            const next = Math.max(
              150,
              Math.min(window.parent.innerHeight * 0.85, start.height + start.y - e.screenY),
            );
            panel.setAttribute("data-custom-height", "");
            panel.style.height = next + "px";
            setSize(next);
          }
        }}
        onPointerUp={(e) => {
          const start = resizeStart.current;
          resizeStart.current = null;
          if (start && Math.abs(e.screenY - start.y) > 2) setSizeTab(start.key);
        }}
        onPointerCancel={() => {
          resizeStart.current = null;
          applyHeight(map ? "map:" + map : active);
        }}
      />
      {sizeTab && (
        <div className="notepad-size-options">
          <span>Notepad-Größe speichern</span>
          {[
            ["Dieser Tab", sizeTab],
            ["Alle dieser Art", typeOf(sizeTab)],
            ["Alle Tabs", "all"],
          ].map(([title, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "all" || key === typeOf(sizeTab))
                  for (const k of Object.keys(localStorage)) {
                    if (
                      k.startsWith("notepad-height:") &&
                      (key === "all" ||
                        (k.startsWith("notepad-height:map:") ===
                          (key === "map") &&
                          ![
                            "notepad-height:all",
                            "notepad-height:note",
                            "notepad-height:map",
                          ].includes(k)))
                    )
                      localStorage.removeItem(k);
                  }
                localStorage.setItem("notepad-height:" + key, String(size));
                applyHeight(sizeTab);
                setSizeTab(null);
              }}
            >
              {title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              applyHeight(map ? "map:" + map : active);
              setSizeTab(null);
            }}
          >
            Abbrechen
          </button>
        </div>
      )}
      {map && (
        <iframe
          className="notebook-map-frame"
          title="LifeMap im Notepad"
          src={"/lifemap/board?notebookEmbed=1&tab=" + encodeURIComponent(map)}
        />
      )}
    </>
  );
}
