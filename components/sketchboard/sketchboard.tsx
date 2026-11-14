"use client";
import {
  createContext,
  useCallback,
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
  Settings,
  PenTool,
  ImagePlus,
} from "lucide-react";
import {
  emptyBoard,
  emptyLineLabel,
  type LineLabel,
  newShape,
  palette,
  duplicateSelection,
  type Board,
  type ShapeData,
  type ShapeKind,
  type ShapeNode,
} from "@/lib/sketchboard";
import { boardFonts, validPicture, validPoints } from "@/lib/sketchboard";
import { BoardEdge } from "./board-edge";
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
  accent: "#9360c9",
  order: [] as string[],
  connection: {
    type: "default",
    color: "#8b8797",
    width: 1.5,
    dash: "",
    arrows: "none",
  },
  pen: {
    style: "pen",
    color: "#403451",
    width: 3,
    opacity: 1,
    smooth: true,
    straight: false,
  },
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
  { id: "ink", label: "Stift", Icon: PenTool },
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
  { id: "image", label: "Bild einfügen", Icon: ImagePlus },
  { id: "sticky", label: "Notiz (N)", Icon: StickyNote },
] as const;
const hiddenTools = ["write", "select", "hand"];
function roundedOutline(points: [number, number][], radius: number) {
  return (
    points
      .map((point, i) => {
        const toward = (neighbor: [number, number]) => {
          const distance = Math.hypot(
            neighbor[0] - point[0],
            neighbor[1] - point[1],
          );
          const scale = distance ? Math.min(0.45, radius / distance) : 0;
          return [
            point[0] + (neighbor[0] - point[0]) * scale,
            point[1] + (neighbor[1] - point[1]) * scale,
          ].join(" ");
        };
        return (
          (i ? "L " : "M ") +
          toward(points[(i + points.length - 1) % points.length]) +
          " Q " +
          point.join(" ") +
          " " +
          toward(points[(i + 1) % points.length])
        );
      })
      .join(" ") + " Z"
  );
}
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
              strokeWidth={data.strokeWidth}
              opacity={data.opacity ?? 1}
              className={"lm-ink-" + (data.inkStyle ?? "pen")}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <path
              d={roundedOutline(data.points, data.radius)}
              opacity={data.opacity ?? 1}
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
        <div
          className="lm-shape-bg"
          style={{ ...style, opacity: data.opacity ?? 1 }}
        />
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
          background: data.textBackground,
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
function LineAnchor() {
  return (
    <Handle
      id="center"
      type="source"
      position={Position.Top}
      style={{ opacity: 0, width: 1, height: 1, border: 0 }}
      isConnectable={false}
    />
  );
}
const nodeTypes = { shape: Shape, anchor: LineAnchor };
const edgeTypes = { boardLine: BoardEdge };
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
  const [focus, setFocus] = useState<{ id: string; level: 1 | 2 } | null>(null);
  const [anchors, setAnchors] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const reportAnchor = useCallback((id: string, x: number, y: number) => {
    setAnchors((current) =>
      current[id]?.x === x && current[id]?.y === y
        ? current
        : { ...current, [id]: { x, y } },
    );
  }, []);
  const [connectionOverride, setConnectionOverride] = useState<
    typeof defaults.connection | null
  >(null);
  const connection = connectionOverride ?? preferences.connection;
  const [toolMenu, setToolMenu] = useState<string | null>(null);
  const shapeHit = useRef<string | null>(null);
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
  const [noteHeight, setNoteHeight] = useState(0);
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
    setBoard((b) => {
      const gone = new Set(b.nodes.filter((n) => n.selected).map((n) => n.id));
      for (const e of b.edges)
        if (e.selected || gone.has(e.source) || gone.has(e.target))
          gone.add("line:" + e.id);
      return {
        ...b,
        nodes: b.nodes.filter((n) => !gone.has(n.id)),
        edges: b.edges.filter((e) => !gone.has("line:" + e.id)),
      };
    });
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
          type: connection.type,
          style: {
            stroke: connection.color,
            strokeWidth: connection.width,
            strokeDasharray: connection.dash,
          },
          ...(connection.arrows !== "none"
            ? {
                markerEnd: {
                  type: "arrowclosed" as never,
                  color: connection.color,
                },
              }
            : {}),
          ...(connection.arrows === "both"
            ? {
                markerStart: {
                  type: "arrowclosed" as never,
                  color: connection.color,
                },
              }
            : {}),
        },
      ],
    }));
  };
  const connectTo = (id: string) => {
    const source = connectFrom.current;
    if (!source) {
      connectFrom.current = id;
      return;
    }
    connect({
      source,
      target: id,
      sourceHandle: "right",
      targetHandle: "left",
    });
    connectFrom.current = null;
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
      if (!mod && k === "h" && (focus || selected[0] || selectedEdges[0])) {
        e.preventDefault();
        const id =
          focus?.id ?? (selected[0]?.id || "line:" + selectedEdges[0].id);
        setFocus(focus?.level === 2 ? null : { id, level: focus ? 2 : 1 });
        return;
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
  const caption =
    (edge?.data?.caption as LineLabel | undefined) ?? emptyLineLabel;
  const setCaption = (value: Partial<LineLabel>) =>
    formatEdge({ data: { ...edge?.data, caption: { ...caption, ...value } } });
  const connected = new Set(focus ? [focus.id] : []);
  if (focus) {
    let previous = 0;
    while (previous !== connected.size) {
      previous = connected.size;
      for (const line of board.edges) {
        const key = "line:" + line.id;
        if (
          connected.has(key) ||
          connected.has(line.source) ||
          connected.has(line.target)
        ) {
          connected.add(key);
          connected.add(line.source);
          connected.add(line.target);
        }
      }
    }
  }
  const fade = (id: string) =>
    !focus || connected.has(id) ? 1 : focus.level === 1 ? 0.15 : 0;
  const referenceIds = new Set(
    board.edges
      .flatMap((e) => [e.source, e.target])
      .filter((id) => id.startsWith("line:")),
  );
  const proxyNodes = [...referenceIds].map((id) => ({
    id,
    type: "anchor",
    position: anchors[id.slice(5)] ?? { x: 0, y: 0 },
    width: 1,
    height: 1,
    draggable: false,
    selectable: false,
    focusable: false,
    data: {},
    style: { pointerEvents: "none" },
  })) as unknown as ShapeNode[];
  return (
    <main
      className={`lm-app${dark ? " lm-dark" : ""}`}
      style={
        {
          "--lm-accent": preferences.accent,
          "--lm-bg": preferences.background || undefined,
        } as CSSProperties
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
        <button
          aria-label="Einstellungen"
          title="Einstellungen"
          onClick={() => setSettings((open) => !open)}
        >
          <Settings size={19} />
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
      </header>
      {
        <aside
          className="lm-notepad"
          inert={!notes}
          aria-hidden={!notes}
          style={{
            height: noteHeight,
            visibility: notes && noteHeight ? "visible" : "hidden",
          }}
        >
          <iframe title="Kalender-Notepad" src="/lifemap?boardNotes=1" />
        </aside>
      }
      {settings && (
        <section className="lm-settings" aria-label="LifeMap-Einstellungen">
          <div className="lm-settings-heading">
            <strong>LifeMap-Einstellungen</strong>
            <button aria-label="Schließen" onClick={() => setSettings(false)}>
              <X size={18} />
            </button>
          </div>
          <label>
            UI-Farbe{" "}
            <input
              type="color"
              value={preferences.accent}
              onChange={(e) => updatePreferences({ accent: e.target.value })}
            />
          </label>
          <div className="lm-style-previews">
            {["plain", "dots", "lines", "grid", "paper"].map((pattern) => (
              <button
                key={pattern}
                title={pattern}
                aria-label={
                  {
                    plain: "Glatt",
                    dots: "Punkte",
                    lines: "Linien",
                    grid: "Raster",
                    paper: "Papier",
                  }[pattern]
                }
                className={"lm-preview lm-pattern-" + pattern}
                aria-pressed={preferences.pattern === pattern}
                onClick={() => updatePreferences({ pattern })}
              />
            ))}
          </div>
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
        style={{ "--lm-ui": preferences.accent } as CSSProperties}
        className={`lm-canvas lm-pattern-${preferences.pattern} ${tool === "select" ? "lm-crosshair" : ""}${shapeTool ? " lm-drawing" : ""}${tool === "connect" ? " lm-connecting" : ""}`}
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
              end: () => {
                setBoard((b) => {
                  const empty = b.nodes.find(
                    (n) =>
                      n.id === editing &&
                      n.data.kind === "text" &&
                      !n.data.text.trim(),
                  );
                  return empty
                    ? {
                        ...b,
                        nodes: b.nodes.filter((n) => n.id !== empty.id),
                        edges: b.edges.filter(
                          (e) => e.source !== empty.id && e.target !== empty.id,
                        ),
                      }
                    : b;
                });
                setEditing("");
              },
              patch,
              checkpoint,
            }}
          >
            <ReactFlow<ShapeNode>
              nodes={[
                ...board.nodes.map((n) => ({
                  ...n,
                  style: {
                    ...n.style,
                    opacity: fade(n.id),
                    pointerEvents:
                      fade(n.id) === 0 ? ("none" as const) : undefined,
                  },
                })),
                ...proxyNodes,
              ]}
              edges={board.edges.map((e) => ({
                ...e,
                type: "boardLine",
                sourceHandle: e.source.startsWith("line:")
                  ? "center"
                  : e.sourceHandle,
                targetHandle: e.target.startsWith("line:")
                  ? "center"
                  : e.targetHandle,
                style: { ...e.style, opacity: fade("line:" + e.id) },
                hidden: fade("line:" + e.id) === 0,
                data: { ...e.data, route: e.type, anchor: reportAnchor },
              }))}
              edgeTypes={edgeTypes}
              onEdgeClick={(_, e) => {
                if (tool === "connect") connectTo("line:" + e.id);
              }}
              nodeTypes={nodeTypes}
              viewport={board.viewport}
              onViewportChange={(viewport) =>
                setBoard((b) => ({ ...b, viewport }))
              }
              onNodesChange={(changes) =>
                setBoard((b) => ({
                  ...b,
                  nodes: applyNodeChanges(
                    changes.filter(
                      (change) =>
                        !("id" in change) || !change.id.startsWith("line:"),
                    ),
                    b.nodes,
                  ),
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
                if (tool === "connect") connectTo(node.id);
              }}
              onPaneClick={(e) => {
                if (leavingText.current) {
                  leavingText.current = false;
                  return;
                }
                if (
                  tool !== "write" &&
                  tool !== "connect" &&
                  tool !== "paint"
                ) {
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
              {board.grid && (
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
              const node = document
                .elementsFromPoint(e.clientX, e.clientY)
                .map((el) => el.closest(".react-flow__node"))
                .find(Boolean);
              shapeHit.current = node?.getAttribute("data-id") ?? null;
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
              if (shapeHit.current && !leavingText.current) {
                const hit = shapeHit.current;
                setBoard((b) => ({
                  ...b,
                  nodes: b.nodes.map((n) => ({
                    ...n,
                    selected: n.id === hit,
                  })),
                }));
                drawing.current = null;
                setDraft(null);
                setStroke([]);
                return;
              }
              const w = Math.abs(e.clientX - start.x),
                h = Math.abs(e.clientY - start.y),
                drag = w > 8 || h > 8;
              if (!drag && (tool === "ink" || leavingText.current)) {
                drawing.current = null;
                setDraft(null);
                setStroke([]);
                return;
              }
              if (tool === "ink") {
                const raw = strokePoints.current;
                const points =
                  preferences.pen.straight && raw.length > 1
                    ? [raw[0], raw[raw.length - 1]]
                    : preferences.pen.smooth
                      ? raw.map((point, i) => {
                          if (!i || i === raw.length - 1) return point;
                          return [
                            (raw[i - 1][0] + point[0] * 2 + raw[i + 1][0]) / 4,
                            (raw[i - 1][1] + point[1] * 2 + raw[i + 1][1]) / 4,
                          ] as [number, number];
                        })
                      : raw;
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
                      fill: preferences.pen.color,
                      strokeWidth: preferences.pen.width,
                      opacity: preferences.pen.opacity,
                      inkStyle: preferences.pen.style,
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
              stroke={preferences.pen.color}
              strokeWidth={preferences.pen.width}
              opacity={preferences.pen.opacity}
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
              <label>
                Schrifthintergrund{" "}
                <input
                  type="color"
                  value={
                    data.textBackground && data.textBackground !== "transparent"
                      ? data.textBackground
                      : "#ffffff"
                  }
                  onChange={(e) => format({ textBackground: e.target.value })}
                />
                <button
                  onClick={() => format({ textBackground: "transparent" })}
                >
                  Transparent
                </button>
              </label>
              <label>
                Deckkraft{" "}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={data.opacity ?? 1}
                  onChange={(e) => format({ opacity: +e.target.value })}
                />
              </label>
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
                    step={1}
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
                    step={5}
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
              <fieldset className="lm-edge-label-options">
                <legend>Beschriftung</legend>
                <input
                  aria-label="Linienbeschriftung"
                  placeholder="Linienbeschriftung"
                  maxLength={160}
                  value={caption.text}
                  onChange={(e) => setCaption({ text: e.target.value })}
                />
                <label>
                  Winkel{" "}
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step={5}
                    value={caption.angle}
                    onChange={(e) =>
                      setCaption({
                        angle: Math.max(-180, Math.min(180, +e.target.value)),
                      })
                    }
                  />
                </label>
                <label>
                  Größe{" "}
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={caption.size}
                    onChange={(e) =>
                      setCaption({
                        size: Math.max(8, Math.min(72, +e.target.value)),
                      })
                    }
                  />
                </label>
                <label>
                  Schrift{" "}
                  <select
                    value={caption.font}
                    onChange={(e) => setCaption({ font: e.target.value })}
                  >
                    {boardFonts.map((font) => (
                      <option key={font}>{font}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Textfarbe{" "}
                  <input
                    type="color"
                    value={caption.color}
                    onChange={(e) => setCaption({ color: e.target.value })}
                  />
                </label>
                <label>
                  Schrifthintergrund{" "}
                  <input
                    type="color"
                    value={
                      caption.background === "transparent"
                        ? "#ffffff"
                        : caption.background
                    }
                    onChange={(e) => setCaption({ background: e.target.value })}
                  />
                </label>
                <button
                  onClick={() => setCaption({ background: "transparent" })}
                >
                  Transparent
                </button>
                <button
                  aria-pressed={caption.bold}
                  onClick={() => setCaption({ bold: !caption.bold })}
                >
                  Fett
                </button>
                <button
                  aria-pressed={caption.italic}
                  onClick={() => setCaption({ italic: !caption.italic })}
                >
                  Kursiv
                </button>
              </fieldset>
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
              <select
                aria-label="Pfeilspitzen"
                value={
                  edge.markerStart ? "both" : edge.markerEnd ? "end" : "none"
                }
                onChange={(e) => {
                  const marker = {
                    type: "arrowclosed" as never,
                    color: String(edge.style?.stroke),
                  };
                  formatEdge({
                    markerEnd: e.target.value === "none" ? undefined : marker,
                    markerStart: e.target.value === "both" ? marker : undefined,
                  });
                }}
              >
                <option value="none">Ohne Pfeil</option>
                <option value="end">Einseitiger Pfeil</option>
                <option value="both">Beidseitiger Pfeil</option>
              </select>
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
        {(toolMenu || tool === "connect" || tool === "ink") && (
          <div className="lm-tool-options">
            {tool === "connect" && (
              <>
                <label>
                  Form{" "}
                  <select
                    value={connection.type}
                    onChange={(e) =>
                      setConnectionOverride({
                        ...connection,
                        type: e.target.value,
                      })
                    }
                  >
                    <option value="default">Geschwungen</option>
                    <option value="straight">Gerade</option>
                    <option value="smoothstep">Abgewinkelt</option>
                  </select>
                </label>
                <label>
                  Strich{" "}
                  <select
                    value={connection.dash}
                    onChange={(e) =>
                      setConnectionOverride({
                        ...connection,
                        dash: e.target.value,
                      })
                    }
                  >
                    <option value="">Durchgezogen</option>
                    <option value="7 5">Gestrichelt</option>
                    <option value="2 5">Gepunktet</option>
                  </select>
                </label>
                <label>
                  Pfeile{" "}
                  <select
                    value={connection.arrows}
                    onChange={(e) =>
                      setConnectionOverride({
                        ...connection,
                        arrows: e.target.value,
                      })
                    }
                  >
                    <option value="none">Keine</option>
                    <option value="end">Einseitig</option>
                    <option value="both">Beidseitig</option>
                  </select>
                </label>
                <label>
                  Farbe{" "}
                  <input
                    type="color"
                    value={connection.color}
                    onChange={(e) =>
                      setConnectionOverride({
                        ...connection,
                        color: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Stärke{" "}
                  <input
                    type="range"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={connection.width}
                    onChange={(e) =>
                      setConnectionOverride({
                        ...connection,
                        width: +e.target.value,
                      })
                    }
                  />
                </label>
                <button onClick={() => updatePreferences({ connection })}>
                  Als Standard
                </button>
              </>
            )}
            {tool === "ink" && (
              <>
                <label>
                  Stift{" "}
                  <select
                    value={preferences.pen.style}
                    onChange={(e) => {
                      const styles: Record<string, [number, number]> = {
                        pen: [3, 1],
                        brush: [9, 0.9],
                        marker: [12, 0.34],
                        felt: [6, 1],
                        water: [11, 0.42],
                      };
                      const [width, opacity] = styles[e.target.value];
                      updatePreferences({
                        pen: {
                          ...preferences.pen,
                          style: e.target.value,
                          width,
                          opacity,
                        },
                      });
                    }}
                  >
                    <option value="pen">Stift</option>
                    <option value="brush">Pinsel</option>
                    <option value="marker">Textmarker</option>
                    <option value="felt">Filzstift</option>
                    <option value="water">Wasserfarbe</option>
                  </select>
                </label>
                <label>
                  Farbe{" "}
                  <input
                    type="color"
                    value={preferences.pen.color}
                    onChange={(e) =>
                      updatePreferences({
                        pen: { ...preferences.pen, color: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Dicke{" "}
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={preferences.pen.width}
                    onChange={(e) =>
                      updatePreferences({
                        pen: { ...preferences.pen, width: +e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Deckkraft{" "}
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={preferences.pen.opacity}
                    onChange={(e) =>
                      updatePreferences({
                        pen: { ...preferences.pen, opacity: +e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.pen.smooth}
                    onChange={(e) =>
                      updatePreferences({
                        pen: { ...preferences.pen, smooth: e.target.checked },
                      })
                    }
                  />{" "}
                  Glätten
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.pen.straight}
                    onChange={(e) =>
                      updatePreferences({
                        pen: { ...preferences.pen, straight: e.target.checked },
                      })
                    }
                  />{" "}
                  Gerade Linie
                </label>
              </>
            )}
            {toolMenu === "image" && (
              <button onClick={() => fileInput.current?.click()}>
                Bild auswählen
              </button>
            )}
            {toolMenu && (
              <button
                title="Aus Leiste entfernen"
                aria-label="Aus Leiste entfernen"
                onClick={() => {
                  updatePreferences({
                    hidden: [...preferences.hidden, toolMenu],
                  });
                  setToolMenu(null);
                  setTool("write");
                }}
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              aria-label="Werkzeugoptionen schließen"
              onClick={() => {
                setToolMenu(null);
                setTool("write");
              }}
            >
              <X size={17} />
            </button>
          </div>
        )}
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
            .filter(
              ({ id }) =>
                !hiddenTools.includes(id) && !preferences.hidden.includes(id),
            )
            .sort(
              (a, b) =>
                (preferences.order.indexOf(a.id) + 1 ||
                  100 + tools.indexOf(a)) -
                (preferences.order.indexOf(b.id) + 1 || 100 + tools.indexOf(b)),
            )
            .map(({ id, label, Icon }) => (
              <button
                key={id}
                title={label}
                aria-label={label}
                aria-pressed={tool === id}
                className={tool === id ? "active" : ""}
                disabled={!storage.ready}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("application/x-lifemap-tool", id)
                }
                onDragOver={(e) => {
                  if (
                    e.dataTransfer.types.includes("application/x-lifemap-tool")
                  )
                    e.preventDefault();
                }}
                onDrop={(e) => {
                  const moved = e.dataTransfer.getData(
                    "application/x-lifemap-tool",
                  );
                  if (!moved || moved === id) return;
                  e.preventDefault();
                  const order = (
                    preferences.order.length
                      ? preferences.order
                      : tools.map((t) => t.id)
                  ).filter((t) => t !== moved);
                  order.splice(order.indexOf(id), 0, moved);
                  updatePreferences({ order });
                }}
                onClick={() => {
                  setToolMenu(toolMenu === id ? null : id);
                  if (id === "image") return;
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
