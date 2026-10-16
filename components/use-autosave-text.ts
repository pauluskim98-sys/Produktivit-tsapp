"use client";
import { useEffect, useRef, useState } from "react";
/** Serialize note writes so an older response cannot replace a newer draft. */
export function useAutosaveText(
  value: string,
  onSave: (text: string) => Promise<void>,
) {
  const [text, setTextState] = useState(value),
    [error, setError] = useState("");
  const latest = useRef(value),
    external = useRef(value),
    written = useRef(value),
    callback = useRef(onSave);
  const tail = useRef<Promise<unknown>>(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true);
  const dirty = useRef(false);
  callback.current = onSave;
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    const next = latest.current,
      save = callback.current;
    const job = tail.current
      .catch(() => {})
      .then(async () => {
        if (next === written.current) {
          if (latest.current === next) dirty.current = false;
          return true;
        }
        try {
          await save(next);
          written.current = next;
          if (latest.current === next) dirty.current = false;
          if (mounted.current) setError("");
          return true;
        } catch (e) {
          if (mounted.current) setError((e as Error).message);
          else
            window.dispatchEvent(
              new CustomEvent("raum-history-error", {
                detail: (e as Error).message,
              }),
            );
          return false;
        }
      });
    tail.current = job;
    return job;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const setText = (next: string) => {
    dirty.current = true;
    latest.current = next;
    setTextState(next);
  };
  useEffect(() => {
    if (!dirty.current) {
      latest.current = value;
      written.current = value;
      setTextState(value);
    }
    external.current = value;
  }, [value]);
  useEffect(() => {
    if (dirty.current)
      timer.current = setTimeout(() => void flushRef.current(), 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, value]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void flushRef.current();
    };
  }, []);
  return { text, setText, flush, error };
}
