"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookUser, Check, Loader2, RefreshCw, Search, X } from "lucide-react";
import PersonAvatar from "./person-avatar";
export type ContactChoice = {
  id: string;
  name: string;
  lastContact: string;
  avatar: string;
  selected: boolean;
  isNew: boolean;
  imported: boolean;
};
export default function WhatsappContactImport({
  contacts,
  busy,
  error,
  onClose,
  onSelect,
  onImport,
  onRefresh,
}: {
  contacts: ContactChoice[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSelect: (ids: string[], selected: boolean) => Promise<void>;
  onImport: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLInputElement>('input[type="search"]')
      ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.isConnected && previous.focus();
    };
  }, []);
  const visible = contacts
    .filter((c) =>
      c.name.toLocaleLowerCase("de").includes(query.toLocaleLowerCase("de")),
    )
    .sort(
      (a, b) =>
        Number(b.isNew) - Number(a.isNew) || a.name.localeCompare(b.name, "de"),
    );
  const count = contacts.filter((c) => c.selected).length;
  return createPortal(
    <div
      className="modal-backdrop wa-import-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal wa-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-import-title"
        data-native-tab
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const elements = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not([disabled]),input:not([disabled])",
              ),
            ];
            const first = elements[0],
              last = elements.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
          e.stopPropagation();
        }}
      >
        <div className="modal-heading">
          <h2 id="wa-import-title">
            <BookUser size={20} /> WhatsApp-Kontakte
          </h2>
          <button
            className="icon-button"
            aria-label="Kontaktimport schließen"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p className="modal-caption">
          {contacts.length} Personen · {count} ausgewählt
          {contacts.some((c) => c.isNew) &&
            ` · ${contacts.filter((c) => c.isNew).length} neu`}
        </p>
        <div className="wa-import-search">
          <Search size={15} />
          <input
            type="search"
            aria-label="WhatsApp-Kontakte suchen"
            placeholder="Person suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="icon-button"
            title="WhatsApp-Kontakte aktualisieren"
            aria-label="WhatsApp-Kontakte aktualisieren"
            disabled={busy}
            onClick={() => void onRefresh()}
          >
            <RefreshCw size={15} className={busy ? "spin" : ""} />
          </button>
        </div>
        <div className="wa-select-tools">
          <button
            disabled={busy || !visible.length}
            onClick={() =>
              void onSelect(
                visible.map((c) => c.id),
                true,
              )
            }
          >
            Alle{query ? " Treffer" : ""} auswählen
          </button>
          <button
            disabled={busy || !visible.length}
            onClick={() =>
              void onSelect(
                visible.map((c) => c.id),
                false,
              )
            }
          >
            Alle{query ? " Treffer" : ""} abwählen
          </button>
        </div>
        <div className="wa-contact-list">
          {visible.map((c) => (
            <label
              key={c.id}
              className={`wa-contact-choice ${c.isNew ? "new-contact" : ""}`}
            >
              <input
                type="checkbox"
                checked={c.selected}
                disabled={busy}
                onChange={(e) => void onSelect([c.id], e.target.checked)}
                aria-label={`${c.name} importieren`}
              />
              <PersonAvatar src={c.avatar} name={c.name} />
              <span>
                <strong>{c.name}</strong>
                {c.imported && <small>Bereits in Beziehungen</small>}
              </span>
              {c.isNew && <em>Neu</em>}
            </label>
          ))}
          {!visible.length && (
            <p className="muted">
              {busy
                ? "Kontakte werden geladen …"
                : query
                  ? "Keine passenden Personen."
                  : "Noch keine Kontakte übertragen. Sobald WhatsApp sie übermittelt, erscheinen sie hier."}
            </p>
          )}
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="wa-import-footer">
          <small>Deine Auswahl bleibt gespeichert.</small>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void onImport()}
          >
            {busy ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}{" "}
            {count ? `${count} Personen übernehmen` : "Auswahl speichern"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
