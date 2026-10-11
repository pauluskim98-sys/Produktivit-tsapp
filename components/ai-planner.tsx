"use client";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Mic,
  MicOff,
  ArrowUp,
  X,
  Loader2,
  Check,
} from "lucide-react";
import type { Todo } from "@/lib/types";
interface Message {
  id: string;
  role: string;
  content: string;
}
interface Proposal {
  id: string;
  items: Todo[];
  accepted: boolean;
}
async function request(url: string, body?: unknown) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Anfrage fehlgeschlagen.");
  return d;
}
export function AiConnection({ onConnected }: { onConnected: () => void }) {
  const [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="ai-connection"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await request("/api/ai-config", { key });
          setKey("");
          onConnected();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <strong>OpenAI verbinden</strong>
      <p>
        Diese App benötigt einen OpenAI-API-Schlüssel. Deine ChatGPT-Anmeldung
        verbindet sie nicht automatisch. Der Schlüssel wird nur auf deinem Mac
        gespeichert. Anfragen nutzen dein OpenAI-API-Konto.
      </p>
      <a
        href="https://platform.openai.com/api-keys"
        target="_blank"
        rel="noreferrer"
      >
        API-Schlüssel verwalten ↗
      </a>
      <label>
        API-Schlüssel
        <input
          type="password"
          autoComplete="off"
          placeholder="sk-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          required
        />
      </label>
      <button
        type="submit"
        className="primary-button"
        disabled={busy || !key.trim()}
      >
        {busy ? "Verbindung prüfen …" : "Verbinden"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
// Speech recognition is optional and is started only by an explicit microphone click.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export default function AiPlanner({
  start,
  available,
  onConnected,
  onAccepted,
  onClose,
  initialMessage = "",
}: {
  start: string;
  available: boolean;
  onConnected: () => void;
  onAccepted: (todos: Todo[]) => void;
  onClose: () => void;
  initialMessage?: string;
}) {
  const [message, setMessage] = useState(initialMessage),
    [messages, setMessages] = useState<Message[]>([]),
    [proposals, setProposals] = useState<Proposal[]>([]),
    [weeks, setWeeks] = useState(4),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [listening, setListening] = useState(false),
    [speechSupported, setSpeechSupported] = useState(false),
    [connect, setConnect] = useState(false);
  const speech = useRef<Recognition | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    request("/api/planner")
      .then((d) => {
        setMessages(d.messages);
        setProposals(d.proposals);
      })
      .catch((e) => setError(e.message));
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    setSpeechSupported(
      Boolean(w.SpeechRecognition || w.webkitSpeechRecognition),
    );
    return () => speech.current?.abort();
  }, []);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, busy]);
  function dictate() {
    if (listening) {
      speech.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    speech.current = r;
    r.lang = "de-DE";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) =>
      setMessage((m) =>
        [m, ...Array.from(e.results).map((result) => result[0].transcript)]
          .filter(Boolean)
          .join(" "),
      );
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Mikrofonzugriff nicht erlaubt. Du kannst die Nachricht auch tippen."
          : "Diktieren ist in diesem Browser gerade nicht verfügbar. Bitte die Nachricht tippen.",
      );
      setListening(false);
    };
    r.onend = () => setListening(false);
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Diktieren konnte nicht gestartet werden.");
    }
  }
  async function send() {
    if (!message.trim() || busy || !available) return;
    speech.current?.stop();
    setBusy(true);
    setError("");
    try {
      const d = await request("/api/planner", {
        message,
        start,
        weeks,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setMessages(d.messages);
      setProposals(d.proposals);
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="detail-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="detail-panel ai-planner"
        role="dialog"
        aria-modal="true"
        aria-label="KI-Wochenplanung"
      >
        <div className="detail-top">
          <strong>
            <Sparkles size={16} /> Woche & Ziele planen
          </strong>
          <button
            className="icon-button"
            aria-label="KI-Planung schließen"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="ai-planner-content" ref={list}>
          {connect ? (
            <AiConnection
              onConnected={() => {
                onConnected();
                setConnect(false);
              }}
            />
          ) : (
            <button className="text-button" onClick={() => setConnect(true)}>
              {available
                ? "OpenAI-Verbindung ändern"
                : "Direkte KI nicht verbunden · API einrichten"}
            </button>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`planning-message ${m.role}`}>
              <small>{m.role === "user" ? "Du" : "Planungsassistent"}</small>
              <p>{m.content}</p>
            </div>
          ))}
          {proposals
            .filter((p) => !p.accepted)
            .map((p) => (
              <section className="plan-proposal" key={p.id}>
                <h3>{p.items.length} Vorschläge</h3>
                <p>
                  Prüfe die Zeiten. Beim Übernehmen werden neue Aufgaben
                  hinzugefügt.
                </p>
                <div className="proposal-list">
                  {p.items.map((t) => (
                    <div
                      key={t.id}
                      className={`proposal-item color-${t.color}`}
                    >
                      <b>{t.title}</b>
                      <span>
                        {t.plannedDate
                          ? new Date(
                              t.plannedDate + "T12:00:00",
                            ).toLocaleDateString("de-DE")
                          : "Inbox"}
                        {t.time
                          ? ` · ${t.time} · ${t.duration} Min.`
                          : " · Ohne Zeit"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const d = await request("/api/planner", {
                        action: "accept",
                        id: p.id,
                      });
                      setProposals(d.proposals);
                      onAccepted(d.todos);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Check size={15} /> {p.items.length} Aufgaben übernehmen
                </button>
              </section>
            ))}
          {proposals
            .filter((p) => p.accepted)
            .slice(0, 3)
            .map((p) => (
              <p className="accepted-plan" key={p.id}>
                <Check size={14} /> {p.items.length} Aufgaben übernommen
              </p>
            ))}
          {busy && (
            <p role="status">
              <Loader2 size={15} className="spin" /> Der Assistent plant …
            </p>
          )}
          {error && (
            <p className="ai-error" role="alert">
              {error}
            </p>
          )}
        </div>
        {!available && (
          <div className="weekly-handoff">
            <button
              className="secondary-button"
              onClick={async () => {
                try {
                  const data = await request("/api/state");
                  const end = new Date(start + "T12:00:00");
                  end.setDate(end.getDate() + weeks * 7);
                  const endKey = end.toISOString().slice(0, 10);
                  const context = {
                    start,
                    weeks,
                    tasks: data.todos
                      .filter(
                        (t: Todo) =>
                          !t.plannedDate ||
                          (t.plannedDate >= start && t.plannedDate < endKey),
                      )
                      .map((t: Todo) => ({
                        title: t.title,
                        date: t.plannedDate,
                        time: t.time,
                        duration: t.duration,
                      })),
                    events: data.events.filter(
                      (e: { start: string; end: string }) =>
                        e.start.slice(0, 10) < endKey &&
                        e.end.slice(0, 10) >= start,
                    ),
                  };
                  await navigator.clipboard.writeText(
                    `Berate mich zu meiner Wochenplanung und meinen Zielen. ${message}\n${JSON.stringify(context)}`,
                  );
                  setError("Frage und Kalenderkontext für ChatGPT kopiert.");
                } catch {
                  setError("Kopieren wurde vom Browser blockiert.");
                }
              }}
            >
              Für ChatGPT kopieren
            </button>
            <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">
              ChatGPT öffnen ↗
            </a>
          </div>
        )}
        <form
          className="planning-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            Planung ab{" "}
            {new Date(start + "T12:00:00").toLocaleDateString("de-DE")}
            <select
              aria-label="Planungszeitraum"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {[1, 2, 4, 8, 12, 26].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "Woche" : "Wochen"}
                </option>
              ))}
            </select>
          </label>
          <textarea
            aria-label="Nachricht an den Wochenassistenten"
            placeholder="Zum Beispiel: Ich möchte in 8 Wochen die Biochemie wiederholen. Plane vier Lernblöcke pro Woche …"
            value={message}
            maxLength={8000}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div>
            <button
              type="button"
              className="secondary-button"
              disabled={!speechSupported || busy}
              title={
                speechSupported
                  ? "Diktieren"
                  : "Dieser Browser unterstützt Diktieren nicht. Nutze die Diktierfunktion deines Geräts."
              }
              onClick={dictate}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}{" "}
              {listening ? "Diktat beenden" : "Diktieren"}
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={busy || !available || !message.trim()}
            >
              <ArrowUp size={16} /> Senden
            </button>
          </div>
          <small>
            Deine Nachricht und der Kalenderkontext werden an OpenAI gesendet.
            Diktate kannst du vor dem Senden bearbeiten.
          </small>
        </form>
      </aside>
    </div>
  );
}
