"use client";
import { useState } from "react";
import ColorPicker from "./task-color-picker";
import type { TaskColor } from "@/lib/task-colors";
import { useDialog } from "./use-dialog";
import type { LifeState } from "@/lib/life";
export default function TabSettings({
  id,
  label,
  life,
  save,
  onClose,
}: {
  id: string;
  label: string;
  life: LifeState;
  save: (s: LifeState) => Promise<boolean>;
  onClose: () => void;
}) {
  const rhythm = life.rhythms.find((r) => r.id === id),
    initial = life.tabSettings[id];
  const [online, setOnline] = useState(
      initial?.online ??
        rhythm?.online ??
        ["food", "events", "sport"].includes(id),
    ),
    [links, setLinks] = useState(
      (initial?.links || rhythm?.links || []).join("\n"),
    ),
    [defaultColor, setDefaultColor] = useState<TaskColor>(
      initial?.defaultColor || "green",
    ),
    [days, setDays] = useState(rhythm?.days || 7),
    [target, setTarget] = useState(rhythm?.target || 1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useDialog(true, `tab:${id}`);
  async function close() {
    setBusy(true);
    try {
      const urls = links.split(/\s+/).filter(Boolean);
      if (urls.some((x) => !/^https:\/\//.test(x))) {
        setError("Bitte vollständige https://-Adressen verwenden.");
        return;
      }
      if (
        await save({
          ...life,
          tabSettings: {
            ...life.tabSettings,
            [id]: { ...initial, online, links: urls, defaultColor },
          },
          rhythms: life.rhythms.map((r) =>
            r.id === id ? { ...r, online, links: urls, days, target } : r,
          ),
        })
      )
        onClose();
      else setError("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="detail-backdrop"
      style={{ zIndex: 130 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void close();
      }}
    >
      <section
        className="tab-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Reitereinstellungen"
      >
        <button
          aria-label="Reitereinstellungen schließen"
          className="icon-button"
          disabled={busy}
          onClick={() => void close()}
        >
          ×
        </button>
        <h3>{label}</h3>
        <button
          className={`online-toggle ${online ? "enabled" : "faded"}`}
          aria-label="Internetrecherche umschalten"
          aria-pressed={online}
          title="Internetrecherche"
          onClick={() => setOnline(!online)}
        >
          🌐
        </button>
        <ColorPicker
          label="Standardfarbe für Aufgaben"
          value={defaultColor}
          onChange={setDefaultColor}
        />
        <label>
          Websites
          <textarea
            aria-label="Websites für den Reiter"
            placeholder="https://…"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
          />
        </label>
        {rhythm && (
          <div className="tab-frequency">
            <label>
              Ziel
              <input
                type="number"
                aria-label="Reiterziel"
                min={0.1}
                step={0.5}
                max={1000}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </label>
            <label>
              Pro Tage
              <input
                type="number"
                aria-label="Reiterzeitraum"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => void close()}
        >
          Speichern
        </button>
      </section>
    </div>
  );
}
