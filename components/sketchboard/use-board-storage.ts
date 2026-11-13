"use client";
import { useEffect, useRef, useState } from "react";
import { emptyBoard, validateBoard, type Board } from "@/lib/sketchboard";

export function useBoardStorage(board: Board, restore: (board: Board) => void) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Laden …");
  const [error, setError] = useState("");
  const revision = useRef(0),
    saved = useRef(""),
    pending = useRef(""),
    busy = useRef(false),
    blocked = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const flush = useRef(async () => {});
  flush.current = async () => {
    if (
      busy.current ||
      blocked.current ||
      !pending.current ||
      pending.current === saved.current
    )
      return;
    const content = pending.current;
    busy.current = true;
    setStatus("Speichern …");
    try {
      const response = await fetch("/api/sketchboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: JSON.parse(content),
          revision: revision.current,
        }),
        keepalive: content.length < 50000,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) blocked.current = true;
        throw new Error(result.error || "Speichern fehlgeschlagen.");
      }
      revision.current = result.revision;
      saved.current = content;
      setError("");
      setStatus("Gespeichert");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      setStatus("Nicht gespeichert");
    } finally {
      busy.current = false;
    }
    if (!blocked.current && pending.current !== saved.current)
      timer.current = setTimeout(() => void flush.current(), 2000);
  };
  useEffect(() => {
    let active = true;
    fetch("/api/sketchboard", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("LifeMap konnte nicht geladen werden.");
        return r.json();
      })
      .then((result) => {
        if (!active) return;
        const valid = validateBoard(result.board || emptyBoard());
        revision.current = result.revision;
        saved.current = JSON.stringify(valid);
        pending.current = saved.current;
        restoreRef.current(valid);
        setReady(true);
        setStatus("Gespeichert");
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const content = JSON.stringify(validateBoard(board));
    pending.current = content;
    if (content === saved.current) return;
    setStatus("Änderungen …");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush.current(), 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [board, ready]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (pending.current !== saved.current) {
        void flush.current();
        event.preventDefault();
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") void flush.current();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return { ready, status, error, retry: () => void flush.current() };
}
