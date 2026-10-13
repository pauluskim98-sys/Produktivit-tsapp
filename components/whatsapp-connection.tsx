"use client";
import { useEffect, useRef, useState } from "react";
import { BookUser, RefreshCw } from "lucide-react";
import WhatsappContactImport, {
  type ContactChoice,
} from "./whatsapp-contact-import";
import type { LifeState } from "@/lib/life";
type Status = {
  status: string;
  qr?: string;
  error?: string;
  updatedAt?: string;
  contacts?: { id: string; name: string; lastContact: string }[];
};
export default function WhatsappConnection({
  life,
  onChange,
}: {
  life: LifeState;
  onChange: (s: LifeState) => void;
}) {
  const [state, setState] = useState<Status>({ status: "disconnected" }),
    [busy, setBusy] = useState(false),
    [person, setPerson] = useState(""),
    [expanded, setExpanded] = useState(false),
    [qrDismissed, setQrDismissed] = useState(false),
    [chat, setChat] = useState("");
  const [importOpen, setImportOpen] = useState(false),
    [choices, setChoices] = useState<ContactChoice[]>([]),
    [importError, setImportError] = useState(""),
    [notice, setNotice] = useState("");
  const importVisible = useRef(false),
    latestChange = useRef(onChange);
  importVisible.current = importOpen;
  latestChange.current = onChange;
  const choiceEpoch = useRef(0);
  const pollBusy = useRef(false),
    avatarSignature = useRef("");
  async function contactRequest(body: Record<string, unknown>) {
    const r = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok)
      throw new Error(data.error || "Kontakte konnten nicht geladen werden.");
    if (data.state) setState(data.state);
    if (data.life) {
      latestChange.current(data.life);
      window.dispatchEvent(new Event("raum-life-changed"));
    }
    if (data.contacts) setChoices(data.contacts);
    return data;
  }
  async function contacts(refresh = false) {
    setBusy(true);
    setImportError("");
    try {
      await contactRequest({ action: "contacts", refresh });
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function selectContacts(ids: string[], selected: boolean) {
    choiceEpoch.current++;
    setBusy(true);
    setImportError("");
    try {
      await contactRequest({ action: "selection", ids, selected });
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importContacts() {
    choiceEpoch.current++;
    setBusy(true);
    setImportError("");
    try {
      const result = await contactRequest({
        action: "import",
        ids: choices.filter((c) => c.selected).map((c) => c.id),
        reviewed: choices.map((c) => c.id),
      });
      setNotice(result.message);
      setImportOpen(false);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function syncContacts() {
    setBusy(true);
    setImportError("");
    try {
      const result = await contactRequest({ action: "sync" });
      setNotice(result.message);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    try {
      const r = await fetch("/api/whatsapp");
      const s = await r.json();
      setState(s);
      const signature = JSON.stringify(
        (s.contacts || []).map((c: any) => [c.id, c.avatarFile]),
      );
      if (signature !== avatarSignature.current) {
        avatarSignature.current = signature;
        window.dispatchEvent(new Event("raum-whatsapp-avatars"));
      }
      if (s.status === "ready" && importVisible.current && !pollBusy.current) {
        pollBusy.current = true;
        const epoch = choiceEpoch.current;
        try {
          const r = await fetch("/api/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "contacts" }),
          });
          if (r.ok) {
            const list = await r.json();
            if (epoch === choiceEpoch.current) setChoices(list.contacts);
          }
        } finally {
          pollBusy.current = false;
        }
      }
    } catch {
      setState({ status: "error", error: "Verbindung nicht erreichbar." });
    }
  }
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, []);
  async function action(action: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const s = await r.json();
      setState(s);
      if (!r.ok) return;
    } finally {
      setBusy(false);
    }
  }
  async function link() {
    if (!person || !chat) return;
    const r = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", person, chat }),
    });
    const d = await r.json();
    if (r.ok) {
      onChange(d.life);
      setPerson("");
      setChat("");
    } else setState({ ...state, error: d.error });
  }
  return (
    <section className="whatsapp-connection">
      <div className="whatsapp-tools">
        <button
          aria-label={
            state.status === "ready"
              ? "WhatsApp verbunden"
              : "WhatsApp verbinden"
          }
          title="WhatsApp"
          disabled={busy}
          onClick={() => {
            if (state.status === "ready") setExpanded(!expanded);
            else {
              setQrDismissed(false);
              void action("connect");
            }
          }}
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M20 11.7A8 8 0 0 1 8.2 19L3 21l1.7-5.3A8 8 0 1 1 20 11.7Z" />
            <path d="M8 7c-1 4 3 8 7 8l1-2-3-1-1 1-2-2 1-1-1-3Z" />
          </svg>
        </button>
        <button
          type="button"
          title="WhatsApp-Kontakte importieren"
          aria-label="WhatsApp-Kontakte importieren"
          disabled={busy}
          onClick={() => {
            setImportOpen(true);
            setNotice("");
            void contacts(true);
          }}
        >
          <BookUser size={19} />
        </button>
        <button
          type="button"
          title="Letzten WhatsApp-Kontakt aktualisieren"
          aria-label="Letzten WhatsApp-Kontakt aktualisieren"
          disabled={busy || state.status !== "ready"}
          onClick={() => void syncContacts()}
        >
          <RefreshCw size={15} className={busy && !importOpen ? "spin" : ""} />
        </button>
        <small>
          {state.status === "ready"
            ? "Verbunden"
            : state.status === "starting"
              ? "Wird verbunden …"
              : state.status === "qr"
                ? "QR scannen"
                : ""}
        </small>
      </div>
      {importOpen && (
        <WhatsappContactImport
          contacts={choices}
          busy={busy}
          error={importError}
          onClose={() => setImportOpen(false)}
          onSelect={selectContacts}
          onRefresh={() => contacts(true)}
          onImport={importContacts}
        />
      )}
      {notice && (
        <small role="status" className="wa-sync-notice">
          {notice}
        </small>
      )}
      {!importOpen && importError && (
        <p className="inline-error" role="status">
          {importError}
        </p>
      )}
      {state.qr && !qrDismissed && (
        <div data-escape-layer>
          <button
            hidden
            data-close
            type="button"
            onClick={() => setQrDismissed(true)}
          >
            Schließen
          </button>
          <img src={state.qr} alt="WhatsApp-Verbindungscode" />
          {state.status === "qr" && (
            <p className="muted">
              WhatsApp → Einstellungen → Verknüpfte Geräte → Gerät hinzufügen
            </p>
          )}
        </div>
      )}
      {state.error && (
        <p role="status" className="inline-error">
          {state.error}
        </p>
      )}
      {state.status === "ready" && expanded && (
        <div data-escape-layer>
          <button hidden data-close onClick={() => setExpanded(false)}>
            Schließen
          </button>
          <select
            aria-label="Person für WhatsApp-Verknüpfung"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="">Person wählen …</option>
            {life.friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            aria-label="WhatsApp-Kontakt"
            value={chat}
            onChange={(e) => setChat(e.target.value)}
          >
            <option value="">WhatsApp-Kontakt wählen …</option>
            {state.contacts?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button disabled={!person || !chat} onClick={() => void link()}>
            Kontakt zuordnen
          </button>
          {state.updatedAt && (
            <small>
              Stand: {new Date(state.updatedAt).toLocaleString("de-DE")}
            </small>
          )}
        </div>
      )}
    </section>
  );
}
