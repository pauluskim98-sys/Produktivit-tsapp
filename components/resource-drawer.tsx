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
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [parent, setParent] = useState<string | null>(null),
    [name, setName] = useState(""),
    [edit, setEdit] = useState<string | null>(null),
    [folderForm, setFolderForm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (edit) setEdit(null);
      else if (folderForm) setFolderForm(false);
      else onClose();
    };
    const edgeDrop = (e: DragEvent) => {
      if (
        e.dataTransfer?.types.includes("Files") &&
        e.clientX >= window.innerWidth - 24
      )
        onOpen();
    };
    window.addEventListener("keydown", escape, true);
    window.addEventListener("dragover", edgeDrop);
    return () => {
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("dragover", edgeDrop);
    };
  }, [open, edit, folderForm, onClose, onOpen]);
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
        aria-label="Ablage öffnen"
        onClick={onOpen}
        onDragEnter={onOpen}
      >
        <Archive size={17} />
      </button>
      <aside
        className={`resource-drawer ${open ? "is-open" : ""}`}
        aria-label="Dateien und Medien"
        aria-hidden={!open}
        inert={!open}
        onMouseLeave={(e) => {
          if (e.buttons || busy) return;
          onClose();
        }}
        data-escape-layer={open ? "" : undefined}
      >
        <header>
          <h2>
            <Archive size={18} /> Ablage
          </h2>
          <button
            className="icon-button"
            data-close
            aria-label="Ablage schließen"
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
          <strong>{current?.name || "Meine Ablage"}</strong>
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
          <button disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={15} /> {busy ? "Lädt …" : "Hinzufügen"}
          </button>
          <input
            ref={input}
            hidden
            type="file"
            multiple
            onChange={(e) => {
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
          className="resource-list"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
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
                  const id = e.dataTransfer.getData(
                    "application/lifemap-resource",
                  );
                  if (id) move(id, item.id);
                  else void upload([...e.dataTransfer.files], item.id);
                }}
              >
                {item.mime.startsWith("image/") &&
                item.mime !== "image/svg+xml" ? (
                  <img src={`/api/storage?file=${item.id}`} alt="" />
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
                    <a
                      className="resource-name"
                      href={`/api/storage?file=${item.id}`}
                      download={item.name}
                    >
                      {item.name}
                    </a>
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
    </>
  );
}
