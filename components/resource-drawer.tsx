"use client";
import { useEffect, useState, useRef } from "react";
import {
  Folder,
  FolderPlus,
  Upload,
  File,
  Image as ImageIcon,
  Music,
  Film,
  X,
  ChevronLeft,
  Pencil,
  Trash2,
  Archive,
  Download,
} from "lucide-react";
import { record } from "@/lib/client-history";
type Item = {
  id: string;
  parentId: string | null;
  name: string;
  kind: "folder" | "file";
  mime: string;
  size: number;
};
export default function ResourceDrawer({
  open,
  pinned,
  onOpen,
  onToggle,
  onClose,
}: {
  open: boolean;
  pinned: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [parent, setParent] = useState<string | null>(null),
    [name, setName] = useState(""),
    [edit, setEdit] = useState<string | null>(null),
    [folderForm, setFolderForm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [externalDrag, setExternalDrag] = useState(false),
    [preview, setPreview] = useState<Item | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const filePicker = useRef(false);
  useEffect(() => {
    const el = input.current;
    const cancel = () => {
      filePicker.current = false;
    };
    el?.addEventListener("cancel", cancel);
    return () => el?.removeEventListener("cancel", cancel);
  }, []);
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      if (e.clientX >= window.innerWidth - 28) {
        e.preventDefault();
        setExternalDrag(true);
        onOpen();
      }
    };
    const end = () => setExternalDrag(false);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", end);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", end);
      window.removeEventListener("dragend", end);
    };
  }, [onOpen]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (preview) setPreview(null);
      else if (edit) setEdit(null);
      else if (folderForm) setFolderForm(false);
      else onClose();
    };
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("keydown", escape, true);
    };
  }, [open, edit, folderForm, preview, onClose, onOpen]);
  async function act(body: unknown) {
    const r = await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setItems(data.items);
    return data;
  }
  useEffect(() => {
    if (open)
      fetch("/api/storage", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setItems(d.items || []))
        .catch((e) => setError(e.message));
  }, [open]);
  async function action(body: unknown) {
    setError("");
    try {
      return await act(body);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function upload(files: File[], target: string | null = parent) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set("parentId", target || "");
      files.forEach((f) => data.append("files", f));
      const r = await fetch("/api/storage", { method: "POST", body: data });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setItems(result.items);
      record({
        undo: async () => {
          for (const id of result.added) await act({ action: "delete", id });
        },
        redo: async () => {
          for (const id of result.added) await act({ action: "restore", id });
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const current = items.find((i) => i.id === parent);
  const rows = items.filter((i) => i.parentId === parent);
  function move(id: string, to: string | null) {
    const before = items.find((i) => i.id === id)?.parentId || null;
    if (before === to) return;
    void action({ action: "move", id, parentId: to }).then((data) => {
      if (data)
        record({
          undo: () => act({ action: "move", id, parentId: before }),
          redo: () => act({ action: "move", id, parentId: to }),
        });
    });
  }
  return (
    <>
      <button
        className="resource-toggle icon-button"
        aria-label={open && pinned ? "Dokumente schließen" : "Dokumente öffnen"}
        aria-expanded={open}
        onClick={onToggle}
        onDragEnter={onOpen}
      >
        <Archive size={17} />
      </button>
      <aside
        className={`resource-drawer ${open ? "is-open" : ""}`}
        aria-label="Dokumente"
        aria-hidden={!open}
        inert={!open}
        onMouseLeave={(e) => {
          if (
            pinned ||
            filePicker.current ||
            e.buttons ||
            busy ||
            externalDrag ||
            preview ||
            edit ||
            folderForm
          )
            return;
          onClose();
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setExternalDrag(true);
          }
        }}
        onDrop={(e) => {
          if (e.defaultPrevented) return;
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            void upload([...e.dataTransfer.files]);
          }
          setExternalDrag(false);
        }}
        data-escape-layer={open ? "" : undefined}
      >
        <header>
          <h2>
            <button
              className="icon-button"
              aria-label={
                pinned ? "Dokumente einklappen" : "Dokumente geöffnet lassen"
              }
              onClick={onToggle}
            >
              <Archive size={18} />
            </button>{" "}
            Dokumente
          </h2>
          <button
            className="icon-button"
            data-close
            aria-label="Dokumente schließen"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="resource-breadcrumb">
          <button
            disabled={!parent}
            onClick={() => setParent(current?.parentId || null)}
          >
            <ChevronLeft size={15} />
          </button>
          <strong>{current?.name || "Meine Dokumente"}</strong>
        </div>
        <div className="resource-actions">
          <button
            onClick={() => {
              setFolderForm(true);
              setName("");
            }}
          >
            <FolderPlus size={15} /> Ordner
          </button>
          <button
            disabled={busy}
            onClick={() => {
              filePicker.current = true;
              input.current?.click();
            }}
          >
            <Upload size={15} /> {busy ? "Lädt …" : "Hinzufügen"}
          </button>
          <input
            ref={input}
            hidden
            type="file"
            multiple
            onChange={(e) => {
              filePicker.current = false;
              void upload([...(e.target.files || [])]);
              e.target.value = "";
            }}
          />
        </div>
        {folderForm && (
          <form
            data-escape-layer
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await action({
                action: "folder",
                name,
                parentId: parent,
              });
              if (result) {
                setFolderForm(false);
                const id = result.added[0];
                record({
                  undo: () => act({ action: "delete", id }),
                  redo: () => act({ action: "restore", id }),
                });
              }
            }}
          >
            <button
              hidden
              type="button"
              data-close
              onClick={() => setFolderForm(false)}
            >
              Schließen
            </button>
            <input
              autoFocus
              aria-label="Neuer Ordnername"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setFolderForm(false);
                }
              }}
            />
            <button disabled={!name.trim()}>Anlegen</button>
          </form>
        )}
        {error && (
          <p role="status" className="inline-error">
            {error}
          </p>
        )}
        <div
          className={`resource-list ${externalDrag ? "file-drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExternalDrag(false);
            const id = e.dataTransfer.getData("application/lifemap-resource");
            if (id) move(id, parent);
            else void upload([...e.dataTransfer.files]);
          }}
        >
          {rows.map((item) => {
            const Icon =
              item.kind === "folder"
                ? Folder
                : item.mime.startsWith("image/")
                  ? ImageIcon
                  : item.mime.startsWith("audio/")
                    ? Music
                    : item.mime.startsWith("video/")
                      ? Film
                      : File;
            return (
              <article
                className="resource-item"
                key={item.id}
                draggable={edit !== item.id}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/lifemap-resource",
                    item.id,
                  );
                }}
                onDragOver={(e) => {
                  if (item.kind === "folder") e.preventDefault();
                }}
                onDrop={(e) => {
                  if (item.kind !== "folder") return;
                  e.preventDefault();
                  e.stopPropagation();
                  setExternalDrag(false);
                  const id = e.dataTransfer.getData(
                    "application/lifemap-resource",
                  );
                  if (id) move(id, item.id);
                  else void upload([...e.dataTransfer.files], item.id);
                }}
              >
                {item.mime.startsWith("image/") &&
                item.mime !== "image/svg+xml" ? (
                  <button
                    className="resource-thumbnail"
                    aria-label={`${item.name} ansehen`}
                    onClick={() => setPreview(item)}
                  >
                    <img src={`/api/storage?file=${item.id}`} alt="" />
                  </button>
                ) : (
                  <Icon size={24} />
                )}
                <div>
                  {edit === item.id ? (
                    <form
                      data-escape-layer
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const old = item.name;
                        if (
                          await action({ action: "rename", id: item.id, name })
                        ) {
                          setEdit(null);
                          record({
                            undo: () =>
                              act({ action: "rename", id: item.id, name: old }),
                            redo: () =>
                              act({ action: "rename", id: item.id, name }),
                          });
                        }
                      }}
                    >
                      <button
                        hidden
                        data-close
                        type="button"
                        onClick={() => setEdit(null)}
                      >
                        Schließen
                      </button>
                      <input
                        autoFocus
                        aria-label="Dateiname bearbeiten"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setEdit(null);
                          }
                        }}
                      />
                    </form>
                  ) : item.kind === "folder" ? (
                    <button
                      className="resource-name"
                      onClick={() => setParent(item.id)}
                    >
                      {item.name}
                    </button>
                  ) : (
                    <button
                      className="resource-name"
                      onClick={() => setPreview(item)}
                    >
                      {item.name}
                    </button>
                  )}
                  {item.kind === "file" && (
                    <small>
                      {Math.max(1, Math.round(item.size / 1024))} KB
                    </small>
                  )}
                  {/^audio\//.test(item.mime) && (
                    <audio controls src={`/api/storage?file=${item.id}`} />
                  )}
                  {/^video\//.test(item.mime) && (
                    <video controls src={`/api/storage?file=${item.id}`} />
                  )}
                </div>
                {item.kind === "file" && (
                  <a
                    className="icon-button"
                    href={`/api/storage?file=${item.id}&download=1`}
                    download={item.name}
                    aria-label={`${item.name} herunterladen`}
                  >
                    <Download size={13} />
                  </a>
                )}
                <button
                  className="icon-button"
                  aria-label={`${item.name} umbenennen`}
                  onClick={() => {
                    setEdit(item.id);
                    setName(item.name);
                  }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${item.name} entfernen`}
                  onClick={async () => {
                    if (await action({ action: "delete", id: item.id }))
                      record({
                        undo: () => act({ action: "restore", id: item.id }),
                        redo: () => act({ action: "delete", id: item.id }),
                      });
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </article>
            );
          })}
          {!rows.length && (
            <div className="resource-empty">
              <Folder size={32} />
              <p>Dateien und Medien hier ablegen.</p>
            </div>
          )}
        </div>
      </aside>
      {preview && (
        <div
          className="resource-preview-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreview(null);
          }}
        >
          <section
            className="resource-preview"
            role="dialog"
            aria-modal="true"
            aria-label={`Vorschau ${preview.name}`}
            data-escape-layer
          >
            <header>
              <strong>{preview.name}</strong>
              <a
                href={`/api/storage?file=${preview.id}&download=1`}
                download={preview.name}
                className="icon-button"
                aria-label="Datei herunterladen"
              >
                <Download size={17} />
              </a>
              <button
                type="button"
                className="icon-button"
                data-close
                aria-label="Vorschau schließen"
                onClick={() => setPreview(null)}
              >
                <X size={19} />
              </button>
            </header>
            {/^image\/(png|jpeg|webp|gif)$/.test(preview.mime) ? (
              <img src={`/api/storage?file=${preview.id}`} alt={preview.name} />
            ) : preview.mime.startsWith("audio/") ? (
              <audio controls src={`/api/storage?file=${preview.id}`} />
            ) : preview.mime.startsWith("video/") ? (
              <video controls src={`/api/storage?file=${preview.id}`} />
            ) : preview.mime === "application/pdf" ||
              preview.mime === "text/plain" ? (
              <iframe
                title={preview.name}
                src={`/api/storage?file=${preview.id}`}
              />
            ) : (
              <a
                className="secondary-button"
                href={`/api/storage?file=${preview.id}&download=1`}
                download={preview.name}
              >
                Datei herunterladen
              </a>
            )}
          </section>
        </div>
      )}
    </>
  );
}
