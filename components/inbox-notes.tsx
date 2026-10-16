"use client";
import { useAutosaveText } from "./use-autosave-text";
import { FileText } from "lucide-react";
export default function InboxNotes({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => Promise<void>;
}) {
  const { text, setText, flush, error } = useAutosaveText(value, onSave);
  return (
    <section className="inbox-notes">
      <h3>
        <FileText size={13} /> Notizen
      </h3>
      <textarea
        aria-label="Inbox-Notizen"
        placeholder="Gedanken, Ideen, Links …"
        value={text}
        maxLength={10000}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void flush()}
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
