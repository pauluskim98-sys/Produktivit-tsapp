"use client";
import { useState, useEffect, useRef } from "react";
import { FileText, Check } from "lucide-react";
export default function InboxNotes({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(value),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  async function save() {
    if (text === value) return;
    try {
      await onSave(text);
      setSaved(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="inbox-notes">
      <h3>
        <FileText size={13} /> Notizen {saved && <Check size={12} />}
      </h3>
      <textarea
        aria-label="Inbox-Notizen"
        placeholder="Gedanken, Ideen, Links …"
        value={text}
        maxLength={10000}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          focused.current = false;
          void save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
      />
      {error && <small role="status">{error}</small>}
    </section>
  );
}
