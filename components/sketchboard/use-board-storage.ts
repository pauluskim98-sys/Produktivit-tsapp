"use client";
import { useEffect, useRef, useState } from "react";
import { emptyBoard, validateBoard, type Board } from "@/lib/sketchboard";

function mergeBoard(base: Board, local: Board, remote: Board): Board {
  function merge<T extends { id: string }>(
    before: T[],
    after: T[],
    latest: T[],
  ) {
    const original = new Map(
      before.map((item) => [item.id, JSON.stringify(item)]),
    );
    const current = new Set(after.map((item) => item.id));
    const merged = new Map(
      latest
        .filter((item) => !original.has(item.id) || current.has(item.id))
        .map((item) => [item.id, item]),
    );
    for (const item of after)
      if (original.get(item.id) !== JSON.stringify(item))
        merged.set(item.id, item);
    return [...merged.values()];
  }
  const nodes = merge(base.nodes, local.nodes, remote.nodes);
  const ids = new Set(nodes.map((node) => node.id));
  const edges = merge(base.edges, local.edges, remote.edges).filter((edge) => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return false;
    ids.add("line:" + edge.id);
    return true;
  });
  return validateBoard({
    ...remote,
    nodes,
    edges,
    grid: local.grid === base.grid ? remote.grid : local.grid,
    viewport:
      JSON.stringify(local.viewport) === JSON.stringify(base.viewport)
        ? remote.viewport
        : local.viewport,
  });
}

export function useBoardStorage(board: Board, restore: (board: Board) => void) {
  const tab =
    new URLSearchParams(
      typeof location === "undefined" ? "" : location.search,
    ).get("tab") || "main";
  const endpoint = "/api/sketchboard?tab=" + encodeURIComponent(tab);
  const draftKey = "lifemap-unsaved:" + tab;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const revision = useRef(0),
    saved = useRef(""),
    pending = useRef(""),
    busy = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const flush = useRef(async () => {});
  flush.current = async () => {
    if (busy.current || !pending.current || pending.current === saved.current)
      return;
    const content = pending.current;
    busy.current = true;
    setStatus("Speichern …");
    try {
      const response = await fetch(endpoint, {
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
        if (response.status === 409) {
          const latest = await fetch(endpoint, { cache: "no-store" });
          if (!latest.ok) throw new Error("Speichern fehlgeschlagen.");
          const result = await latest.json();
          const remote = validateBoard(result.board);
          const merged = mergeBoard(
            JSON.parse(saved.current),
            JSON.parse(pending.current),
            remote,
          );
          revision.current = result.revision;
          saved.current = JSON.stringify(remote);
          pending.current = JSON.stringify(merged);
          restoreRef.current(merged);
          setError("");
          if (pending.current !== saved.current)
            timer.current = setTimeout(() => void flush.current(), 150);
          else setStatus("Gespeichert");
          return;
        }
        throw new Error(result.error || "Speichern fehlgeschlagen.");
      }
      revision.current = result.revision;
      saved.current = content;
      if (pending.current === content)
        try {
          sessionStorage.removeItem(draftKey);
        } catch {}
      setError("");
      setStatus("Gespeichert");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      setStatus("Nicht gespeichert");
    } finally {
      busy.current = false;
    }
    if (pending.current !== saved.current)
      timer.current = setTimeout(() => void flush.current(), 2000);
  };
  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" })
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
        let recovered = valid;
        try {
          const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
          if (draft)
            recovered = mergeBoard(
              validateBoard(draft.base),
              validateBoard(draft.board),
              valid,
            );
        } catch {}
        restoreRef.current(recovered);
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
    let content: string;
    try {
      content = JSON.stringify(validateBoard(board));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Dieser Stand konnte nicht gespeichert werden.",
      );
      setStatus("Nicht gespeichert");
      return;
    }
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
    const unload = () => {
      if (pending.current !== saved.current) {
        try {
          sessionStorage.setItem(
            draftKey,
            JSON.stringify({
              base: JSON.parse(saved.current),
              board: JSON.parse(pending.current),
            }),
          );
        } catch {}
        void flush.current();
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") void flush.current();
    };
    window.addEventListener("pagehide", unload);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", unload);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return {
    ready,
    status,
    error,
    retry: () => void flush.current(),
    finish: async () => {
      while (busy.current)
        await new Promise((resolve) => setTimeout(resolve, 30));
      for (
        let attempt = 0;
        attempt < 3 && pending.current !== saved.current;
        attempt++
      ) {
        await flush.current();
        while (busy.current)
          await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return pending.current === saved.current;
    },
  };
}
