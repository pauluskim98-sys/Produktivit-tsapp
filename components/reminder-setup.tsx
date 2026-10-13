"use client";
import { useEffect, useState } from "react";
export default function ReminderSetup() {
  const [status, setStatus] = useState<{
    supported: boolean;
    installed: boolean;
    active: boolean;
  } | null>(null);
  async function refresh() {
    const r = await fetch("/api/reminders");
    setStatus(await r.json());
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <div className="reminder-setup">
      <h3>Laptop-Erinnerungen</h3>
      <p>
        {status?.active
          ? "Mac-Hintergrunddienst eingerichtet. Erinnerungen kommen einen Tag vor dem Termin, auch bei geschlossenem Browser."
          : "Für Erinnerungen bei geschlossenem Browser den Mac-Hintergrunddienst einmal einrichten."}
      </p>
      {!status?.active && (
        <>
          <a className="secondary-button" href="/api/reminders?download=1">
            Mac-Einrichtung herunterladen
          </a>
          <p className="muted">
            Die heruntergeladene Datei „Raum-Erinnerungen.command“ öffnen und
            macOS-Mitteilungen zulassen. Falls nötig im Terminal: chmod +x
            ~/Downloads/Raum-Erinnerungen.command
          </p>
        </>
      )}
      <button className="text-button" onClick={() => void refresh()}>
        Status prüfen
      </button>
      <p className="muted">
        Der Mac muss eingeschaltet und angemeldet sein. Nach dem Ruhezustand
        werden fällige Erinnerungen nachgeholt. Ohne Uhrzeit gilt 09:00 Uhr.
      </p>
    </div>
  );
}
