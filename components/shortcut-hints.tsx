"use client";
import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useDialog } from "./use-dialog";
import { record } from "@/lib/client-history";
import {
  SHORTCUT_HINT_KEY,
  readShortcutPreference,
  shortcutPreference,
  shortcutsActive,
  type ShortcutPreference,
} from "@/lib/shortcut-hints";

export function useShortcutPreferences() {
  const [preference, setPreference] = useState<ShortcutPreference | null>(null);
  const [firstUse, setFirstUse] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let stored: ShortcutPreference | null = null;
    try {
      stored = readShortcutPreference(localStorage.getItem(SHORTCUT_HINT_KEY));
    } catch {}
    setPreference(stored);
    setFirstUse(!stored);
  }, []);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 30000);
    const untilExpiry = preference?.expiresAt
      ? preference.expiresAt - Date.now()
      : 0;
    const expiry =
      untilExpiry > 0
        ? setTimeout(refresh, Math.min(untilExpiry, 2147483647))
        : undefined;
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      clearTimeout(expiry);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [preference]);
  const apply = (value: ShortcutPreference) => {
    setPreference(value);
    setNow(Date.now());
    setFirstUse(false);
    try {
      localStorage.setItem(SHORTCUT_HINT_KEY, JSON.stringify(value));
    } catch {}
  };
  const configure = (enabled: boolean, days: number) => {
    const next = shortcutPreference(enabled, days);
    const previous = preference;
    apply(next);
    if (previous)
      record({
        undo: async () => apply(previous),
        redo: async () => apply(next),
      });
  };
  return {
    preference,
    firstUse,
    configure,
    enabled: shortcutsActive(preference, now),
  };
}

function Duration({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) {
  const [input, setInput] = useState(String(days));
  useEffect(() => setInput(String(days)), [days]);
  const commit = () => {
    const n = Math.max(1, Math.min(365, Math.round(Number(input)) || days));
    setInput(String(n));
    if (n !== days) onChange(n);
  };
  return (
    <div className="shortcut-duration">
      <label>
        Hinweise anzeigen für{" "}
        <input
          aria-label="Dauer der Shortcut-Hinweise in Tagen"
          type="number"
          min={1}
          max={365}
          step={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />{" "}
        Tage
      </label>
      <div className="shortcut-presets">
        {[3, 7, 14, 30].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={days === n}
            onClick={() => onChange(n)}
          >
            {n} Tage
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShortcutWelcome({
  onChoose,
}: {
  onChoose: (enabled: boolean, days: number) => void;
}) {
  const [days, setDays] = useState(7);
  useDialog(true, "shortcut-welcome");
  return (
    <div
      className="modal-backdrop shortcut-welcome-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onChoose(false, days);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-welcome-title"
        className="modal shortcut-welcome"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onChoose(false, days);
          }
          e.stopPropagation();
        }}
      >
        <button
          className="icon-button shortcut-welcome-close"
          aria-label="Shortcut-Abfrage schließen"
          onClick={() => onChoose(false, days)}
        >
          <X size={18} />
        </button>
        <div className="shortcut-welcome-icon">
          <Keyboard size={25} strokeWidth={1.5} />
        </div>
        <h2 id="shortcut-welcome-title">Lifemap leichter bedienen</h2>
        <p>Sollen beim Darüberfahren passende Tasten und Gesten erscheinen?</p>
        <div className="shortcut-example">
          <span>Inbox öffnen</span>
          <kbd>Tab</kbd>
        </div>
        <Duration days={days} onChange={setDays} />
        <div className="shortcut-welcome-actions">
          <button
            className="secondary-button"
            onClick={() => onChoose(false, days)}
          >
            Ohne Hinweise
          </button>
          <button
            className="primary-button"
            onClick={() => onChoose(true, days)}
          >
            Hinweise aktivieren
          </button>
        </div>
        <small>Später unter Einstellungen → Shortcut-Hinweise ändern.</small>
      </section>
    </div>
  );
}

export function ShortcutSettings({
  preference,
  enabled,
  onChange,
}: {
  preference: ShortcutPreference | null;
  enabled: boolean;
  onChange: (enabled: boolean, days: number) => void;
}) {
  const days = preference?.days || 7;
  return (
    <div className="settings-section shortcut-settings">
      <div className="shortcut-settings-heading">
        <h3>
          <Keyboard size={17} /> Shortcut-Hinweise
        </h3>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Shortcut-Hinweise aktivieren"
          className="shortcut-switch"
          onClick={() => onChange(!enabled, days)}
        >
          <span />
        </button>
      </div>
      <p>
        {enabled && preference?.expiresAt
          ? `Aktiv bis ${new Date(preference.expiresAt).toLocaleDateString("de-DE")}. Tasten und Gesten erscheinen direkt an der jeweiligen Aktion.`
          : preference?.enabled
            ? "Die gewählte Dauer ist abgelaufen. Du kannst die Hinweise erneut aktivieren."
            : "Passende Tasten und Gesten beim Darüberfahren anzeigen."}
      </p>
      <Duration days={days} onChange={(n) => onChange(enabled, n)} />
    </div>
  );
}
