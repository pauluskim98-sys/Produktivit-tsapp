"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  NodeResizer,
  ConnectionMode,
  SelectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type NodeProps,
  type Connection,
  type Edge,
} from "@xyflow/react";
import {
  MousePointer2,
  Hand,
  Square,
  RectangleHorizontal,
  Circle,
  Diamond,
  Type,
  StickyNote,
  Waypoints,
  Palette,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Scan,
  Grid2X2,
  Copy,
  Trash2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CalendarDays,
  Moon,
  Sun,
  Download,
  ArrowUpToLine,
  ArrowDownToLine,
  X,
} from "lucide-react";
import {
  emptyBoard,
  newShape,
  palette,
  duplicateSelection,
  type Board,
  type ShapeData,
  type ShapeKind,
  type ShapeNode,
} from "@/lib/sketchboard";
import { boardFonts, validPicture, validPoints } from "@/lib/sketchboard";
import { useBoardStorage } from "./use-board-storage";
import { listenForViewSwipe } from "@/lib/lifemap-swipe";
import "@xyflow/react/dist/style.css";
import "./sketchboard.css";

type Tool = "write" | "paint" | "select" | "hand" | "connect" | ShapeKind;
const initialPoints: [number, number][] = [
  [12, 12],
  [88, 12],
  [94, 85],
  [10, 90],
];
const preferenceKey = "lifemap-board-tools";
const defaults = {
  font: "System",
  size: 24,
  background: "",
  pattern: "plain",
  hidden: [] as string[],
  recent: initialPoints,
  pinned: null as [number, number][] | null,
};
const tools = [
  { id: "write", label: "Schreiben und verschieben", Icon: Type },
  { id: "ink", label: "Stift", Icon: Italic },
  { id: "polygon", label: "Freie Form", Icon: Diamond },
  { id: "paint", label: "Färber", Icon: Palette },
  { id: "select", label: "Auswahl (A)", Icon: MousePointer2 },
  { id: "hand", label: "Verschieben (H)", Icon: Hand },
  { id: "rectangle", label: "Rechteck", Icon: Square },
  {
    id: "rounded",
    label: "Abgerundetes Rechteck (R)",
    Icon: RectangleHorizontal,
  },
  { id: "ellipse", label: "Kreis / Ellipse (O)", Icon: Circle },
  { id: "diamond", label: "Raute", Icon: Diamond },
  { id: "text", label: "Text (T)", Icon: Type },
  { id: "connect", label: "Verbindung (L)", Icon: Waypoints },
  { id: "sticky", label: "Notiz (N)", Icon: StickyNote },
] as const;
const EditContext = createContext({
  editing: "",
  begin: (_id: string) => {},
  end: () => {},
  patch: (_id: string, _data: Partial<ShapeData>) => {},
  checkpoint: () => {},
});
function Shape({ id, data, selected }: NodeProps<ShapeNode>) {
  const edit = useContext(EditContext),
    editing = edit.editing === id;
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) {
      area.current?.focus();
      area.current?.select();
    }
  }, [editing]);
  const style: CSSProperties = {
    background: data.fill,
    borderColor: data.stroke,
    borderWidth: data.strokeWidth,
    borderRadius: data.kind === "ellipse" ? "50%" : data.radius,
  };
  return (
    <div
      className={`lm-shape lm-${data.kind}${selected ? " lm-selected" : ""}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        edit.begin(id);
      }}
    >
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={60}
        minHeight={50}
        maxWidth={10000}
        maxHeight={10000}
        color="#9774d1"
        onResizeStart={() => edit.checkpoint()}
      />
      {data.kind === "image" && data.image ? (
        <img
          className="lm-shape-bg lm-picture"
          src={data.image}
          alt={data.text || "Bild"}
          draggable={false}
        />
      ) : data.points ? (
        <svg
          className="lm-shape-bg lm-vector"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {data.kind === "ink" ? (
            <polyline
              points={data.points.join(" ")}
              fill="none"
              stroke={data.fill}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <polygon
              points={data.points.join(" ")}
              fill={data.fill}
              stroke={data.stroke}
              strokeWidth={data.strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      ) : data.kind === "diamond" ? (
        <svg
          className="lm-shape-bg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon
            points="50,1 99,50 50,99 1,50"
            fill={data.fill}
            stroke={data.stroke}
            strokeWidth={data.strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="lm-shape-bg" style={style} />
      )}
      {data.kind === "sticky" && <span className="lm-tape" />}
      <div
        className="lm-shape-content"
        data-default-ink={
          data.color === "#29352f" && data.fill === "transparent"
            ? "true"
            : undefined
        }
        style={{
          color: data.color,
          fontFamily: data.font === "System" ? undefined : data.font,
          fontSize: data.fontSize,
          fontWeight: data.bold ? 700 : 400,
          fontStyle: data.italic ? "italic" : "normal",
          textAlign: data.align,
          justifyContent:
            data.kind === "sticky" || data.kind === "text"
              ? "flex-start"
              : "center",
        }}
      >
        {data.kind === "image" || data.kind === "ink" ? null : editing ? (
          <textarea
            ref={area}
            aria-label="Text bearbeiten"
            className="nodrag nopan nowheel"
            value={data.text}
            placeholder="Dein Gedanke …"
            onChange={(e) =>
              edit.patch(id, { text: e.target.value.slice(0, 50000) })
            }
            onBlur={edit.end}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (
                e.key === "Escape" ||
                (e.key === "Enter" && (e.ctrlKey || e.metaKey))
              ) {
                e.preventDefault();
                edit.end();
              }
            }}
          />
        ) : (
          <span className={data.text ? "" : "lm-placeholder"}>
            {data.text ||
              (data.kind === "sticky"
                ? "Deine Notiz"
                : "Doppelklick zum Schreiben")}
          </span>
        )}
      </div>
      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map(
        (position) => (
          <Handle
            key={position}
            type="source"
            id={position}
            position={position}
            className="lm-handle"
            isConnectable={!editing}
          />
        ),
      )}
    </div>
  );
}
const nodeTypes = { shape: Shape };
export default function Sketchboard() {
  return (
    <ReactFlowProvider>
      <BoardEditor />
    </ReactFlowProvider>
  );
}
function BoardEditor() {
  const [board, setBoard] = useState<Board>(emptyBoard),
    current = useRef(board);
  current.current = board;
  const flow = useReactFlow<ShapeNode>();
  const [tool, setTool] = useState<Tool>("write"),
    [editing, setEditing] = useState(""),
    [notes, setNotes] = useState(false),
    [settings, setSettings] = useState(false),
    [preferences, setPreferences] = useState(defaults),
    [form, setForm] = useState<[number, number][] | null>(null),
    [stroke, setStroke] = useState<[number, number][]>([]),
    [dark, setDark] = useState(false),
    [colors, setColors] = useState(false),
    [fill, setFill] = useState(palette[0]);
  const [quick, setQuick] = useState<{ x: number; y: number } | null>(null),
    [draft, setDraft] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0),
    history = useRef<{ past: Board[]; future: Board[] }>({
      past: [],
      future: [],
    });
  const clipboard = useRef<{ nodes: ShapeNode[]; edges: Edge[] } | null>(null),
    drawing = useRef<{
      x: number;
      y: number;
      clientX: number;
      clientY: number;
    } | null>(null),
    connectFrom = useRef<string | null>(null),
    host = useRef<HTMLDivElement>(null);
  const storage = useBoardStorage(board, setBoard);
  const leavingText = useRef(false);
  const currentTab = new URLSearchParams(location.search).get("tab") || "main";
  const [tabs] = useState<{ id: string; title: string }[]>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("lifemap-tabs") || "null") ?? [
          { id: "main", title: "LifeMap" },
        ]
      );
    } catch {
      return [{ id: "main", title: "LifeMap" }];
    }
  });
  const openTab = async (id?: string) => {
    if (!(await storage.finish())) return;
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(
        "lifemap-tabs",
        JSON.stringify([
          ...tabs,
          { id, title: "LifeMap " + (tabs.length + 1) },
        ]),
      );
    }
    location.assign(
      id === "main" ? "/lifemap/board" : "/lifemap/board?tab=" + id,
    );
  };
  const [noteHeight, setNoteHeight] = useState(280);
  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.data?.type === "lifemap-notepad-height"
      )
        setNoteHeight(
          Math.min(
            innerHeight * 0.72,
            Math.max(100, Number(event.data.height) || 280),
          ),
        );
    };
    window.addEventListener("message", resize);
    return () => window.removeEventListener("message", resize);
  }, []);
  useEffect(
    () =>
      listenForViewSwipe(
        1,
        () => location.assign("/lifemap"),
        () => !editing && !notes && !settings && !form,
      ),
    [editing, notes, settings, form],
  );
  const strokePoints = useRef<[number, number][]>([]);
  const toolbar = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || "{}");
      setPreferences({ ...defaults, ...saved });
    } catch {
      /* Use defaults. */
    }
  }, []);
  const updatePreferences = (changes: Partial<typeof defaults>) => {
    setPreferences((p) => {
      const next = { ...p, ...changes };
      localStorage.setItem(preferenceKey, JSON.stringify(next));
      return next;
    });
  };
  useEffect(() => {
    const closeNotes = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.data === "lifemap-close-notes"
      )
        setNotes(false);
    };
    window.addEventListener("message", closeNotes);
    return () => window.removeEventListener("message", closeNotes);
  }, []);
  const selected = board.nodes.filter((n) => n.selected),
    selectedEdges = board.edges.filter((e) => e.selected),
    data = selected[0]?.data;
  const checkpoint = () => {
    const h = history.current;
    h.past.push(structuredClone(current.current));
    if (h.past.length > 100) h.past.shift();
    h.future = [];
    setHistoryVersion((v) => v + 1);
  };
  const undo = (redo = false) => {
    const h = history.current,
      from = redo ? h.future : h.past,
      to = redo ? h.past : h.future;
    const previous = from.pop();
    if (!previous) return;
    to.push(structuredClone(current.current));
    setBoard(previous);
    setEditing("");
    setHistoryVersion((v) => v + 1);
  };
  const patch = (id: string, changes: Partial<ShapeData>) =>
    setBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...changes } } : n,
      ),
    }));
  const format = (changes: Partial<ShapeData>) => {
    checkpoint();
    setBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) =>
        n.selected ? { ...n, data: { ...n.data, ...changes } } : n,
      ),
    }));
  };
  const formatEdge = (changes: Partial<Edge>) => {
    checkpoint();
    setBoard((b) => ({
      ...b,
      edges: b.edges.map((e) => (e.selected ? { ...e, ...changes } : e)),
    }));
  };
  const remove = () => {
    if (!selected.length && !selectedEdges.length) return;
    checkpoint();
    setBoard((b) => ({
      ...b,
      nodes: b.nodes.filter((n) => !n.selected),
      edges: b.edges.filter(
        (e) =>
          !e.selected &&
          !b.nodes.some(
            (n) => n.selected && (n.id === e.source || n.id === e.target),
          ),
      ),
    }));
  };
  const copy = () => {
    clipboard.current = {
      nodes: structuredClone(selected),
      edges: structuredClone(
        board.edges.filter(
          (e) =>
            selected.some((n) => n.id === e.source) &&
            selected.some((n) => n.id === e.target),
        ),
      ),
    };
  };
  const paste = (source = clipboard.current) => {
    if (!source?.nodes.length) return;
    checkpoint();
    const next = duplicateSelection(source.nodes, source.edges);
    setBoard((b) => ({
      ...b,
      nodes: [
        ...b.nodes.map((n) => ({ ...n, selected: false })),
        ...next.nodes,
      ],
      edges: [
        ...b.edges.map((e) => ({ ...e, selected: false })),
        ...next.edges,
      ],
    }));
    clipboard.current = next;
  };
  const add = (
    kind: ShapeKind,
    clientX: number,
    clientY: number,
    width?: number,
    height?: number,
    extra: Partial<ShapeData> = {},
  ) => {
    const p = flow.screenToFlowPosition({ x: clientX, y: clientY });
    checkpoint();
    const node = newShape(kind, p.x, p.y, fill, width, height);
    node.data = {
      ...node.data,
      font: preferences.font,
      fontSize: preferences.size,
      ...extra,
    };
    node.selected = true;
    setBoard((b) => ({
      ...b,
      nodes: [...b.nodes.map((n) => ({ ...n, selected: false })), node],
      edges: b.edges.map((e) => ({ ...e, selected: false })),
    }));
    setTool("write");
    setQuick(null);
    if (!width && !["image", "ink", "polygon"].includes(kind))
      setEditing(node.id);
  };
  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!validPicture(reader.result)) {
        alert(
          "Bitte ein PNG-, JPEG-, WebP- oder GIF-Bild bis etwa 650 KB wählen.",
        );
        return;
      }
      const src = reader.result;
      const image = new Image();
      image.onload = () => {
        const rect = host.current?.getBoundingClientRect();
        if (!rect) return;
        add(
          "image",
          rect.left + rect.width / 2 - 130,
          rect.top + rect.height / 2 - 110,
          260,
          Math.min(600, Math.max(50, (260 * image.height) / image.width)),
          { image: src },
        );
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
  };
  const connect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    checkpoint();
    setBoard((b) => ({
      ...b,
      edges: [
        ...b.edges,
        {
          ...c,
          id: crypto.randomUUID(),
          type: "default",
          style: { stroke: "#8b8797", strokeWidth: 1.5 },
        },
      ],
    }));
  };
  const begin = (id: string) => {
    checkpoint();
    setEditing(id);
  };
  useEffect(() => {
    const stored = localStorage.getItem("raum-theme");
    setDark(
      stored === "dark" ||
        (!stored && matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        (key === "z" || key === "y") &&
        !settings &&
        !form
      ) {
        e.preventDefault();
        e.stopPropagation();
        undo(key === "y" || e.shiftKey);
        return;
      }
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (!storage.ready) return;
      const mod = e.metaKey || e.ctrlKey,
        k = e.key.toLowerCase();
      if (mod && ["z", "y", "c", "d", "a"].includes(k)) {
        e.preventDefault();
        if (k === "z") undo(e.shiftKey);
        else if (k === "y") undo(true);
        else if (k === "c") copy();
        else if (k === "d") paste({ nodes: selected, edges: board.edges });
        else
          setBoard((b) => ({
            ...b,
            nodes: b.nodes.map((n) => ({ ...n, selected: true })),
            edges: b.edges.map((e) => ({ ...e, selected: true })),
          }));
        return;
      }
      if (k === "delete" || k === "backspace") {
        e.preventDefault();
        remove();
      }
      if (k === " ") {
        e.preventDefault();
        if (!e.repeat) setNotes((open) => !open);
      }
      if (k === "escape") {
        setEditing("");
        setTool("write");
        setNotes(false);
        setSettings(false);
        setForm(null);
        setQuick(null);
        setColors(false);
        setDraft(null);
        drawing.current = null;
        connectFrom.current = null;
        setBoard((b) => ({
          ...b,
          nodes: b.nodes.map((n) => ({ ...n, selected: false })),
          edges: b.edges.map((e) => ({ ...e, selected: false })),
        }));
      }
      const shortcuts: Record<string, Tool> = {
        a: "select",
        h: "hand",
        r: "rounded",
        o: "ellipse",
        t: "text",
        l: "connect",
        n: "sticky",
      };
      if (mod && k === "s") {
        e.preventDefault();
        storage.retry();
      }
      if (!mod && ["arrowleft", "arrowright"].includes(k)) {
        const buttons = Array.from(
          toolbar.current?.querySelectorAll<HTMLButtonElement>(
            ":scope > button",
          ) ?? [],
        );
        if (buttons.length) {
          e.preventDefault();
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (index +
              (k === "arrowleft" ? buttons.length - 1 : 1) +
              (index < 0 && k === "arrowleft" ? 1 : 0)) %
              buttons.length
          ]?.focus();
        }
      }
      if (!mod && shortcuts[k])
        setTool((previous) =>
          previous === "select" && k === "a" ? "write" : shortcuts[k],
        );
    };
    window.addEventListener("keydown", keydown, true);

    return () => {
      window.removeEventListener("keydown", keydown, true);
    };
  });
  function exportBoard() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "LifeMap.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const shapeTool = !["write", "paint", "select", "hand", "connect"].includes(
    tool,
  );
  const edge = selectedEdges[0];
  return (
    <main
      className={`lm-app${dark ? " lm-dark" : ""}`}
      style={
        preferences.background
          ? ({ "--lm-bg": preferences.background } as CSSProperties)
          : undefined
      }
      onPaste={(e) => {
        if (
          (e.target as HTMLElement).closest("input,textarea,[contenteditable]")
        )
          return;
        const file = Array.from(e.clipboardData.files).find((f) =>
          f.type.startsWith("image/"),
        );
        if (file) {
          e.preventDefault();
          insertImage(file);
        } else if (clipboard.current) {
          e.preventDefault();
          paste();
        }
      }}
      onTouchStart={(e) => {
        touchStart.current =
          e.touches.length >= 2 ? e.touches[0].clientY : null;
      }}
      onTouchEnd={(e) => {
        if (
          touchStart.current !== null &&
          e.changedTouches[0]?.clientY < touchStart.current - 80
        )
          location.assign("/lifemap");
        touchStart.current = null;
      }}
    >
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          if (e.target.files?.[0]) insertImage(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <header className="lm-header">
        <a href="/lifemap">
          <CalendarDays size={20} />
          Kalender
        </a>
        <span className="lm-header-divider" />
        <strong>
          <Waypoints size={22} />
          LifeMap
        </strong>
        <button onClick={() => setSettings((open) => !open)}>
          Einstellungen
        </button>
        <button onClick={() => setNotes((open) => !open)}>Notepad</button>
        <button title="Strg+S" onClick={storage.retry}>
          Speichern
        </button>
        <a href="/lifemap" aria-label="LifeMap schließen">
          <X size={18} />
        </a>
        <span className="lm-save" role="status">
          {storage.status}
        </span>
        <button
          title={dark ? "Helle Ansicht" : "Dunkle Ansicht"}
          aria-label="Farbschema wechseln"
          onClick={() => {
            setDark(!dark);
            localStorage.setItem("raum-theme", !dark ? "dark" : "light");
          }}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          title="LifeMap exportieren"
          aria-label="LifeMap exportieren"
          onClick={exportBoard}
        >
          <Download size={18} />
        </button>
      </header>
      <nav className="lm-board-tabs" aria-label="LifeMap-Tabs">
        {tabs.map(({ id, title }) => (
          <button
            key={id}
            aria-current={id === currentTab ? "page" : undefined}
            onClick={() => {
              if (id !== currentTab) void openTab(id);
            }}
          >
            {title}
          </button>
        ))}
        <button aria-label="Neuer LifeMap-Tab" onClick={() => void openTab()}>
          +
        </button>
      </nav>
      {notes && (
        <aside className="lm-notepad" style={{ height: noteHeight }}>
          <iframe title="Kalender-Notepad" src="/lifemap?boardNotes=1" />
        </aside>
      )}
      {settings && (
        <section className="lm-settings" aria-label="LifeMap-Einstellungen">
          <button onClick={() => setSettings(false)}>Schließen</button>
          <label>
            Standardschrift{" "}
            <select
              value={preferences.font}
              onChange={(e) => updatePreferences({ font: e.target.value })}
            >
              {boardFonts.map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
          </label>
          <label>
            Schriftgröße{" "}
            <input
              type="number"
              min={10}
              max={120}
              value={preferences.size}
              onChange={(e) =>
                updatePreferences({
                  size: Math.max(10, Math.min(120, Number(e.target.value))),
                })
              }
            />
          </label>
          <label>
            Hintergrund{" "}
            <input
              type="color"
              value={preferences.background || (dark ? "#202124" : "#faf9fc")}
              onChange={(e) =>
                updatePreferences({ background: e.target.value })
              }
            />{" "}
            <button onClick={() => updatePreferences({ background: "" })}>
              Standard
            </button>
          </label>
          <label>
            Muster{" "}
            <select
              value={preferences.pattern}
              onChange={(e) => updatePreferences({ pattern: e.target.value })}
            >
              <option value="plain">Ohne</option>
              <option value="dots">Punkte</option>
              <option value="lines">Linien</option>
            </select>
          </label>
          <fieldset>
            <legend>Werkzeugleiste</legend>
            {tools.map(({ id, label }) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={!preferences.hidden.includes(id)}
                  onChange={(e) =>
                    updatePreferences({
                      hidden: e.target.checked
                        ? preferences.hidden.filter((tool) => tool !== id)
                        : [...preferences.hidden, id],
                    })
                  }
                />
                {label}
              </label>
            ))}
            {preferences.pinned && (
              <button onClick={() => updatePreferences({ pinned: null })}>
                Angeheftete Form entfernen
              </button>
            )}
          </fieldset>
        </section>
      )}
      {form && (
        <section className="lm-settings" aria-label="Freie Form bearbeiten">
          <p>Ziehe die Eckpunkte. Doppelklick fügt einen Punkt hinzu.</p>
          <svg
            className="lm-form-editor"
            viewBox="0 0 100 100"
            onDoubleClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (form.length < 30)
                setForm([
                  ...form,
                  [
                    ((e.clientX - rect.left) / rect.width) * 100,
                    ((e.clientY - rect.top) / rect.height) * 100,
                  ],
                ]);
            }}
          >
            <polygon points={form.join(" ")} fill={fill} stroke="#514264" />
            {form.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={3}
                onPointerDown={(e) =>
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const rect =
                    e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  const clamp = (v: number) => Math.max(0, Math.min(100, v));
                  setForm(
                    (points) =>
                      points?.map((p, j) =>
                        i === j
                          ? [
                              clamp(
                                ((e.clientX - rect.left) / rect.width) * 100,
                              ),
                              clamp(
                                ((e.clientY - rect.top) / rect.height) * 100,
                              ),
                            ]
                          : p,
                      ) ?? null,
                  );
                }}
              />
            ))}
          </svg>
          <button
            onClick={() => {
              updatePreferences({ recent: form });
              setTool("polygon");
              setForm(null);
            }}
          >
            Form platzieren
          </button>
          <button
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData(
                "application/x-lifemap-shape",
                JSON.stringify(form),
              )
            }
            onClick={() => updatePreferences({ pinned: form, recent: form })}
          >
            In die Leiste ziehen
          </button>
          <button onClick={() => setForm(null)}>Schließen</button>
        </section>
      )}
      {storage.error && (
        <div className="lm-error" role="alert">
          {storage.error}
          <button onClick={storage.retry}>Erneut versuchen</button>
          <button onClick={exportBoard}>Entwurf exportieren</button>
        </div>
      )}
      <div
        ref={host}
        onPointerDownCapture={(e) => {
          leavingText.current = Boolean(
            editing && !(e.target as HTMLElement).closest("textarea"),
          );
          if (leavingText.current) setEditing("");
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={(e) => {
          const file = e.dataTransfer.files[0];
          if (file) {
            e.preventDefault();
            insertImage(file);
          }
        }}
        className={`lm-canvas${shapeTool ? " lm-drawing" : ""}${tool === "connect" ? " lm-connecting" : ""}`}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).classList.contains("react-flow__pane"))
            setQuick({ x: e.clientX, y: e.clientY });
        }}
      >
        {storage.ready && (
          <EditContext.Provider
            value={{
              editing,
              begin,
              end: () => setEditing(""),
              patch,
              checkpoint,
            }}
          >
            <ReactFlow<ShapeNode>
              nodes={board.nodes}
              edges={board.edges}
              nodeTypes={nodeTypes}
              viewport={board.viewport}
              onViewportChange={(viewport) =>
                setBoard((b) => ({ ...b, viewport }))
              }
              onNodesChange={(changes) =>
                setBoard((b) => ({
                  ...b,
                  nodes: applyNodeChanges(changes, b.nodes),
                }))
              }
              onEdgesChange={(changes) =>
                setBoard((b) => ({
                  ...b,
                  edges: applyEdgeChanges(changes, b.edges),
                }))
              }
              onConnect={connect}
              connectionMode={ConnectionMode.Loose}
              onNodeDragStart={checkpoint}
              onSelectionDragStart={checkpoint}
              onNodeClick={(_, node) => {
                if (leavingText.current) {
                  leavingText.current = false;
                  return;
                }
                if (tool === "select" || tool === "hand") {
                  setTool("write");
                  return;
                }
                if (tool === "paint" && node.data.kind !== "image") {
                  checkpoint();
                  patch(node.id, { fill });
                }
                if (
                  tool === "write" &&
                  !editing &&
                  !["image", "ink"].includes(node.data.kind)
                )
                  begin(node.id);
                if (tool === "connect") {
                  if (connectFrom.current) {
                    connect({
                      source: connectFrom.current,
                      target: node.id,
                      sourceHandle: "right",
                      targetHandle: "left",
                    });
                    connectFrom.current = null;
                    setTool("select");
                  } else connectFrom.current = node.id;
                }
              }}
              onPaneClick={(e) => {
                if (leavingText.current) {
                  leavingText.current = false;
                  return;
                }
                if (tool !== "write") {
                  setTool("write");
                  connectFrom.current = null;
                  return;
                }
                setQuick(null);
                setColors(false);
                if (tool === "write" && !editing)
                  add("text", e.clientX, e.clientY);
                else setEditing("");
              }}
              nodesDraggable={!editing && tool === "select"}
              nodesConnectable={
                !editing && (tool === "select" || tool === "connect")
              }
              elementsSelectable={
                !shapeTool && tool !== "hand" && tool !== "paint"
              }
              selectionOnDrag={tool === "select"}
              selectionMode={SelectionMode.Partial}
              multiSelectionKeyCode="Shift"
              selectionKeyCode={null}
              panOnDrag={
                tool === "hand" || tool === "write" ? [0, 1, 2] : [1, 2]
              }
              panActivationKeyCode={null}
              paneClickDistance={5}
              panOnScroll
              zoomOnScroll={false}
              zoomOnPinch
              zoomOnDoubleClick={false}
              zoomActivationKeyCode="Control"
              minZoom={0.1}
              maxZoom={4}
              deleteKeyCode={null}
              colorMode={dark ? "dark" : "light"}
            >
              {(board.grid || preferences.pattern !== "plain") && (
                <Background
                  variant={
                    preferences.pattern === "lines"
                      ? BackgroundVariant.Lines
                      : BackgroundVariant.Dots
                  }
                  gap={24}
                  size={1}
                  color={dark ? "#4e4b59" : "#d8d5df"}
                />
              )}
            </ReactFlow>
          </EditContext.Provider>
        )}
        {storage.ready && !board.nodes.length && (
          <div className="lm-empty">
            <Waypoints size={36} strokeWidth={1} />
            <h1>Raum für deine Gedanken.</h1>
            <p>
              Klicke zum Schreiben oder ziehe, um die Ansicht zu verschieben.
            </p>
          </div>
        )}
        {shapeTool && storage.ready && (
          <div
            className="lm-draw-layer"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              if (tool === "ink") {
                strokePoints.current = [[e.clientX, e.clientY]];
                setStroke(strokePoints.current);
              }
              drawing.current = {
                x: e.clientX,
                y: e.clientY,
                clientX: e.clientX,
                clientY: e.clientY,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
              setQuick(null);
            }}
            onPointerMove={(e) => {
              const start = drawing.current;
              if (start && tool === "ink") {
                if (strokePoints.current.length < 1500)
                  strokePoints.current = [
                    ...strokePoints.current,
                    [e.clientX, e.clientY],
                  ];
                setStroke(strokePoints.current);
                return;
              }
              if (start)
                setDraft({
                  x: Math.min(start.x, e.clientX),
                  y: Math.min(start.y, e.clientY),
                  width: Math.abs(e.clientX - start.x),
                  height: Math.abs(e.clientY - start.y),
                });
            }}
            onPointerUp={(e) => {
              const start = drawing.current;
              if (!start) return;
              const w = Math.abs(e.clientX - start.x),
                h = Math.abs(e.clientY - start.y),
                drag = w > 8 || h > 8;
              if (!drag) {
                setTool("write");
                drawing.current = null;
                setDraft(null);
                setStroke([]);
                return;
              }
              if (tool === "ink") {
                const points = strokePoints.current;
                if (points.length > 1) {
                  const x = Math.min(...points.map((p) => p[0])),
                    y = Math.min(...points.map((p) => p[1]));
                  const width = Math.max(
                    40 * board.viewport.zoom,
                    Math.max(...points.map((p) => p[0])) - x,
                  );
                  const height = Math.max(
                    40 * board.viewport.zoom,
                    Math.max(...points.map((p) => p[1])) - y,
                  );
                  add(
                    "ink",
                    x,
                    y,
                    width / board.viewport.zoom,
                    height / board.viewport.zoom,
                    {
                      points: points.map((p) => [
                        ((p[0] - x) / width) * 100,
                        ((p[1] - y) / height) * 100,
                      ]),
                      fill,
                    },
                  );
                  setTool("ink");
                }
                drawing.current = null;
                setStroke([]);
                return;
              }
              add(
                tool as ShapeKind,
                drag ? Math.min(start.x, e.clientX) : e.clientX,
                drag ? Math.min(start.y, e.clientY) : e.clientY,
                drag ? Math.max(60, w / board.viewport.zoom) : undefined,
                drag ? Math.max(50, h / board.viewport.zoom) : undefined,
                tool === "polygon" ? { points: preferences.recent } : {},
              );
              drawing.current = null;
              setDraft(null);
            }}
            onPointerCancel={() => {
              drawing.current = null;
              setDraft(null);
              setStroke([]);
            }}
          />
        )}
        {stroke.length > 0 && (
          <svg className="lm-ink-preview">
            <polyline
              points={stroke.join(" ")}
              fill="none"
              stroke={fill}
              strokeWidth={3}
            />
          </svg>
        )}
        {draft && (
          <div
            className="lm-draft"
            style={{
              left: draft.x,
              top: draft.y,
              width: draft.width,
              height: draft.height,
            }}
          />
        )}
      </div>
      {(selected.length > 0 || selectedEdges.length > 0) && !editing && (
        <aside className="lm-format" aria-label="Element formatieren">
          <div className="lm-actions">
            <span>{selected.length + selectedEdges.length} ausgewählt</span>
            <button
              title="Duplizieren"
              aria-label="Duplizieren"
              disabled={!selected.length}
              onClick={() => paste({ nodes: selected, edges: board.edges })}
            >
              <Copy size={16} />
            </button>
            <button title="Löschen" aria-label="Löschen" onClick={remove}>
              <Trash2 size={16} />
            </button>
            <button
              title="Auswahl aufheben"
              aria-label="Auswahl aufheben"
              onClick={() =>
                setBoard((b) => ({
                  ...b,
                  nodes: b.nodes.map((n) => ({ ...n, selected: false })),
                  edges: b.edges.map((e) => ({ ...e, selected: false })),
                }))
              }
            >
              <X size={16} />
            </button>
          </div>
          {data && (
            <>
              <div className="lm-palette">
                {palette.map((c) => (
                  <button
                    key={c}
                    title={`Füllfarbe ${c}`}
                    aria-label={`Füllfarbe ${c}`}
                    className={data.fill === c ? "active" : ""}
                    style={{ background: c }}
                    onClick={() => format({ fill: c })}
                  />
                ))}
                <label title="Eigene Füllfarbe">
                  <input
                    type="color"
                    aria-label="Eigene Füllfarbe"
                    value={data.fill === "transparent" ? "#ffffff" : data.fill}
                    onChange={(e) => format({ fill: e.target.value })}
                  />
                </label>
              </div>
              <div className="lm-format-row">
                <label>
                  Rand
                  <input
                    aria-label="Randfarbe"
                    type="color"
                    value={
                      data.stroke === "transparent" ? "#ffffff" : data.stroke
                    }
                    onChange={(e) => format({ stroke: e.target.value })}
                  />
                </label>
                <label>
                  Stärke
                  <input
                    aria-label="Randstärke"
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={data.strokeWidth}
                    onChange={(e) =>
                      format({
                        strokeWidth: Math.max(0, Math.min(12, +e.target.value)),
                      })
                    }
                  />
                </label>
                <label>
                  Rundung
                  <input
                    aria-label="Eckenradius"
                    type="number"
                    min={0}
                    max={200}
                    value={data.radius}
                    onChange={(e) =>
                      format({
                        radius: Math.max(0, Math.min(200, +e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              <div className="lm-format-row">
                <input
                  title="Textfarbe"
                  aria-label="Textfarbe"
                  type="color"
                  value={data.color}
                  onChange={(e) => format({ color: e.target.value })}
                />
                <select
                  aria-label="Schriftgröße"
                  value={data.fontSize}
                  onChange={(e) => format({ fontSize: +e.target.value })}
                >
                  {[12, 16, 18, 20, 24, 28, 32, 40, 48, 64, 96].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  className={data.bold ? "active" : ""}
                  aria-label="Fett"
                  onClick={() => format({ bold: !data.bold })}
                >
                  <Bold size={16} />
                </button>
                <button
                  className={data.italic ? "active" : ""}
                  aria-label="Kursiv"
                  onClick={() => format({ italic: !data.italic })}
                >
                  <Italic size={16} />
                </button>
                {(["left", "center", "right"] as const).map((align, i) => {
                  const Icon = [AlignLeft, AlignCenter, AlignRight][i];
                  return (
                    <button
                      key={align}
                      className={data.align === align ? "active" : ""}
                      aria-label={`Text ${align}`}
                      onClick={() => format({ align })}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
              <div className="lm-format-row">
                <button
                  onClick={() => {
                    checkpoint();
                    const z =
                      Math.max(0, ...board.nodes.map((n) => n.zIndex || 0)) + 1;
                    setBoard((b) => ({
                      ...b,
                      nodes: b.nodes.map((n) =>
                        n.selected ? { ...n, zIndex: z } : n,
                      ),
                    }));
                  }}
                >
                  <ArrowUpToLine size={15} />
                  Nach vorne
                </button>
                <button
                  onClick={() => {
                    checkpoint();
                    const z =
                      Math.min(0, ...board.nodes.map((n) => n.zIndex || 0)) - 1;
                    setBoard((b) => ({
                      ...b,
                      nodes: b.nodes.map((n) =>
                        n.selected ? { ...n, zIndex: z } : n,
                      ),
                    }));
                  }}
                >
                  <ArrowDownToLine size={15} />
                  Nach hinten
                </button>
              </div>
            </>
          )}
          {!data && edge && (
            <div className="lm-edge-format">
              <label>
                Farbe
                <input
                  aria-label="Linienfarbe"
                  type="color"
                  value={String(edge.style?.stroke || "#8b8797")}
                  onChange={(e) =>
                    formatEdge({
                      style: { ...edge.style, stroke: e.target.value },
                      ...(edge.markerEnd
                        ? {
                            markerEnd: {
                              type: "arrowclosed" as never,
                              color: e.target.value,
                            },
                          }
                        : {}),
                    })
                  }
                />
              </label>
              <label>
                Stärke
                <input
                  aria-label="Linienstärke"
                  type="number"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={Number(edge.style?.strokeWidth || 1.5)}
                  onChange={(e) =>
                    formatEdge({
                      style: {
                        ...edge.style,
                        strokeWidth: Math.max(
                          0.5,
                          Math.min(12, +e.target.value),
                        ),
                      },
                    })
                  }
                />
              </label>
              <select
                aria-label="Linienart"
                value={edge.type}
                onChange={(e) => formatEdge({ type: e.target.value })}
              >
                <option value="default">Geschwungen</option>
                <option value="smoothstep">Abgerundete Ecken</option>
                <option value="step">Eckig</option>
                <option value="straight">Gerade</option>
              </select>
              <select
                aria-label="Strichart"
                value={String(edge.style?.strokeDasharray ?? "")}
                onChange={(e) =>
                  formatEdge({
                    style: { ...edge.style, strokeDasharray: e.target.value },
                  })
                }
              >
                <option value="">Durchgezogen</option>
                <option value="7 5">Gestrichelt</option>
                <option value="2 5">Gepunktet</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={!!edge.markerEnd}
                  onChange={(e) =>
                    formatEdge({
                      markerEnd: e.target.checked
                        ? {
                            type: "arrowclosed" as never,
                            color: String(edge.style?.stroke),
                          }
                        : undefined,
                    })
                  }
                />
                Pfeilspitze
              </label>
            </div>
          )}
        </aside>
      )}
      {quick && (
        <div
          className="lm-quick"
          style={{
            left: Math.min(quick.x, window.innerWidth - 220),
            top: Math.min(quick.y, window.innerHeight - 320),
          }}
        >
          {tools
            .filter((t) => !["select", "hand", "connect"].includes(t.id))
            .map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => add(id as ShapeKind, quick.x, quick.y)}
              >
                <Icon size={17} />
                {label.replace(/ \(.*\)/, "")}
              </button>
            ))}
        </div>
      )}
      <div className="lm-bottom">
        <div className="lm-history">
          <button
            aria-label="Rückgängig"
            title="Rückgängig (Strg Z)"
            disabled={!history.current.past.length}
            onClick={() => undo()}
          >
            <Undo2 size={18} />
          </button>
          <button
            aria-label="Wiederholen"
            title="Wiederholen (Strg Umschalt Z)"
            disabled={!history.current.future.length}
            onClick={() => undo(true)}
          >
            <Redo2 size={18} />
          </button>
        </div>
        <nav
          ref={toolbar}
          className="lm-toolbar"
          aria-label="Zeichenwerkzeuge"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/x-lifemap-shape"))
              e.preventDefault();
          }}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData("application/x-lifemap-shape");
            if (!raw) return;
            e.preventDefault();
            const points = JSON.parse(raw);
            if (validPoints(points)) updatePreferences({ pinned: points });
          }}
        >
          {tools
            .filter(({ id }) => !preferences.hidden.includes(id))
            .map(({ id, label, Icon }) => (
              <button
                key={id}
                title={label}
                aria-label={label}
                aria-pressed={tool === id}
                className={tool === id ? "active" : ""}
                disabled={!storage.ready}
                onClick={() => {
                  if (id === "polygon") setForm(preferences.recent);
                  else setTool(id);
                  if (id === "paint") setColors(true);
                  setEditing("");
                  connectFrom.current = null;
                }}
              >
                <Icon size={21} strokeWidth={1.6} />
              </button>
            ))}
          <button
            aria-label="Bild einfügen"
            title="Bild einfügen"
            onClick={() => fileInput.current?.click()}
          >
            ▧
          </button>
          {preferences.pinned && (
            <button
              title="Angeheftete freie Form"
              onClick={() => {
                updatePreferences({ recent: preferences.pinned! });
                setTool("polygon");
              }}
            >
              ⬡
            </button>
          )}
          <span className="lm-toolbar-separator" />
          <button
            title="Farben"
            aria-label="Farben"
            className={colors ? "active" : ""}
            onClick={() => setColors(!colors)}
          >
            <Palette size={21} />
          </button>
          {colors && (
            <div className="lm-tool-palette">
              {palette.map((c) => (
                <button
                  key={c}
                  aria-label={`Neue Füllfarbe ${c}`}
                  style={{ background: c }}
                  className={fill === c ? "active" : ""}
                  onClick={() => {
                    setFill(c);
                    if (tool !== "paint" && selected.length)
                      format({ fill: c });
                  }}
                />
              ))}
              <input
                type="color"
                aria-label="Neue eigene Füllfarbe"
                value={fill}
                onChange={(e) => setFill(e.target.value)}
              />
            </div>
          )}
        </nav>
        <div className="lm-zoom">
          <button
            title="Punktraster"
            aria-label="Punktraster"
            className={board.grid ? "active" : ""}
            onClick={() => setBoard((b) => ({ ...b, grid: !b.grid }))}
          >
            <Grid2X2 size={17} />
          </button>
          <button aria-label="Verkleinern" onClick={() => flow.zoomOut()}>
            <Minus size={17} />
          </button>
          <span>{Math.round(board.viewport.zoom * 100)}%</span>
          <button aria-label="Vergrößern" onClick={() => flow.zoomIn()}>
            <Plus size={17} />
          </button>
          <button
            aria-label="Alles anzeigen"
            title="Alles anzeigen"
            onClick={() => flow.fitView({ padding: 0.2, duration: 250 })}
          >
            <Scan size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}
