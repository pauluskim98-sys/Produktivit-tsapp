"use client";
import { useEffect, useRef, useState } from "react";
import { Paperclip, File, FolderOpen, Plus } from "lucide-react";
import { record } from "@/lib/client-history";
type Item = { id: string; name: string; kind: string; mime: string };
/** The general shelf and Documents share the same private local files. */
export default function StorageShelf({
  onOpenDocuments,
}: {
  onOpenDocuments: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [over, setOver] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    try {
      const r = await fetch("/api/storage");
      const d = await r.json();
      if (r.ok) setItems(d.items || []);
    } catch {}
  }
  useEffect(() => {
    void load();
    window.addEventListener("lifemap-storage", load);
    return () => window.removeEventListener("lifemap-storage", load);
  }, []);
  async function act(action: string, id: string) {
    const r = await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    if (!r.ok) throw new Error("Datei konnte nicht geändert werden.");
    window.dispatchEvent(new Event("lifemap-storage"));
  }
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("parentId", "");
      files.forEach((f) => form.append("files", f));
      const r = await fetch("/api/storage", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setItems(d.items);
      window.dispatchEvent(new Event("lifemap-storage"));
      record({
        undo: async () => {
          for (const id of d.added) await act("delete", id);
        },
        redo: async () => {
          for (const id of d.added) await act("restore", id);
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`storage-shelf ${over ? "file-over" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        void upload([...e.dataTransfer.files]);
      }}
    >
      <div className="shelf-heading">
        <Paperclip size={13} />
        <span>Dateien & Medien</span>
        <button
          className="icon-button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label="Dateien zur Ablage hinzufügen"
        >
          <Plus size={14} />
        </button>
        <button
          className="icon-button"
          onClick={onOpenDocuments}
          aria-label="Dokumente verwalten"
        >
          <FolderOpen size={14} />
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void upload([...(e.target.files || [])]);
            e.target.value = "";
          }}
        />
      </div>
      <div className="shelf-files">
        {items
          .filter((i) => i.kind === "file")
          .slice(0, 12)
          .map((i) => (
            <a
              key={i.id}
              href={`/api/storage?file=${i.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {/^image\/(png|jpeg|webp|gif)$/.test(i.mime) ? (
                <img src={`/api/storage?file=${i.id}`} alt="" />
              ) : (
                <File size={13} />
              )}
              <span>{i.name}</span>
            </a>
          ))}
        {!items.length && <small>Dateien hier ablegen</small>}
      </div>
      {(error || busy) && (
        <small role="status">{busy ? "Wird abgelegt …" : error}</small>
      )}
    </div>
  );
}
