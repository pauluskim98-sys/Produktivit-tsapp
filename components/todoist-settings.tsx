"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Link2, Unplug } from "lucide-react";
export default function TodoistSettings({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState({
      connected: false,
      lastSync: "",
      error: "",
    }),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/todoist")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);
  async function act(action: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/todoist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "connect" ? { token } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setStatus(data);
      setToken("");
      await onRefresh();
      setMessage(
        action === "disconnect"
          ? "Verbindung getrennt. Aufgaben bleiben erhalten."
          : `${data.count} Aufgaben abgeglichen.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-section todoist-settings">
      <h3>
        <Link2 size={15} /> Todoist → Lifemap
      </h3>
      <p>
        Aufgaben mit Datum erscheinen beim jeweiligen Tag. Ohne festen Tag
        kommen sie in Todo → Woche. Automatisch alle fünf Minuten, solange
        Lifemap läuft.
      </p>
      {status.connected ? (
        <div className="todoist-connected">
          <span>
            Verbunden
            {status.lastSync
              ? ` · ${new Date(status.lastSync).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </span>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void act("sync")}
          >
            <RefreshCw size={14} /> Aktualisieren
          </button>
          <button
            className="icon-button"
            aria-label="Todoist trennen"
            disabled={busy}
            onClick={() => void act("disconnect")}
          >
            <Unplug size={15} />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act("connect");
          }}
        >
          <label>
            Todoist-API-Token
            <input
              type="password"
              aria-label="Todoist-API-Token"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
            />
          </label>
          <button className="primary-button" disabled={busy || !token}>
            {busy ? "Verbinden …" : "Verbinden"}
          </button>
          <a
            href="https://app.todoist.com/app/settings/integrations/developer"
            target="_blank"
            rel="noopener noreferrer"
          >
            Token in Todoist öffnen ↗
          </a>
        </form>
      )}
      <small>
        Token wird nur auf diesem Mac gespeichert. Der Abgleich übernimmt
        Todoist-Aufgaben nach Lifemap; Änderungen hier werden nicht an Todoist
        zurückgesendet.
      </small>
      {(message || status.error) && (
        <p role="status">{message || status.error}</p>
      )}
    </div>
  );
}
