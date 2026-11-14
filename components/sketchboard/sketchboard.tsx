"use client";
import ColorSwatches from "@/components/color-swatches";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  Fragment,
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
  Link2,
  Brush,
  Highlighter,
  Pencil,
  Droplet,
  Eraser,
  Diamond,
  Type,
  StickyNote,
  Waypoints,
  Group,
  Check,
  Palette,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Scan,
  Grid2X2,
  Underline,
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
  FolderPlus,
  FileText,
  Video,
  PanelsTopLeft,
  Smile,
} from "lucide-react";
import {
  emptyBoard,
  minimumInteractiveZoom,
  validateBoard,
  emptyLineLabel,
  type LineLabel,
  newShape,
  palette,
  duplicateSelection,
  type Board,
  connectionWeight,
  type UnderlineStyle,
  type BoardJump,
  type ShapeData,
  type ShapeKind,
  type ShapeNode,
} from "@/lib/sketchboard";
import {
  boardFonts,
  validMedia,
  validPicture,
  validPoints,
} from "@/lib/sketchboard";
import { smoothStroke } from "./smooth-stroke";
import { BoardEdge, boardEdgePath } from "./board-edge";
import { useBoardStorage } from "./use-board-storage";
import { notebookTitle } from "@/components/notebook-navigation";
import { readNoteLines } from "@/components/planner-notepad";
import { notebookFolder } from "@/lib/notebook";
import { StickyPaper, stickyStyles } from "./sticky-paper";
import { SymbolArt, symbols } from "./symbols";
import { listenForViewSwipe } from "@/lib/lifemap-swipe";
import "@xyflow/react/dist/style.css";
import "./sketchboard.css";

type Tool =
  | "web-link"
  | "jump"
  | "eraser"
  | "symbols"
  | "write"
  | "paint"
  | "select"
  | "hand"
  | "connect"
  | ShapeKind;
const initialPoints: [number, number][] = [
  [12, 12],
  [88, 12],
  [94, 85],
  [10, 90],
];
const preferenceKey = "lifemap-board-tools";
function LineSample({ value }: { value: string }) {
  return (
    <svg
      width="30"
      height="18"
      viewBox="0 0 30 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d={
          value === "default"
            ? "M3 14C13 14 17 4 27 4"
            : value === "step" || value === "smoothstep"
              ? "M3 14H15V4H27"
              : "M3 9H27"
        }
        strokeDasharray={
          value === "7 5" ? "5 3" : value === "2 5" ? "1 3" : undefined
        }
      />
      {(value === "end" || value === "both") && <path d="M22 5l5 4-5 4" />}
      {value === "both" && <path d="M8 5L3 9l5 4" />}
    </svg>
  );
}
function GroupFrame({
  left,
  top,
  width,
  height,
  onStart,
  onScale,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  onStart: () => void;
  onScale: (scale: number) => void;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    scale: (n: number) => void;
  } | null>(null);
  return (
    <div className="lm-group-frame" style={{ left, top, width, height }}>
      <button
        type="button"
        aria-label="Gruppe skalieren"
        onPointerDown={(e) => {
          onStart();
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            width,
            height,
            scale: onScale,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const delta =
            ((e.clientX - d.x) * d.width + (e.clientY - d.y) * d.height) /
            Math.max(1, d.width * d.width + d.height * d.height);
          d.scale(Math.max(0.05, Math.min(20, 1 + delta)));
        }}
      />
    </div>
  );
}
function FormatSamples({
  name,
  value,
  onChange,
  rounded = false,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
  rounded?: boolean;
}) {
  const values = rounded ? [0, 32, 96] : [1, 3, 7];
  const closest = values.reduce((a, b) =>
    Math.abs(a - value) <= Math.abs(b - value) ? a : b,
  );
  return (
    <span className="line-options" role="group" aria-label={name}>
      {values.map((n, i) => (
        <button
          type="button"
          key={n}
          title={
            rounded
              ? ["Eckig", "Leicht gerundet", "Stark gerundet"][i]
              : ["Dünn", "Mittel", "Dick"][i]
          }
          aria-label={name + " " + (i + 1)}
          aria-pressed={n === closest}
          onClick={() => onChange(n)}
        >
          <svg
            width="28"
            height="19"
            viewBox="0 0 28 19"
            fill="none"
            stroke="currentColor"
          >
            {rounded ? (
              <rect
                x="4"
                y="3"
                width="20"
                height="13"
                rx={i * 3}
                strokeWidth="1.5"
              />
            ) : (
              <path d="M4 9.5h20" strokeWidth={n} strokeLinecap="round" />
            )}
          </svg>
        </button>
      ))}
    </span>
  );
}
function PatternSample({ style }: { style?: UnderlineStyle }) {
  return (
    <svg
      width="28"
      height="18"
      viewBox="0 0 28 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      {style === "wavy" ? (
        <path d="M3 9q3-6 6 0t6 0t6 0t5 0" />
      ) : style === "double" ? (
        <path d="M3 6h22M3 12h22" />
      ) : style ? (
        <path
          d="M3 9h22"
          strokeDasharray={style === "dashed" ? "4 3" : undefined}
        />
      ) : (
        <path d="m10 5 8 8m0-8-8 8" />
      )}
    </svg>
  );
}
function UnderlinePicker({
  value,
  onChange,
  border = false,
}: {
  border?: boolean;
  value?: UnderlineStyle;
  onChange: (style?: UnderlineStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="lm-underline-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={border ? "Randart" : "Unterstreichung"}
        aria-pressed={!!value}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {border ? (
          <PatternSample style={value ?? "solid"} />
        ) : (
          <Underline size={15} />
        )}
      </button>
      {open && (
        <span
          role="group"
          aria-label={border ? "Randart" : "Art der Unterstreichung"}
        >
          {(
            [
              ["solid", "Einfach"],
              ["wavy", "Geschlängelt"],
              ["dashed", "Gestrichelt"],
              ["double", "Doppellinie"],
              [undefined, "Keine"],
            ] as const
          ).map(([style, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={value === style}
              aria-label={label}
              title={label}
              onClick={() => {
                onChange(style);
                setOpen(false);
              }}
            >
              <PatternSample style={style} />
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
function StandardButton({
  onSave,
  saved = false,
}: {
  onSave: () => void;
  saved?: boolean;
}) {
  return (
    <button
      type="button"
      className="lm-standard"
      title="Als Standard speichern"
      onClick={onSave}
      aria-pressed={saved}
    >
      <Check size={16} aria-hidden /> Standard
    </button>
  );
}
const defaults = {
  elementStyles: {} as Partial<Record<ShapeKind, Partial<ShapeData>>>,
  lineCaption: null as Omit<LineLabel, "text"> | null,
  paint: { mode: "fill", opacity: 1, width: 2, color: palette[0] },
  symbol: "Sonne",
  corkConnection: {
    type: "default",
    color: "#ad303b",
    width: 9,
    dash: "",
    arrows: "none",
  },
  accent: "#9360c9",
  paletteStyle: "pastel",
  connectionVersion: 1,
  order: [] as string[],
  connection: {
    type: "default",
    color: "#8b8797",
    width: 9,
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
  textStyle: "regular",
  underlineStyle: undefined as UnderlineStyle | undefined,
  hiddenTemplates: [] as string[],
  hiddenSymbols: [] as string[],
  symbolOrder: [] as string[],
  templateOrder: [] as string[],
  size: 17,
  background: "",
  pattern: "plain",
  hidden: ["text"] as string[],
  toolbarVersion: 1,
  toolbarOrder: [] as string[],
  recent: initialPoints,
  pinned: null as PolygonPoint[] | null,
  recentForms: [] as PolygonPoint[][],
  pinnedForms: [] as PolygonPoint[][],
};
function OvalIcon({
  size = 21,
  strokeWidth = 1.6,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden
    >
      <ellipse cx="12" cy="12" rx="9" ry="6" />
    </svg>
  );
}
function FreeformIcon({
  size = 21,
  strokeWidth = 1.6,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden
    >
      <path d="m4 17 3-12 13 3 1 12Z" />
      {[
        [4, 17],
        [7, 5],
        [20, 8],
        [21, 20],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="1.8" fill="var(--lm-panel,white)" />
      ))}
    </svg>
  );
}
function creationStroke(width: number, zoom: number) {
  return width * Math.pow(zoom, -0.8);
}
function galleryOrder(items: string[], saved: string[]) {
  return [
    ...saved.filter((id) => items.includes(id)),
    ...items.filter((id) => !saved.includes(id)),
  ];
}
function moveGalleryItem(items: string[], source: string, target: string) {
  if (!items.includes(source) || source === target) return items;
  const next = items.filter((id) => id !== source);
  next.splice(next.indexOf(target), 0, source);
  return next;
}
const tools = [
  { id: "write", label: "Schreiben und verschieben", Icon: Type },
  { id: "ink", label: "Stift", Icon: PenTool },
  { id: "polygon", label: "Freie Form erstellen", Icon: FreeformIcon },
  { id: "symbols", label: "Symbole", Icon: Smile },
  { id: "paint", label: "Färber", Icon: Palette },
  { id: "select", label: "Auswahl (A)", Icon: MousePointer2 },
  { id: "hand", label: "Verschieben (H)", Icon: Hand },
  { id: "rectangle", label: "Rechteck", Icon: Square },
  {
    id: "rounded",
    label: "Abgerundetes Rechteck (R)",
    Icon: RectangleHorizontal,
  },
  { id: "circle", label: "Kreis", Icon: Circle },
  { id: "ellipse", label: "Oval (O)", Icon: OvalIcon },
  { id: "diamond", label: "Raute", Icon: Diamond },
  { id: "sticky", label: "Notiz (N)", Icon: StickyNote },
  { id: "text", label: "Text (T)", Icon: Type },
  { id: "connect", label: "Verbindung (L)", Icon: Waypoints },
  { id: "jump", label: "Interner Sprungbutton", Icon: Link2 },
  { id: "image", label: "Medium einfügen", Icon: ImagePlus },
] as const;
function StoredPanel({
  name,
  className,
  label,
  style,
  children,
}: {
  name: string;
  className: string;
  label: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("lifemap-panel-" + name) || "null",
        );
      } catch {
        return null;
      }
    },
  );
  const drag = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
  } | null>(null);
  const panel = useRef<HTMLElement>(null);
  const [formatScale, setFormatScale] = useState(() => {
    try {
      return Number(localStorage.getItem("lifemap-format-scale")) || 1;
    } catch {
      return 1;
    }
  });
  return (
    <section
      ref={panel}
      className={className + " lm-resizable-panel"}
      aria-label={label}
      style={{
        ...style,
        ...(name === "element" &&
        typeof style?.left === "number" &&
        typeof style.top === "number"
          ? { left: style.left / formatScale, top: style.top / formatScale }
          : {}),
        ...(name === "element"
          ? {
              width: Math.min(
                size?.width ?? 310,
                (innerWidth - 16) / formatScale,
              ),
              height: size?.height,
              zoom: formatScale,
              fontSize: 12,
            }
          : {}),
        ...(size && name !== "element"
          ? {
              width: Math.min(size.width, innerWidth - 16),
              height: size.height,
            }
          : {}),
        overflow: "auto",
      }}
    >
      {children}
      <button
        type="button"
        aria-label="Fenstergröße ändern"
        title="Fenstergröße ändern"
        className="lm-panel-resize"
        onPointerDown={(e) => {
          const bounds = panel.current!.getBoundingClientRect();
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            width: bounds.width,
            height: bounds.height,
            scale: formatScale,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          if (name === "element") {
            const dx = e.clientX - start.x,
              dy = e.clientY - start.y;
            const diagonal =
              dx * dy > 0 &&
              Math.min(Math.abs(dx), Math.abs(dy)) >
                Math.max(Math.abs(dx), Math.abs(dy)) * 0.36;
            const scale = diagonal
              ? Math.max(
                  0.65,
                  Math.min(
                    1.8,
                    start.scale *
                      (1 + (dx + dy) / (start.width + start.height)),
                  ),
                )
              : start.scale;
            const next = {
              width: Math.max(
                165,
                Math.min((innerWidth - 16) / scale, (start.width + dx) / scale),
              ),
              height: Math.max(
                85,
                Math.min(
                  (innerHeight * 0.72) / scale,
                  (start.height + dy) / scale,
                ),
              ),
            };
            setFormatScale(scale);
            setSize(next);
            localStorage.setItem("lifemap-format-scale", String(scale));
            localStorage.setItem("lifemap-panel-" + name, JSON.stringify(next));
            return;
          }
          const next = {
            width: Math.max(
              180,
              Math.min(innerWidth - 16, start.width + e.clientX - start.x),
            ),
            height: Math.max(
              100,
              Math.min(innerHeight * 0.72, start.height + e.clientY - start.y),
            ),
          };
          setSize(next);
          localStorage.setItem("lifemap-panel-" + name, JSON.stringify(next));
        }}
        onDoubleClick={() => {
          setSize(null);
          if (name === "element") {
            setFormatScale(1);
            localStorage.removeItem("lifemap-format-scale");
          }
          localStorage.removeItem("lifemap-panel-" + name);
        }}
      >
        ◢
      </button>
    </section>
  );
}
type PolygonPoint = [number, number];

type Point = { x: number; y: number };
type Side = "top" | "right" | "bottom" | "left";
function rotateAroundNode(
  node: ShapeNode,
  point: Point,
  degrees: number,
): Point {
  if (!degrees) return point;
  const x = node.position.x + (node.width ?? 0) / 2,
    y = node.position.y + (node.height ?? 0) / 2;
  const angle = (degrees * Math.PI) / 180,
    c = Math.cos(angle),
    sin = Math.sin(angle);
  return {
    x: x + (point.x - x) * c - (point.y - y) * sin,
    y: y + (point.x - x) * sin + (point.y - y) * c,
  };
}
function connectionSide(node: ShapeNode, worldPoint: Point) {
  const point = rotateAroundNode(node, worldPoint, -(node.data.rotation ?? 0));
  const w = node.width || 1,
    h = node.height || 1;
  const x = Math.max(0, Math.min(1, (point.x - node.position.x) / w));
  const y = Math.max(0, Math.min(1, (point.y - node.position.y) / h));
  const sides: [Side, number, number][] = [
    ["left", x * w, y],
    ["right", (1 - x) * w, y],
    ["top", y * h, x],
    ["bottom", (1 - y) * h, x],
  ];
  return sides.reduce((best, side) => (side[1] < best[1] ? side : best));
}
function connectionPoint(node: ShapeNode, side: Side, offset: number): Point {
  const horizontal = side === "top" || side === "bottom";
  const x = horizontal ? offset : side === "left" ? 0 : 1;
  const y = horizontal ? (side === "top" ? 0 : 1) : offset;
  const dx = x - 0.5,
    dy = y - 0.5;
  let scale = 1;
  if (node.data.kind === "ellipse" || node.data.kind === "circle")
    scale = 0.5 / Math.hypot(dx, dy);
  if (node.data.points && node.data.kind === "polygon") {
    const points = node.data.points;
    let nearest = Infinity;
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i].map((value) => value / 100 - 0.5);
      const [bx, by] = points[(i + 1) % points.length].map(
        (value) => value / 100 - 0.5,
      );
      const ex = bx - ax,
        ey = by - ay,
        divisor = dx * ey - dy * ex;
      if (Math.abs(divisor) < 1e-9) continue;
      const distance = (ax * ey - ay * ex) / divisor;
      const along = (ax * dy - ay * dx) / divisor;
      if (distance > 0 && along >= 0 && along <= 1)
        nearest = Math.min(nearest, distance);
    }
    if (Number.isFinite(nearest)) scale = nearest;
  }
  if (node.data.kind === "diamond") scale = 0.5 / (Math.abs(dx) + Math.abs(dy));
  return rotateAroundNode(
    node,
    {
      x: node.position.x + (0.5 + dx * scale) * (node.width || 1),
      y: node.position.y + (0.5 + dy * scale) * (node.height || 1),
    },
    node.data.rotation ?? 0,
  );
}
const elementPalettes = {
  pastel: { label: "Pastell", colors: palette },
  vivid: {
    label: "Kräftig",
    colors: ["#8951e3", "#df4268", "#f27c32", "#f2c936", "#36a66d", "#318cda"],
  },
  earthy: {
    label: "Erdtöne",
    colors: ["#a98cbe", "#ba7363", "#d5955d", "#cfbb7e", "#829760", "#638d91"],
  },
  muted: {
    label: "Gedämpft",
    colors: ["#b0a0be", "#c18e99", "#c9a58e", "#c8b67b", "#8eac9a", "#839fbb"],
  },
};
const formTemplates: [string, PolygonPoint[]][] = [
  [
    "Dreieck",
    [
      [50, 4],
      [96, 94],
      [4, 94],
    ],
  ],
  [
    "Trapez",
    [
      [25, 10],
      [75, 10],
      [96, 90],
      [4, 90],
    ],
  ],
  [
    "Parallelogramm",
    [
      [28, 10],
      [96, 10],
      [72, 90],
      [4, 90],
    ],
  ],
  [
    "Fünfeck",
    [
      [50, 4],
      [96, 38],
      [79, 94],
      [21, 94],
      [4, 38],
    ],
  ],
  [
    "Sechseck",
    [
      [25, 7],
      [75, 7],
      [98, 50],
      [75, 93],
      [25, 93],
      [2, 50],
    ],
  ],
  [
    "Achteck",
    [
      [30, 4],
      [70, 4],
      [96, 30],
      [96, 70],
      [70, 96],
      [30, 96],
      [4, 70],
      [4, 30],
    ],
  ],
  [
    "Stern",
    [
      [50, 4],
      [64, 34],
      [97, 39],
      [73, 63],
      [79, 96],
      [50, 80],
      [21, 96],
      [27, 63],
      [3, 39],
      [36, 34],
    ],
  ],
  [
    "Kreuz",
    [
      [34, 4],
      [66, 4],
      [66, 34],
      [96, 34],
      [96, 66],
      [66, 66],
      [66, 96],
      [34, 96],
      [34, 66],
      [4, 66],
      [4, 34],
      [34, 34],
    ],
  ],
  [
    "Pfeil",
    [
      [4, 34],
      [54, 34],
      [54, 7],
      [96, 50],
      [54, 93],
      [54, 66],
      [4, 66],
    ],
  ],
  [
    "Wimpel",
    [
      [5, 8],
      [95, 8],
      [74, 50],
      [95, 92],
      [5, 92],
    ],
  ],
  [
    "Schild",
    [
      [6, 6],
      [94, 6],
      [87, 68],
      [50, 97],
      [13, 68],
    ],
  ],
  [
    "Sprechblase",
    [
      [5, 5],
      [95, 5],
      [95, 72],
      [49, 72],
      [23, 96],
      [25, 72],
      [5, 72],
    ],
  ],
  [
    "Halbkreis",
    [
      [3, 90],
      [8, 60],
      [20, 33],
      [35, 17],
      [50, 11],
      [65, 17],
      [80, 33],
      [92, 60],
      [97, 90],
    ],
  ],
  [
    "Drachen",
    [
      [50, 3],
      [94, 35],
      [50, 97],
      [6, 35],
    ],
  ],
  [
    "Haus",
    [
      [5, 45],
      [50, 5],
      [95, 45],
      [95, 95],
      [5, 95],
    ],
  ],
  [
    "Winkelpfeil",
    [
      [4, 8],
      [53, 8],
      [96, 50],
      [53, 92],
      [4, 92],
      [47, 50],
    ],
  ],
  [
    "Sanduhr",
    [
      [6, 6],
      [94, 6],
      [63, 50],
      [94, 94],
      [6, 94],
      [37, 50],
    ],
  ],
  [
    "Stufen",
    [
      [5, 68],
      [36, 68],
      [36, 37],
      [67, 37],
      [67, 6],
      [95, 6],
      [95, 95],
      [5, 95],
    ],
  ],
  [
    "Blitz",
    [
      [44, 3],
      [83, 3],
      [62, 39],
      [94, 39],
      [32, 98],
      [47, 57],
      [9, 57],
    ],
  ],
  [
    "Doppelpfeil",
    [
      [3, 50],
      [27, 15],
      [27, 34],
      [73, 34],
      [73, 15],
      [97, 50],
      [73, 85],
      [73, 66],
      [27, 66],
      [27, 85],
    ],
  ],
  [
    "L-Form",
    [
      [5, 5],
      [40, 5],
      [40, 60],
      [95, 60],
      [95, 95],
      [5, 95],
    ],
  ],
  [
    "Lesezeichen",
    [
      [7, 5],
      [93, 5],
      [93, 96],
      [50, 72],
      [7, 96],
    ],
  ],
];

function FormPreview({ points }: { points: PolygonPoint[] }) {
  return (
    <svg viewBox="-5 -5 110 110" width="22" height="22" aria-hidden>
      <polygon
        points={points.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function straightenForm(points: PolygonPoint[]): PolygonPoint[] {
  // Match familiar outlines across rotations and drawing directions.
  const candidates = [
    ...formTemplates.map(([, outline]) => outline),
    [
      [4, 4],
      [96, 4],
      [96, 96],
      [4, 96],
    ] as PolygonPoint[],
    [
      [50, 4],
      [96, 50],
      [50, 96],
      [4, 50],
    ] as PolygonPoint[],
  ];
  let error = 19;
  let closest: PolygonPoint[] | undefined;
  for (const template of candidates.filter(
    (outline) => outline.length === points.length,
  )) {
    for (const outline of [template, [...template].reverse()]) {
      for (let offset = 0; offset < outline.length; offset++) {
        const ordered = points.map(
          (_, i) => outline[(i + offset) % outline.length],
        );
        const distance = Math.sqrt(
          points.reduce(
            (sum, [x, y], i) =>
              sum + (x - ordered[i][0]) ** 2 + (y - ordered[i][1]) ** 2,
            0,
          ) / points.length,
        );
        if (distance >= error) continue;
        closest = ordered;
        error = distance;
      }
    }
  }
  if (closest) return closest;
  // Align nearly horizontal and vertical edges while retaining the silhouette.
  return points.map(([x, y], i) => {
    const adjacent = [points.at(i - 1)!, points[(i + 1) % points.length]];
    const aligned = (axis: 0 | 1, value: number) => {
      const matching = adjacent.filter(
        (p) =>
          Math.abs(p[axis] - value) <= 10 &&
          Math.abs(p[1 - axis] - points[i][1 - axis]) > 12,
      );
      return (
        (value + matching.reduce((sum, p) => sum + p[axis], 0)) /
        (matching.length + 1)
      );
    };
    return [aligned(0, x), aligned(1, y)];
  });
}
const hiddenTools = ["write", "select", "hand", "rounded"];
function wavyFrame() {
  const points: string[] = [];
  for (let i = 0; i < 96; i++) {
    const side = Math.floor(i / 24),
      t = (i % 24) * 4,
      ripple = i % 2 === 0 ? 0 : 2;
    const [x, y] =
      side === 0
        ? [2 + t, 2 + ripple]
        : side === 1
          ? [98 - ripple, 2 + t]
          : side === 2
            ? [98 - t, 98 - ripple]
            : [2 + ripple, 98 - t];
    points.push(x + "," + y);
  }
  return "M" + points.join("L") + "Z";
}
const wavyBorder = wavyFrame();
function curvedOutline(points: PolygonPoint[], close = true): string {
  if (!points.length) return "";
  const [first] = points;
  const next = close ? [...points.slice(1), first] : points.slice(1);
  return (
    "M " +
    first.join(" ") +
    next
      .map(([x, y], i) => {
        const [a, b] = points[i],
          dx = x - a,
          dy = y - b;
        return (
          " Q " +
          (a + dx / 2 - dy * 0.23) +
          " " +
          (b + dy / 2 + dx * 0.23) +
          " " +
          x +
          " " +
          y
        );
      })
      .join("") +
    (close ? " Z" : "")
  );
}
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
  link: (_id: string) => {},
  inspect: (_id: string): boolean => false,
  jump: (_jump: BoardJump) => {},
});
function Shape({ id, data, selected }: NodeProps<ShapeNode>) {
  const edit = useContext(EditContext),
    editing = edit.editing === id;
  const area = useRef<HTMLTextAreaElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = content.current;
    const text = box?.querySelector<HTMLElement>(".lm-rendered-text");
    if (!box || !text || !data.text || editing) return;
    const fit = () => {
      let low = 0.3,
        high = 1;
      text.style.fontSize = "1em";
      if (box.scrollHeight <= box.clientHeight + 1) return;
      for (let i = 0; i < 7; i++) {
        const mid = (low + high) / 2;
        text.style.fontSize = mid + "em";
        if (box.scrollHeight > box.clientHeight + 1) high = mid;
        else low = mid;
      }
      text.style.fontSize = low + "em";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [data.text, data.fontSize, data.font, data.bold, data.italic, editing]);
  const titleField = useRef<HTMLInputElement>(null);
  const breakAt = data.text.indexOf("\n");
  const heading = breakAt < 0 ? data.text : data.text.slice(0, breakAt);
  const body = breakAt < 0 ? "" : data.text.slice(breakAt + 1);
  useEffect(() => {
    if (editing) {
      const input = titleField.current;
      input?.focus();
      if (input)
        input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [editing]);
  const style: CSSProperties = {
    background: data.fill,
    borderColor: data.stroke,
    borderStyle: data.borderStyle === "wavy" ? "none" : data.borderStyle,
    boxSizing: "border-box",
    borderWidth: data.strokeWidth,
    borderRadius:
      data.kind === "ellipse" || data.kind === "circle" ? "50%" : data.radius,
  };
  const warpPoints: [number, number][] | undefined =
    data.points ??
    (data.kind === "diamond"
      ? [
          [50, 1],
          [99, 50],
          [50, 99],
          [1, 50],
        ]
      : ["rectangle", "rounded", "sticky"].includes(data.kind)
        ? [
            [1, 1],
            [99, 1],
            [99, 99],
            [1, 99],
          ]
        : data.kind === "ellipse"
          ? Array.from({ length: 8 }, (_, i) => [
              50 + 49 * Math.cos((i * Math.PI) / 4),
              50 + 49 * Math.sin((i * Math.PI) / 4),
            ])
          : undefined);
  return (
    <div
      style={{ rotate: data.rotation ? data.rotation + "deg" : undefined }}
      className={`lm-shape lm-${data.kind}${selected ? " lm-selected" : ""}`}
      data-paper={data.paper ?? "plain"}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (edit.inspect(id)) return;
        if (!["image", "ink", "media", "symbol"].includes(data.kind))
          edit.begin(id);
      }}
    >
      <button
        type="button"
        className="lm-node-link nodrag nopan"
        aria-label="Verbindung beginnen"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          edit.link(id);
        }}
      >
        <Waypoints size={15} />
      </button>
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={60}
        minHeight={50}
        maxWidth={10000}
        maxHeight={10000}
        color="#9774d1"
        onResizeStart={() => edit.checkpoint()}
      />
      {!editing &&
        data.kind !== "ink" &&
        warpPoints?.map(([x, y], index) => (
          <button
            key={index}
            type="button"
            className="lm-warp-point nodrag nopan"
            aria-label={`Eckpunkt ${index + 1} verzerren`}
            style={{ left: x + "%", top: y + "%" }}
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              edit.checkpoint();
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const bounds =
                e.currentTarget.parentElement!.getBoundingClientRect();
              const coordinate = (v: number) =>
                Math.max(-200, Math.min(300, v * 100));
              edit.patch(id, {
                kind: "polygon",
                points: warpPoints.map((point, i) =>
                  i === index
                    ? [
                        coordinate((e.clientX - bounds.left) / bounds.width),
                        coordinate((e.clientY - bounds.top) / bounds.height),
                      ]
                    : point,
                ),
              });
            }}
          />
        ))}
      {data.kind === "symbol" ? (
        <SymbolArt
          name={data.text}
          stroke={data.stroke === "transparent" ? data.color : data.stroke}
          fill={data.fill}
          width={data.strokeWidth}
        />
      ) : data.kind === "sticky" ? (
        <span className="lm-sticky-art" style={{ opacity: data.opacity ?? 1 }}>
          <StickyPaper paper={data} className="lm-sticky-surface" />
        </span>
      ) : data.media ? (
        <MediaCard
          media={data.media}
          onChange={(media) => {
            edit.checkpoint();
            edit.patch(id, { media });
          }}
        />
      ) : data.kind === "image" && data.image ? (
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
              style={{
                strokeWidth:
                  "calc(" + data.strokeWidth + "px * var(--lm-board-zoom, 1))",
              }}
              opacity={data.opacity ?? 1}
              className={"lm-ink-" + (data.inkStyle ?? "pen")}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <path
              d={
                data.curved
                  ? curvedOutline(data.points)
                  : roundedOutline(data.points, data.radius)
              }
              opacity={data.opacity ?? 1}
              fill={data.fill}
              stroke={data.stroke}
              strokeDasharray={
                data.borderStyle === "dashed"
                  ? "7 5"
                  : data.borderStyle === "wavy"
                    ? "3 2"
                    : undefined
              }
              strokeWidth={data.strokeWidth}
              style={{
                strokeWidth:
                  "calc(" + data.strokeWidth + "px * var(--lm-board-zoom, 1))",
              }}
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
            strokeDasharray={
              data.borderStyle === "dashed"
                ? "7 5"
                : data.borderStyle === "wavy"
                  ? "3 2"
                  : undefined
            }
            strokeWidth={data.strokeWidth}
            style={{
              strokeWidth:
                "calc(" + data.strokeWidth + "px * var(--lm-board-zoom, 1))",
            }}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div
          className="lm-shape-bg"
          style={{ ...style, opacity: data.opacity ?? 1 }}
        />
      )}
      {data.borderStyle === "wavy" &&
        !["sticky", "image", "media", "ink", "symbol"].includes(data.kind) && (
          <svg
            className="lm-shape-bg lm-wavy-border"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {data.kind === "circle" || data.kind === "ellipse" ? (
              <ellipse
                cx="50"
                cy="50"
                rx="48"
                ry="48"
                strokeDasharray="3 2"
                fill="none"
                stroke={data.stroke}
                strokeWidth={data.strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
            ) : data.kind === "diamond" || data.points ? null : (
              <path
                d={wavyBorder}
                fill="none"
                stroke={data.stroke}
                strokeWidth={data.strokeWidth}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      <div
        ref={content}
        className="lm-shape-content"
        onWheelCapture={(event) => {
          const box = event.currentTarget;
          if (
            !event.ctrlKey &&
            Math.abs(event.deltaY) > Math.abs(event.deltaX) * 2 &&
            box.scrollHeight > box.clientHeight &&
            ((event.deltaY > 0 &&
              box.scrollTop + box.clientHeight < box.scrollHeight - 1) ||
              (event.deltaY < 0 && box.scrollTop > 0))
          )
            event.stopPropagation();
        }}
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
          textDecorationLine:
            data.underline || data.underlineStyle ? "underline" : undefined,
          textDecorationStyle: data.underlineStyle,
          textAlign: data.align,
          justifyContent:
            data.kind === "sticky" || data.kind === "text"
              ? "flex-start"
              : "center",
        }}
      >
        {data.kind === "folder" && (
          <FolderPlus className="lm-folder-mark" size="1.25em" aria-hidden />
        )}
        {data.kind === "image" ||
        data.kind === "ink" ||
        data.kind === "media" ||
        data.kind === "symbol" ? null : editing ? (
          <div
            className="lm-live-note nodrag nopan nowheel"
            onBlur={(e) => {
              if (
                !e.currentTarget.contains(e.relatedTarget) &&
                !(
                  e.relatedTarget instanceof Element &&
                  e.relatedTarget.closest(".lm-format,.color-popup")
                )
              )
                edit.end();
            }}
          >
            <input
              ref={titleField}
              className="lm-live-title"
              maxLength={Math.max(0, 49999 - body.length)}
              style={{ background: data.textBackground }}
              aria-label="Überschrift"
              placeholder="Überschrift"
              value={heading}
              onChange={(e) =>
                edit.patch(id, {
                  text: e.target.value + (breakAt < 0 ? "" : "\n" + body),
                })
              }
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (breakAt < 0) edit.patch(id, { text: heading + "\n" });
                  area.current?.focus();
                } else if (e.key === "Escape") edit.end();
              }}
            />
            <textarea
              ref={area}
              aria-label="Text bearbeiten"
              className="nodrag nopan nowheel"
              value={body}
              placeholder="Dein Gedanke …"
              onChange={(e) =>
                edit.patch(id, {
                  text: (heading + "\n" + e.target.value).slice(0, 50000),
                })
              }
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
          </div>
        ) : (
          <span
            className={data.text ? "lm-rendered-text" : "lm-placeholder"}
            style={
              data.text
                ? {
                    background: data.textBackground,
                    display: "inline",
                    alignSelf:
                      data.align === "left"
                        ? "flex-start"
                        : data.align === "right"
                          ? "flex-end"
                          : "center",
                  }
                : { fontSize: "0.7em" }
            }
          >
            {data.text ? (
              <>
                <strong className="lm-text-heading">
                  {data.text.split("\n")[0]}
                </strong>
                {data.text.includes("\n") && (
                  <span className="lm-text-body">
                    {data.text.slice(data.text.indexOf("\n") + 1)}
                  </span>
                )}
              </>
            ) : data.kind === "sticky" ? (
              "Deine Notiz"
            ) : (
              "Doppelklick zum Schreiben"
            )}
          </span>
        )}
      </div>
      {!!data.jumps?.length && (
        <div className="lm-node-jumps nodrag nopan">
          {data.jumps
            .filter((link) => !link.sourceGroup && !link.sourceOffset)
            .map((link) => (
              <button
                type="button"
                key={link.id}
                title={link.label}
                onClick={(e) => {
                  e.stopPropagation();
                  edit.jump(link);
                }}
              >
                <Link2 size={12} />
                {link.label}
              </button>
            ))}
        </div>
      )}
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
    <>
      <Handle
        id="center"
        type="source"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
        isConnectable={false}
      />
      <Handle
        id="end"
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
        isConnectable={false}
      />
    </>
  );
}
function MediaCard({
  media,
  onChange,
}: {
  media: NonNullable<ShapeData["media"]>;
  onChange: (media: NonNullable<ShapeData["media"]>) => void;
}) {
  const [address, setAddress] = useState<string | null>(
    media.url === "https://" ? "" : null,
  );
  const editAddress = () => {
    setAddress(media.url);
  };
  const saveAddress = () => {
    try {
      const text = address?.trim();
      if (!text) return;
      const url = new URL(
        /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : "https://" + text,
      );
      const next = { ...media, url: url.href, name: url.hostname };
      if (validMedia(next)) onChange(next);
    } catch {}
    setAddress(null);
  };
  const [playing, setPlaying] = useState(false);
  const url =
    media.url === "https://" || media.url.startsWith("data:")
      ? null
      : new URL(media.url);
  const videoId =
    url &&
    (url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
            url.hostname,
          )
        ? url.searchParams.get("v") ||
          url.pathname.match(/^\/(shorts|embed)\/([^/]+)/)?.[2]
        : null);
  const thumbnail =
    videoId && /^[\w-]{11}$/.test(videoId)
      ? "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg"
      : null;
  const playable =
    media.kind === "video" && (!url || /\.(mp4|webm)$/i.test(url.pathname));
  const open = () => {
    if (media.url === "https://") {
      editAddress();
      return;
    }
    if (!url) {
      const a = document.createElement("a");
      a.href = media.url;
      a.download = media.name;
      a.click();
    } else window.open(url.href, "_blank", "noopener,noreferrer");
  };
  return (
    <div
      className="lm-media-card"
      onDoubleClick={(e) => {
        if (media.kind === "link" || (media.kind === "video" && url)) {
          e.stopPropagation();
          editAddress();
        }
      }}
    >
      {playable ? (
        <video
          className="nodrag nopan"
          controls={playing}
          preload="metadata"
          src={media.url}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setPlaying(true);
            void e.currentTarget.play().catch(() => {});
          }}
        />
      ) : thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>
          {media.kind === "document"
            ? "Dokument"
            : media.kind === "video"
              ? "Video"
              : "Link"}
        </span>
      )}
      {address !== null ? (
        <input
          className="nodrag nopan nowheel"
          aria-label="Webadresse bearbeiten"
          autoFocus
          value={address}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={saveAddress}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setAddress(null);
          }}
        />
      ) : (
        <a
          className="nodrag nopan lm-media-open"
          href={url?.href ?? "#"}
          title={media.name}
          onClick={(e) => {
            e.preventDefault();
            if (media.kind !== "link" && !(media.kind === "video" && url))
              open();
          }}
          onDoubleClick={(e) => {
            if (media.kind === "link") {
              e.stopPropagation();
              editAddress();
            }
          }}
        >
          {media.name}
        </a>
      )}
      {(media.kind === "link" || (media.kind === "video" && url)) &&
        address === null && (
          <button
            className="nodrag nopan"
            onClick={open}
            aria-label="Webseite öffnen"
          >
            ↗
          </button>
        )}
    </div>
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
type HistoryEntry = {
  board: Board;
  preferences: typeof defaults;
  tabs: Record<string, Partial<typeof defaults>>;
  symbols: string[];
};
function BoardEditor() {
  const [board, setBoard] = useState<Board>(emptyBoard),
    current = useRef(board);
  current.current = board;
  const flow = useReactFlow<ShapeNode>();
  useEffect(() => {
    const zoom = (event: WheelEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".lm-app")
      )
        return;
      const pane = document
        .querySelector(".lm-canvas")
        ?.getBoundingClientRect();
      const target = event.target;
      if (
        !pane ||
        event.clientY < pane.top ||
        event.clientY > pane.bottom ||
        event.clientX < pane.left ||
        event.clientX > pane.right ||
        target.closest(".lm-header")
      )
        return;
      if (!event.ctrlKey) {
        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        for (
          let item: Element | null = target;
          item && !item.matches(".lm-app");
          item = item.parentElement
        ) {
          const axis = horizontal ? "X" : "Y",
            delta = horizontal ? event.deltaX : event.deltaY;
          const style = getComputedStyle(item);
          if (
            !/auto|scroll/.test(
              axis === "X" ? style.overflowX : style.overflowY,
            )
          )
            continue;
          const position = horizontal ? item.scrollLeft : item.scrollTop;
          const remaining = horizontal
            ? item.scrollWidth - item.clientWidth
            : item.scrollHeight - item.clientHeight;
          if (
            remaining > 1 &&
            ((delta > 0 && position < remaining - 1) ||
              (delta < 0 && position > 0))
          )
            return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
      const current = flow.getViewport();
      if (!event.ctrlKey) {
        const scale =
          event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pane.height : 1;
        void flow.setViewport({
          ...current,
          x: current.x - event.deltaX * scale,
          y: current.y - event.deltaY * scale,
        });
        return;
      }
      const next = Math.max(
        Math.min(minimumInteractiveZoom, current.zoom),
        Math.min(4, current.zoom * Math.exp(-event.deltaY * 0.006)),
      );
      const x = event.clientX - pane.left,
        y = event.clientY - pane.top;
      void flow.setViewport({
        zoom: next,
        x: x - ((x - current.x) * next) / current.zoom,
        y: y - ((y - current.y) * next) / current.zoom,
      });
    };
    window.addEventListener("wheel", zoom, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", zoom, true);
  }, [flow]);
  const [formatPosition, setFormatPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const formatDrag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [tool, setTool] = useState<Tool>("write"),
    [editing, setEditing] = useState(""),
    [notes, setNotes] = useState(false),
    [settings, setSettings] = useState(false),
    [generalPreferences, setPreferences] = useState(defaults),
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
    history = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({
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
  useEffect(() => {
    host.current?.focus({ preventScroll: true });
  }, []);
  const storage = useBoardStorage(board, setBoard);
  const [importAt, setImportAt] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [importError, setImportError] = useState("");
  const [preview, setPreview] = useState<{
    board: Board;
    x: number;
    y: number;
    scale: number;
  } | null>(null);
  const previewDrag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const goToCalendar = async () => {
    if (await storage.finish()) location.assign("/lifemap");
  };
  const loadImport = (value: unknown) => {
    try {
      const incoming = validateBoard(value);
      if (!incoming.nodes.length)
        throw new Error("Diese LifeMap enthält keine Elemente.");
      const ids = new Map(
        incoming.nodes.map((n) => [n.id, crypto.randomUUID()]),
      );
      const lineIds = new Map(
        incoming.edges.map((e) => [e.id, crypto.randomUUID()]),
      );
      const endpoint = (id: string) =>
        id.startsWith("line:")
          ? "line:" + lineIds.get(id.slice(5))
          : ids.get(id)!;
      const point = flow.screenToFlowPosition(
        importAt ?? { x: innerWidth / 2, y: innerHeight / 2 },
      );
      setPreview({
        x: point.x,
        y: point.y,
        scale: 1,
        board: {
          ...incoming,
          nodes: incoming.nodes.map((n) => ({ ...n, id: ids.get(n.id)! })),
          edges: incoming.edges.map((e) => ({
            ...e,
            id: lineIds.get(e.id)!,
            source: endpoint(e.source),
            target: endpoint(e.target),
          })),
        },
      });
      setImportAt(null);
      setImportError("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Import fehlgeschlagen.",
      );
    }
  };
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
  const currentTab = new URLSearchParams(location.search).get("tab") || "main";
  const [settingsTab, setSettingsTab] = useState<string | null>(null);
  const [tabOverrides, setTabOverrides] = useState<
    Record<string, Partial<typeof defaults>>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("lifemap-tab-options") || "{}");
    } catch {
      return {};
    }
  });
  const preferences = { ...generalPreferences, ...tabOverrides[currentTab] };
  const configured = settingsTab
    ? { ...generalPreferences, ...tabOverrides[settingsTab] }
    : generalPreferences;
  const updateTab = (id: string, changes: Partial<typeof defaults>) => {
    checkpoint();
    const next = { ...tabOverrides, [id]: { ...tabOverrides[id], ...changes } };
    setTabOverrides(next);
    localStorage.setItem("lifemap-tab-options", JSON.stringify(next));
  };
  const updatePreferences = (changes: Partial<typeof defaults>) => {
    if (!("recent" in changes)) checkpoint();
    setPreferences((p) => {
      const next = { ...p, ...changes };
      localStorage.setItem(preferenceKey, JSON.stringify(next));
      return next;
    });
  };
  const updateSettings = (changes: Partial<typeof defaults>) =>
    settingsTab ? updateTab(settingsTab, changes) : updatePreferences(changes);
  const [connectionOverride, setConnectionOverride] = useState<
    typeof defaults.connection | null
  >(null);
  const corkMode = preferences.pattern === "cork";
  useEffect(() => setConnectionOverride(null), [corkMode]);
  const connection =
    connectionOverride ??
    (corkMode ? preferences.corkConnection : preferences.connection);
  const [toolMenu, setToolMenu] = useState<string | null>(null);
  const shapeHit = useRef<string | null>(null);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [tabs, setTabs] = useState<{ id: string; title: string }[]>(() => {
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
  const [renaming, setRenaming] = useState<string | null>(null);
  const [tabMenu, setTabMenu] = useState<string | null>(null);
  const [tabTitle, setTabTitle] = useState("");
  const saveTabs = (next: typeof tabs) => {
    setTabs(next);
    localStorage.setItem("lifemap-tabs", JSON.stringify(next));
  };
  const renameTab = () => {
    if (renaming && tabTitle.trim())
      saveTabs(
        tabs.map((t) =>
          t.id === renaming ? { ...t, title: tabTitle.trim() } : t,
        ),
      );
    setRenaming(null);
  };
  const closeTab = async (id: string) => {
    if (id === currentTab && !(await storage.finish())) return;
    const remaining = tabs.filter((t) => t.id !== id);
    if (!remaining.length)
      remaining.push({ id: crypto.randomUUID(), title: "LifeMap" });
    saveTabs(remaining);
    if (id === currentTab)
      location.assign("/lifemap/board?tab=" + remaining[0].id);
  };
  const [paintMode, setPaintMode] = useState("fill");
  const [paintOpacity, setPaintOpacity] = useState(1);
  const [paintWidth, setPaintWidth] = useState(2);
  const [penOverride, setPenOverride] = useState<typeof defaults.pen | null>(
    null,
  );
  const pen = penOverride ?? preferences.pen;
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
  type JumpLocation = Pick<BoardJump, "node" | "group" | "point">;
  type JumpDraft = {
    tab: string;
    source: JumpLocation;
    label: string;
    position?: Point;
  };
  const [jumpDraft, setJumpDraft] = useState<JumpDraft | null>(null);
  const [jumpTab, setJumpTab] = useState<string | null>(null);
  const [jumpLabel, setJumpLabel] = useState("Weiter");
  const sourceGroupFrame = jumpDraft?.source.group
    ? groupBounds(jumpDraft.source.group)
    : null;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lifemap-jump-draft");
      if (!raw) return;
      sessionStorage.removeItem("lifemap-jump-draft");
      const draft = JSON.parse(raw) as JumpDraft;
      setJumpDraft(draft);
      setJumpLabel(draft.label);
      setTool("jump");
      setToolMenu("jump");
    } catch {}
  }, []);
  function groupBounds(id: string) {
    const list = board.nodes.filter((n) => n.data.group === id);
    if (!list.length) return null;
    const x = Math.min(...list.map((n) => n.position.x)),
      y = Math.min(...list.map((n) => n.position.y));
    return {
      x,
      y,
      width: Math.max(...list.map((n) => n.position.x + (n.width ?? 0))) - x,
      height: Math.max(...list.map((n) => n.position.y + (n.height ?? 0))) - y,
    };
  }
  const groupAt = (p: Point) =>
    [
      ...new Set(
        board.nodes.map((n) => n.data.group).filter((id): id is string => !!id),
      ),
    ].find((id) => {
      const b = groupBounds(id);
      return (
        b &&
        p.x >= b.x &&
        p.x <= b.x + b.width &&
        p.y >= b.y &&
        p.y <= b.y + b.height
      );
    });
  const jumpView = (location: JumpLocation) => {
    const bounds = location.group ? groupBounds(location.group) : null;
    const node = location.node
      ? board.nodes.find((n) => n.id === location.node)
      : null;
    if (bounds)
      void flow.fitBounds(bounds, {
        padding: 0.35,
        duration: 420,
      });
    else if (node)
      void flow.fitBounds(
        {
          ...node.position,
          width: node.width ?? 100,
          height: node.height ?? 70,
        },
        { padding: 0.75, duration: 420 },
      );
    else if (location.point)
      void flow.setCenter(location.point.x, location.point.y, {
        zoom: 1.4,
        duration: 420,
      });
  };
  useEffect(() => {
    if (!storage.ready) return;
    try {
      const raw = sessionStorage.getItem("lifemap-jump-view");
      if (!raw) return;
      sessionStorage.removeItem("lifemap-jump-view");
      jumpView(JSON.parse(raw));
    } catch {}
  }, [storage.ready]);
  const followJump = async (jump: BoardJump) => {
    if (jump.tab === currentTab) {
      jumpView(jump);
      return;
    }
    sessionStorage.setItem("lifemap-jump-view", JSON.stringify(jump));
    await openTab(jump.tab);
  };
  const pickJump = async (
    destination: JumpLocation,
    tab = currentTab,
    position?: Point,
  ) => {
    if (!jumpDraft) {
      setJumpDraft({
        tab: currentTab,
        source: destination,
        label: jumpLabel,
        position: position ?? destination.point,
      });
      return;
    }
    const jump: BoardJump = {
      ...destination,
      id: crypto.randomUUID(),
      tab,
      label: jumpLabel.trim().slice(0, 80) || "Weiter",
      sourceGroup: jumpDraft.source.group,
    };
    const append = (b: Board) => {
      let host =
        b.nodes.find((n) => n.id === jumpDraft.source.node) ??
        b.nodes.find(
          (n) =>
            n.data.group === jumpDraft.source.group && !!jumpDraft.source.group,
        );
      if (
        !host &&
        jumpDraft.position &&
        !jumpDraft.source.node &&
        !jumpDraft.source.group
      ) {
        host = newShape(
          "jump-anchor",
          jumpDraft.position.x,
          jumpDraft.position.y,
          "transparent",
          24,
          24,
        );
        b = { ...b, nodes: [...b.nodes, host] };
      }
      if (!host) throw Error("Das Startelement ist nicht mehr vorhanden.");
      if (jumpDraft.position)
        jump.sourceOffset = {
          x: jumpDraft.position.x - host.position.x,
          y: jumpDraft.position.y - host.position.y,
        };
      return {
        ...b,
        nodes: b.nodes.map((n) =>
          n.id === host.id
            ? {
                ...n,
                data: { ...n.data, jumps: [...(n.data.jumps ?? []), jump] },
              }
            : n,
        ),
      };
    };
    try {
      if (jumpDraft.tab === currentTab) {
        const next = append(current.current);
        checkpoint();
        setBoard(next);
      } else {
        const url = "/api/sketchboard?tab=" + encodeURIComponent(jumpDraft.tab);
        let saved = false;
        for (let retry = 0; retry < 2 && !saved; retry++) {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok)
            throw Error("Start-Tab konnte nicht geladen werden.");
          const { board: source, revision } = await response.json();
          const result = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              board: append(validateBoard(source)),
              revision,
            }),
          });
          saved = result.ok;
          if (!saved && result.status !== 409)
            throw Error("Sprungbutton konnte nicht gespeichert werden.");
        }
        if (!saved) throw Error("Der Start-Tab wurde gleichzeitig bearbeitet.");
      }
      setJumpDraft(null);
      setJumpTab(null);
      setTool("hand");
      setToolMenu(null);
      if (tab === currentTab && destination.node)
        setBoard((b) => ({
          ...b,
          nodes: b.nodes.map((n) => ({
            ...n,
            selected: n.id === destination.node,
          })),
        }));
      setMediaError("");
    } catch (err) {
      setMediaError(
        err instanceof Error
          ? err.message
          : "Sprungbutton konnte nicht gespeichert werden.",
      );
    }
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
        () => void goToCalendar(),
        (event) =>
          event.target instanceof Element &&
          !!event.target.closest(".lm-header") &&
          !editing &&
          !notes &&
          !settings &&
          !form,
      ),
    [editing, notes, settings, form],
  );
  const strokePoints = useRef<[number, number][]>([]);
  const displayStroke = (points: [number, number][]) => {
    if (points.length < 3) return points;
    if (pen.straight) return [points[0], points.at(-1)!];
    if (!pen.smooth) return points;
    return smoothStroke(points);
  };
  const toolbar = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mediaKind = useRef<"image" | "video" | "document">("image");
  const [importNotes, setImportNotes] = useState<Record<string, string>>({});
  const [mediaError, setMediaError] = useState("");
  const addMedia = (media: NonNullable<ShapeData["media"]>) => {
    if (!validMedia(media)) {
      setMediaError("Ungültige Datei oder Webadresse.");
      return;
    }
    add(
      "media",
      innerWidth / 2 - 130,
      innerHeight / 2 - 90,
      260 / flow.getViewport().zoom,
      170 / flow.getViewport().zoom,
      {
        media,
      },
    );
    setMediaError("");
    setToolMenu(null);
  };
  const linkToPlace = useRef("");
  const pasteMediaLink = async () => {
    linkToPlace.current = "";
    try {
      const url = new URL((await navigator.clipboard.readText()).trim());
      if (["http:", "https:"].includes(url.protocol))
        linkToPlace.current = url.href;
    } catch {}
    setTool("web-link");
    setToolMenu(null);
    setMediaError("");
  };
  const showTabImport = async () => {
    setImportAt({ x: innerWidth / 2, y: innerHeight / 2 });
    setImportNotes({});
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.ok) {
        const { dayNotes } = await response.json();
        setImportNotes(dayNotes ?? {});
      }
    } catch {}
  };
  const handleMediaFile = (file: File, kind: typeof mediaKind.current) => {
    if (kind === "image") {
      insertImage(file);
      return;
    }
    if (file.size > 4_400_000) {
      setMediaError("Dateien über 4,4 MB bitte als Link einfügen.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      addMedia({
        kind,
        url:
          kind === "document" && !file.type.includes("pdf")
            ? url.replace(/^data:[^;]+;/, "data:application/octet-stream;")
            : url,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };
  const pickMedia = async (kind: typeof mediaKind.current) => {
    mediaKind.current = kind;
    const input = fileInput.current;
    if (!input) return;
    const accept =
      kind === "image"
        ? "image/png,image/jpeg,image/webp,image/gif"
        : kind === "video"
          ? "video/mp4,video/webm"
          : ".pdf,.docx,.xlsx,.pptx,.txt";
    input.accept = accept;
    const picker = (
      window as Window & {
        showOpenFilePicker?: (
          options: object,
        ) => Promise<{ getFile: () => Promise<File> }[]>;
      }
    ).showOpenFilePicker;
    if (kind === "image" && picker) {
      try {
        const [file] = await picker.call(window, {
          startIn: "pictures",
          types: [
            {
              description: "Bilder",
              accept: { "image/*": [".png", ".jpeg", ".jpg", ".webp", ".gif"] },
            },
          ],
        });
        if (file) handleMediaFile(await file.getFile(), kind);
        return;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
      }
    }
    input.click();
  };
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || "{}");
      const hidden =
        saved.toolbarVersion === defaults.toolbarVersion
          ? saved.hidden
          : [...new Set([...(saved.hidden ?? []), "text"])];
      const order: string[] = saved.order ?? [];
      if (!saved.connectionVersion) {
        for (const key of ["connection", "corkConnection"])
          if (saved[key]?.width <= 5) saved[key] = { ...saved[key], width: 9 };
      }
      const updatedOrder =
        saved.toolbarVersion === defaults.toolbarVersion ||
        !order.includes("text")
          ? order
          : order
              .filter((id) => id !== "sticky")
              .flatMap((id) => (id === "text" ? ["sticky", "text"] : [id]));
      setPreferences({
        ...defaults,
        ...saved,
        hidden,
        order: updatedOrder,
        toolbarVersion: defaults.toolbarVersion,
      });
      const paint =
        tabOverrides[currentTab]?.paint ?? saved.paint ?? defaults.paint;
      setPaintMode(paint.mode);
      setPaintOpacity(paint.opacity);
      setPaintWidth(paint.width);
      setFill(paint.color);
      setSymbol(
        tabOverrides[currentTab]?.symbol ?? saved.symbol ?? defaults.symbol,
      );
    } catch {
      /* Use defaults. */
    }
  }, []);
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
  const [shownGroup, setShownGroup] = useState<string | null>(null);
  const [groupFlash, setGroupFlash] = useState<string[]>([]);
  const groupId = selected[0]?.data.group;
  const selectedGroups = new Set(
    selected.flatMap((n) => (n.data.group ? [n.data.group] : [])),
  );
  const members = board.nodes.filter(
    (n) => n.selected || (n.data.group && selectedGroups.has(n.data.group)),
  );
  const groupDrag = useRef<{
    id: string;
    start: { x: number; y: number };
    nodes: ShapeNode[];
  } | null>(null);
  const [groupPicking, setGroupPicking] = useState(false);
  const [confirmGroup, setConfirmGroup] = useState(false);
  const groupActive =
    !!groupId && selected.every((n) => n.data.group === groupId);
  const makeGroup = () => {
    if (groupActive && !groupPicking) {
      checkpoint();
      setBoard((b) => ({
        ...b,
        nodes: b.nodes.map((n) =>
          n.data.group === groupId
            ? { ...n, data: { ...n.data, group: undefined } }
            : n,
        ),
      }));
      setGroupPicking(false);
      return;
    }
    if (tool !== "select" && !groupPicking && !confirmGroup) {
      setTool("hand");
      setToolMenu(null);
      connectFrom.current = null;
      setGroupPicking(true);
      return;
    }
    setGroupPicking(false);
    setConfirmGroup(false);
    if (selected.length < 2) return;
    checkpoint();
    const keys = new Set(selected.map((n) => n.id));
    const existing = new Set(selected.map((n) => n.data.group).filter(Boolean));
    setGroupFlash(selected.map((n) => n.id));
    const group = crypto.randomUUID();
    setBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) =>
        keys.has(n.id) || (n.data.group && existing.has(n.data.group))
          ? { ...n, data: { ...n.data, group } }
          : n,
      ),
    }));
  };
  useEffect(() => {
    if (!groupFlash.length) return;
    const timer = window.setTimeout(() => setGroupFlash([]), 330);
    return () => window.clearTimeout(timer);
  }, [groupFlash]);
  const formatTarget = selected[0]?.id ?? selectedEdges[0]?.id;
  useEffect(() => setFormatPosition(null), [formatTarget]);
  const snapshot = (): HistoryEntry => ({
    board: current.current,
    preferences: generalPreferences,
    tabs: tabOverrides,
    symbols: pinnedSymbols,
  });
  const checkpoint = () => {
    const h = history.current;
    // Board updates are immutable, so the history can share unchanged objects.
    h.past.push(snapshot());
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
    to.push(snapshot());
    current.current = previous.board;
    setBoard(previous.board);
    setPreferences(previous.preferences);
    setTabOverrides(previous.tabs);
    setPinnedSymbols(previous.symbols);
    localStorage.setItem(preferenceKey, JSON.stringify(previous.preferences));
    localStorage.setItem("lifemap-tab-options", JSON.stringify(previous.tabs));
    localStorage.setItem(
      "lifemap-pinned-symbols",
      JSON.stringify(previous.symbols),
    );
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
      const gone = new Set(members.map((n) => n.id));
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
      nodes: structuredClone(members),
      edges: structuredClone(
        board.edges.filter(
          (e) =>
            members.some((n) => n.id === e.source) &&
            members.some((n) => n.id === e.target),
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
    const zoom = flow.getViewport().zoom;
    const node = newShape(
      kind,
      p.x,
      p.y,
      fill,
      width ?? (kind === "sticky" ? 240 : 220) / zoom,
      height ??
        (kind === "text"
          ? 80
          : kind === "sticky" || kind === "circle"
            ? 220
            : 140) / zoom,
    );
    node.data = {
      ...node.data,
      font: preferences.font,
      fontSize: preferences.size / zoom,
      underline: !!preferences.underlineStyle,
      underlineStyle: preferences.underlineStyle,
      bold:
        preferences.textStyle === "bold" ||
        preferences.textStyle === "bold-italic",
      italic:
        preferences.textStyle === "italic" ||
        preferences.textStyle === "bold-italic",
      ...preferences.elementStyles[kind],
      ...(preferences.elementStyles[kind]?.fontSize !== undefined
        ? { fontSize: preferences.elementStyles[kind]!.fontSize! / zoom }
        : {}),
      ...extra,
      strokeWidth: creationStroke(
        extra.strokeWidth ??
          preferences.elementStyles[kind]?.strokeWidth ??
          node.data.strokeWidth,
        zoom,
      ),
      radius:
        (extra.radius ??
          preferences.elementStyles[kind]?.radius ??
          node.data.radius) / zoom,
    };
    node.selected = true;
    setBoard((b) => ({
      ...b,
      nodes: [...b.nodes.map((n) => ({ ...n, selected: false })), node],
      edges: b.edges.map((e) => ({ ...e, selected: false })),
    }));
    setQuick(null);
    if (!["image", "ink", "symbol", "media"].includes(kind))
      setEditing(node.id);
    return node.id;
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
          260 / flow.getViewport().zoom,
          Math.min(600, Math.max(50, (260 * image.height) / image.width)) /
            flow.getViewport().zoom,
          { image: src },
        );
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
  };
  const connect = (
    c: Connection,
    targetOffset?: number,
    sourceOffset?: number,
    added?: ShapeNode,
  ) => {
    if (!c.source || !c.target || c.source === c.target) return;
    checkpoint();
    setBoard((b) => ({
      ...b,
      nodes: added ? [...b.nodes, added] : b.nodes,
      edges: [
        ...b.edges,
        {
          ...c,
          id: crypto.randomUUID(),
          type: connection.type,
          data: {
            targetOffset,
            sourceOffset,
            ...(preferences.lineCaption
              ? { caption: { ...preferences.lineCaption, text: "" } }
              : {}),
          },
          style: {
            stroke: connection.color,
            strokeWidth: creationStroke(
              connection.width,
              flow.getViewport().zoom,
            ),
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
  const connectTo = (id: string, point?: Point, added?: ShapeNode) => {
    const node = added ?? board.nodes.find((n) => n.id === id);
    const target =
      node && point
        ? connectionSide(
            node,
            flow.screenToFlowPosition(point, { snapToGrid: false }),
          )
        : undefined;
    const source = connectFrom.current;
    const startNode = board.nodes.find((n) => n.id === source);
    const endPoint = node
      ? node.data.kind === "connection-anchor"
        ? node.position
        : target
          ? connectionPoint(node, target[0], target[2])
          : {
              x: node.position.x + (node.width ?? 0) / 2,
              y: node.position.y + (node.height ?? 0) / 2,
            }
      : anchors[id.slice(5)];
    const startSide =
      startNode && endPoint && startNode.data.kind !== "connection-anchor"
        ? connectionSide(startNode, endPoint)
        : undefined;
    if (source && source !== id)
      connect(
        {
          source,
          target: id,
          sourceHandle: startSide?.[0] ?? "right",
          targetHandle: target?.[0] ?? "left",
        },
        target?.[2],
        startSide?.[2],
        added,
      );
    else if (added) {
      checkpoint();
      setBoard((b) => ({ ...b, nodes: [...b.nodes, added] }));
    }
    const current = source === id ? null : id;
    connectFrom.current = current;
    setBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) => ({ ...n, selected: n.id === current })),
      edges: b.edges.map((e) => ({
        ...e,
        selected: "line:" + e.id === current,
      })),
    }));
  };
  const [linkHover, setLinkHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [linkPointer, setLinkPointer] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const startLink = (id: string) => {
    setTool("connect");
    setToolMenu("connect");
    setEditing("");
    setColors(false);
    connectTo(id);
  };
  const begin = (id: string) => {
    setBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) => ({ ...n, selected: n.id === id })),
    }));
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
      if ((e.target as HTMLElement).closest(".color-popup,.color-swatches"))
        return;
      if (
        preview &&
        ["Enter", "Delete", "Backspace", "Escape"].includes(e.key) &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Enter") mergePreview();
        else setPreview(null);
        return;
      }
      const key = e.key.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        (key === "z" || key === "y") &&
        !(
          e.target instanceof Element &&
          e.target.closest(".lm-settings input,.lm-settings select")
        )
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
      if (
        (e.code === "Space" || key === " ") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) setNotes((open) => !open);
        return;
      }
      if (!storage.ready) return;
      if (
        e.key === "Enter" &&
        (groupPicking ||
          confirmGroup ||
          (tool === "select" && selected.length >= 2 && !groupActive))
      ) {
        e.preventDefault();
        makeGroup();
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        makeGroup();
        return;
      }
      const target = selected.length === 1 ? selected[0] : undefined;
      if (
        !editing &&
        !settings &&
        !form &&
        !preview &&
        (tool === "write" || tool === "hand") &&
        target &&
        !["image", "media", "ink", "symbol"].includes(target.data.kind) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.isComposing &&
        e.key.length === 1 &&
        e.key !== " "
      ) {
        e.preventDefault();
        e.stopPropagation();
        begin(target.id);
        patch(target.id, { text: (target.data.text + e.key).slice(0, 50000) });
        return;
      }
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
        if (tool === "select" && selectedTabs.length) {
          void (async () => {
            if (!(await storage.finish())) return;
            const next = tabs.filter((t) => !selectedTabs.includes(t.id));
            if (!next.length)
              next.push({ id: crypto.randomUUID(), title: "LifeMap" });
            saveTabs(next);
            setSelectedTabs([]);
            if (selectedTabs.includes(currentTab))
              location.assign("/lifemap/board?tab=" + next[0].id);
          })();
        } else remove();
      }
      if (k === " ") {
        e.preventDefault();
        if (!e.repeat) setNotes((open) => !open);
      }
      if (
        k === "escape" ||
        (!mod &&
          k === "enter" &&
          !(e.target as HTMLElement).closest("button,a"))
      ) {
        e.preventDefault();
        setGroupPicking(false);
        setConfirmGroup(false);
        setJumpDraft(null);
        setJumpTab(null);
        setShownGroup(null);
        setEditing("");
        setTool("hand");
        setToolMenu(null);
        setStroke([]);
        setNotes(false);
        setSettings(false);
        setSettingsTab(null);
        setTabMenu(null);
        setImportAt(null);
        setPinForm(null);
        setForm(null);
        setDrawPolygon(null);
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
          const button = document.activeElement as HTMLButtonElement;
          const next = button.dataset.tool as Tool | undefined;
          if (next) {
            setTool(next);
            if (next === "polygon") {
              setPolygonTemplate(null);
              setDrawPolygon([]);
            }
            setToolMenu(next);
            setColors(next === "paint");
            setEditing("");
            connectFrom.current = null;
          }
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
    a.download =
      (tabs.find((t) => t.id === currentTab)?.title ?? "LifeMap") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const [symbol, setSymbol] = useState("Sonne");
  const embedded = new URLSearchParams(location.search).has("notebookEmbed");
  const [drawPolygon, setDrawPolygon] = useState<PolygonPoint[] | null>(null);
  const polygonGuide = useRef<SVGPathElement>(null);
  const polygonStart = useRef<SVGCircleElement>(null);
  const [curvedPolygon, setCurvedPolygon] = useState(false);
  const [polygonTemplate, setPolygonTemplate] = useState<PolygonPoint[] | null>(
    null,
  );
  const [removeTool, setRemoveTool] = useState<{
    x: number;
    y: number;
    remove: () => void;
  } | null>(null);
  const pinnedForms = preferences.pinned
    ? [preferences.pinned, ...preferences.pinnedForms]
    : preferences.pinnedForms;
  const toolbarPreferences = (changes: Partial<typeof defaults>) => {
    if (tabOverrides[currentTab]) updateTab(currentTab, changes);
    else updatePreferences(changes);
  };
  const pinPolygon = (points: PolygonPoint[]) => {
    if (
      !pinnedForms.some(
        (form) => JSON.stringify(form) === JSON.stringify(points),
      )
    )
      toolbarPreferences({
        pinned: null,
        pinnedForms: [...pinnedForms, points],
      });
  };
  const placeTemplate = (points: PolygonPoint[]) => {
    setPolygonTemplate(points);
    setDrawPolygon(null);
    setTool("polygon");
    setToolMenu(null);
  };
  const [pinForm, setPinForm] = useState<{
    x: number;
    y: number;
    points: PolygonPoint[];
    id: string;
    straightened?: boolean;
  } | null>(null);
  const [stickyImports, setStickyImports] = useState<
    { name: string; src: string }[]
  >(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("lifemap-note-templates") || "[]",
      );
      return Array.isArray(saved)
        ? saved.filter(
            (item) =>
              item && typeof item.name === "string" && validPicture(item.src),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [stickyError, setStickyError] = useState("");
  const [pinSymbol, setPinSymbol] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [customSymbols, setCustomSymbols] = useState<Record<string, string>>(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("lifemap-custom-symbols") || "{}",
        );
      } catch {
        return {};
      }
    },
  );
  const [pinnedSymbols, setPinnedSymbols] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lifemap-pinned-symbols") || "[]");
    } catch {
      return [];
    }
  });
  const shapeTool = ![
    "web-link",
    "jump",
    "eraser",
    "write",
    "paint",
    "select",
    "hand",
    "connect",
  ].includes(tool);
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
    !focus || focus.id === id
      ? 1
      : connected.has(id)
        ? 0.8
        : focus.level === 1
          ? 0.15
          : 0;
  const baseX = preview
    ? Math.min(...preview.board.nodes.map((n) => n.position.x))
    : 0;
  const baseY = preview
    ? Math.min(...preview.board.nodes.map((n) => n.position.y))
    : 0;
  const previewNodes =
    preview?.board.nodes.map((n) => {
      const width = Math.max(
        40,
        Math.min(10000, (n.width ?? 100) * preview.scale),
      );
      const height = Math.max(
        40,
        Math.min(10000, (n.height ?? 100) * preview.scale),
      );
      return {
        ...n,
        width,
        height,
        style: { width, height },
        position: {
          x: preview.x + (n.position.x - baseX) * preview.scale,
          y: preview.y + (n.position.y - baseY) * preview.scale,
        },
        data: {
          ...n.data,
          fontSize: Math.min(
            120,
            Math.max(10, n.data.fontSize * preview.scale),
          ),
        },
      };
    }) ?? [];
  const renderedEdges = [...board.edges, ...(preview?.board.edges ?? [])];
  const previewEdgeIds = new Set(preview?.board.edges.map((e) => e.id));
  const mergePreview = () => {
    if (!preview) return;
    checkpoint();
    setBoard((b) => ({
      ...b,
      nodes: [...b.nodes, ...previewNodes],
      edges: [...b.edges, ...preview.board.edges],
    }));
    setPreview(null);
  };
  const referenceIds = new Set(
    renderedEdges
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
  const toolSection = (id: string) =>
    id === "sticky"
      ? 1
      : ["symbols", "connect", "jump", "paint", "ink", "image"].includes(id)
        ? 2
        : 0;
  const toolRank = (id: string) =>
    preferences.order.indexOf(id) + 1 ||
    100 + tools.findIndex((tool) => tool.id === id);
  const toolbarTools = tools
    .filter(
      ({ id }) =>
        !hiddenTools.includes(id) &&
        (id === "image" || !preferences.hidden.includes(id)),
    )
    .sort(
      (a, b) =>
        toolSection(a.id) - toolSection(b.id) ||
        toolRank(a.id) - toolRank(b.id),
    );
  const symbolsTool = toolbarTools.find((t) => t.id === "symbols");
  const jumpTool = toolbarTools.find((t) => t.id === "jump");
  const orderedTools = toolbarTools.filter(
    (t) => t !== symbolsTool && t !== jumpTool,
  );
  if (symbolsTool)
    orderedTools.splice(
      orderedTools.findIndex((t) => toolSection(t.id) === 2) < 0
        ? orderedTools.length
        : orderedTools.findIndex((t) => toolSection(t.id) === 2),
      0,
      symbolsTool,
    );
  if (jumpTool) {
    const connectIndex = orderedTools.findIndex((t) => t.id === "connect");
    orderedTools.splice(
      connectIndex >= 0 ? connectIndex + 1 : orderedTools.length,
      0,
      jumpTool,
    );
  }
  const circleIndex = orderedTools.findIndex((t) => t.id === "circle");
  const ovalIndex = orderedTools.findIndex((t) => t.id === "ellipse");
  if (circleIndex >= 0 && ovalIndex >= 0 && circleIndex !== ovalIndex - 1) {
    const [circle] = orderedTools.splice(circleIndex, 1);
    orderedTools.splice(
      orderedTools.findIndex((t) => t.id === "ellipse"),
      0,
      circle,
    );
  }
  const firstStyleTool = orderedTools.find(
    ({ id }) => toolSection(id) === 2,
  )?.id;
  const templateNames = galleryOrder(
    formTemplates.map(([name]) => name),
    generalPreferences.templateOrder,
  );
  const symbolNames = galleryOrder(
    [...new Set([...Object.keys(customSymbols), ...Object.keys(symbols)])],
    generalPreferences.symbolOrder,
  );
  const attachSymbol = (name: string, slot?: number) => {
    if (pinnedSymbols.includes(name)) return;
    if (slot === undefined) checkpoint();
    else {
      const order = [...visibleToolbar];
      order.splice(slot, 0, "symbol:" + name);
      toolbarPreferences({ toolbarOrder: order });
    }
    const next = [...pinnedSymbols, name];
    setPinnedSymbols(next);
    localStorage.setItem("lifemap-pinned-symbols", JSON.stringify(next));
  };
  const attachedForms = pinnedForms.map((points, i) => (
    <button
      key={i}
      data-toolbar-id={"form:" + JSON.stringify(points)}
      draggable
      title="Angeheftete freie Form"
      aria-label={"Angeheftete freie Form " + (i + 1)}
      aria-pressed={tool === "polygon" && polygonTemplate === points}
      onClick={() => placeTemplate(points)}
      onContextMenu={(e) => {
        e.preventDefault();
        setRemoveTool({
          x: e.clientX,
          y: e.clientY,
          remove: () => {
            toolbarPreferences({
              pinned: null,
              pinnedForms: pinnedForms.filter((_, index) => index !== i),
            });
            if (polygonTemplate === points) clearCanvasPopups();
          },
        });
      }}
    >
      <FormPreview points={points} />
    </button>
  ));
  const builtins = orderedTools.map(({ id, label, Icon }) => (
    <button
      key={id}
      data-tool={id}
      data-toolbar-id={id}
      title={label}
      aria-label={label}
      aria-pressed={tool === id}
      className={tool === id ? "active" : ""}
      disabled={!storage.ready}
      draggable
      onContextMenu={(e) => {
        e.preventDefault();
        setRemoveTool({
          x: e.clientX,
          y: e.clientY,
          remove: () => {
            toolbarPreferences({
              hidden: [...preferences.hidden, id],
            });
            if (tool === id || toolMenu === id) clearCanvasPopups();
          },
        });
      }}
      onClick={() => {
        if (tool === id || (toolMenu === id && id !== "ink")) {
          setTool("hand");
          setToolMenu(null);
          setColors(false);
          setForm(null);
          connectFrom.current = null;
          return;
        }
        setEditing("");
        setColors(id === "paint");
        setJumpDraft(null);
        setJumpTab(null);
        setBoard((b) => ({
          ...b,
          nodes: b.nodes.map((n) =>
            n.selected ? { ...n, selected: false } : n,
          ),
          edges: b.edges.map((edge) =>
            edge.selected ? { ...edge, selected: false } : edge,
          ),
        }));
        setToolMenu(id);
        if (id === "image") {
          setTool("hand");
          return;
        }
        if (id === "polygon") {
          setTool("polygon");
          setPolygonTemplate(null);
          setDrawPolygon([]);
        } else setTool(id);
        if (id === "paint") setColors(true);
        setEditing("");
        connectFrom.current = null;
      }}
    >
      <Icon size={21} strokeWidth={1.6} />
    </button>
  ));
  const symbolButtons = pinnedSymbols.map((name) => (
    <button
      key={name}
      title={name}
      data-toolbar-id={"symbol:" + name}
      draggable
      onContextMenu={(e) => {
        e.preventDefault();
        setRemoveTool({
          x: e.clientX,
          y: e.clientY,
          remove: () => {
            const next = pinnedSymbols.filter((item) => item !== name);
            checkpoint();
            setPinnedSymbols(next);
            localStorage.setItem(
              "lifemap-pinned-symbols",
              JSON.stringify(next),
            );
          },
        });
      }}
      aria-pressed={tool === "symbols" && symbol === name}
      onClick={() => {
        setSymbol(name);
        setTool("symbols");
        setToolMenu(null);
      }}
    >
      {customSymbols[name] ? (
        <img src={customSymbols[name]} className="lm-custom-symbol" alt="" />
      ) : (
        <SymbolArt name={name} stroke="currentColor" fill="none" />
      )}
    </button>
  ));
  const baseToolbar = [...builtins];
  const noteIndex = orderedTools.findIndex((tool) => tool.id === "sticky");
  baseToolbar.splice(
    noteIndex < 0 ? baseToolbar.length : noteIndex,
    0,
    ...attachedForms,
  );
  baseToolbar.push(...symbolButtons);
  const toolbarItems = new Map(
    baseToolbar.map((item) => [String(item.props["data-toolbar-id"]), item]),
  );
  const baseOrder = [...toolbarItems.keys()];
  const visibleToolbar = galleryOrder(
    baseOrder,
    preferences.toolbarOrder.length ? preferences.toolbarOrder : ["ink"],
  );
  const [toolbarDrop, setToolbarDrop] = useState<{
    slot: number;
    x: number;
  } | null>(null);
  const dragGhost = useRef<HTMLCanvasElement | null>(null);
  const dragSlot = (clientX: number) => {
    const items = [
      ...(toolbar.current?.querySelectorAll<HTMLElement>(
        ":scope > [data-toolbar-id]",
      ) ?? []),
    ];
    const index = items.findIndex((el) => {
      const bounds = el.getBoundingClientRect();
      return clientX < bounds.left + bounds.width / 2;
    });
    return index < 0 ? items.length : index;
  };
  const clearCanvasPopups = () => {
    setConfirmGroup(false);
    setLinkHover(null);
    setBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      edges: b.edges.map((edge) =>
        edge.selected ? { ...edge, selected: false } : edge,
      ),
    }));
    leavingText.current = false;
    setEditing("");
    setTool("hand");
    setToolMenu(null);
    setJumpDraft(null);
    setJumpTab(null);
    setQuick(null);
    setColors(false);
    connectFrom.current = null;
    setPinSymbol(null);
    setPreview(null);
    setDrawPolygon(null);
    setGroupPicking(false);
  };
  return (
    <main
      onClickCapture={(e) => {
        const hit = e.target as Element;
        if (
          !hit.closest(
            ".lm-settings,.lm-header-settings,.lm-tab-menu,.color-popup",
          )
        ) {
          setSettings(false);
          setSettingsTab(null);
          setForm(null);
        }
        if (!hit.closest(".lm-tab-menu")) setTabMenu(null);
        if (!hit.closest(".lm-pin-form")) setPinForm(null);
        if (!hit.closest(".lm-remove-tool")) setRemoveTool(null);
        if (!hit.closest(".lm-symbol-action,.lm-symbol-picker"))
          setPinSymbol(null);
        if (!hit.closest(".lm-import-menu")) setImportAt(null);
        if (hit.matches(".lm-app,.lm-canvas,.lm-header")) clearCanvasPopups();
      }}
      className={`lm-app${dark ? " lm-dark" : ""}${embedded ? " lm-embedded" : ""}`}
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
          e.touches.length >= 2 && (e.target as Element).closest(".lm-header")
            ? e.touches[0].clientY
            : null;
      }}
      onTouchEnd={(e) => {
        if (
          touchStart.current !== null &&
          e.changedTouches[0]?.clientY < touchStart.current - 80
        )
          void goToCalendar();
        touchStart.current = null;
      }}
    >
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          if (e.target.files?.[0])
            handleMediaFile(e.target.files[0], mediaKind.current);
          e.target.value = "";
        }}
      />
      {!embedded && (
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
            type="button"
            aria-label={groupActive ? "Gruppe auflösen" : "Gruppieren"}
            title={
              groupPicking ? "Gruppenauswahl abschließen (G)" : "Gruppieren (G)"
            }
            aria-pressed={groupActive || groupPicking}
            onClick={makeGroup}
          >
            <Group size={19} />
          </button>
          <button
            className="lm-header-settings"
            aria-label="Einstellungen"
            title="Einstellungen"
            onClick={() => {
              setSettingsTab(null);
              setSettings(!settings || !!settingsTab);
            }}
          >
            <Settings size={19} />
          </button>

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
              <div
                className="lm-tab-item"
                key={id}
                data-selected={selectedTabs.includes(id) || undefined}
                draggable={renaming !== id}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-lifemap-tab",
                    JSON.stringify({ id, title, color: preferences.accent }),
                  );
                }}
                onDragOver={(e) => {
                  if (
                    e.dataTransfer.types.includes("application/x-lifemap-tab")
                  )
                    e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const source = JSON.parse(
                      e.dataTransfer.getData("application/x-lifemap-tab"),
                    ).id;
                    const item = tabs.find((t) => t.id === source);
                    if (!item || source === id) return;
                    const next = tabs.filter((t) => t.id !== source);
                    next.splice(
                      next.findIndex((t) => t.id === id),
                      0,
                      item,
                    );
                    saveTabs(next);
                  } catch {}
                }}
              >
                {renaming === id ? (
                  <input
                    autoFocus
                    aria-label="Tab-Name"
                    maxLength={60}
                    value={tabTitle}
                    onChange={(e) => setTabTitle(e.target.value)}
                    onBlur={renameTab}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    aria-current={id === currentTab ? "page" : undefined}
                    aria-expanded={tabMenu === id}
                    onClick={() => {
                      setTabMenu(null);
                      if (tool === "jump" && jumpDraft) {
                        setJumpTab(id);
                        return;
                      }
                      if (tool === "select") {
                        setSelectedTabs((t) =>
                          t.includes(id)
                            ? t.filter((s) => s !== id)
                            : [...t, id],
                        );
                        return;
                      }
                      if (id !== currentTab) void openTab(id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setTabMenu(tabMenu === id ? null : id);
                    }}
                  >
                    {title}
                  </button>
                )}
                {tabMenu === id && (
                  <div className="lm-tab-menu">
                    <button
                      onClick={() => {
                        setRenaming(id);
                        setTabTitle(title);
                        setTabMenu(null);
                      }}
                    >
                      Umbenennen
                    </button>
                    <button
                      onClick={async () => {
                        if (id === currentTab) exportBoard();
                        else {
                          const response = await fetch(
                            "/api/sketchboard?tab=" + encodeURIComponent(id),
                          );
                          if (!response.ok) return;
                          const result = await response.json();
                          const url = URL.createObjectURL(
                            new Blob([JSON.stringify(result.board, null, 2)], {
                              type: "application/json",
                            }),
                          );
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = title + ".json";
                          a.click();
                          URL.revokeObjectURL(url);
                        }
                        setTabMenu(null);
                      }}
                    >
                      Speichern unter
                    </button>
                    <button
                      onClick={() => {
                        setSettingsTab(id);
                        setSettings(true);
                        setTabMenu(null);
                      }}
                    >
                      Einstellungen
                    </button>
                    <button
                      onClick={() => {
                        void closeTab(id);
                        setTabMenu(null);
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              aria-label="Neuer LifeMap-Tab"
              onClick={() => void openTab()}
              onContextMenu={(e) => {
                e.preventDefault();
                setImportError("");
                setImportAt({ x: innerWidth / 2, y: innerHeight / 2 });
              }}
            >
              +
            </button>
          </nav>
        </header>
      )}
      {!embedded && (
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
      )}
      {settings && (
        <StoredPanel
          name="general"
          className="lm-settings"
          label="LifeMap-Einstellungen"
        >
          <div className="lm-settings-heading">
            <strong>
              {settingsTab
                ? (tabs.find((tab) => tab.id === settingsTab)?.title ??
                  "LifeMap")
                : "LifeMap-Einstellungen"}
            </strong>
            <button
              aria-label="Schließen"
              onClick={() => {
                setSettings(false);
                setSettingsTab(null);
              }}
            >
              <X size={18} />
            </button>
          </div>
          <label>
            UI-Farbe{" "}
            <ColorSwatches
              name="UI-Akzent"
              value={configured.accent}
              onChange={(e) => updateSettings({ accent: e.target.value })}
            />
          </label>
          <div className="lm-style-previews">
            {["plain", "dots", "lines", "grid", "paper", "cork"].map(
              (pattern) => (
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
                      cork: "Pinnwand",
                    }[pattern]
                  }
                  className={"lm-preview lm-pattern-" + pattern}
                  aria-pressed={configured.pattern === pattern}
                  onClick={() => updateSettings({ pattern })}
                />
              ),
            )}
          </div>
          <label>
            Standardschrift{" "}
            <select
              value={configured.font}
              onChange={(e) => updateSettings({ font: e.target.value })}
            >
              {boardFonts.map((font) => (
                <option
                  key={font}
                  style={{ fontFamily: font === "System" ? "system-ui" : font }}
                >
                  {font}
                </option>
              ))}
            </select>
          </label>
          <label>
            Standardschriftgröße{" "}
            <input
              type="number"
              min={10}
              max={120}
              value={configured.size}
              onChange={(e) =>
                updateSettings({
                  size: Math.max(10, Math.min(120, Number(e.target.value))),
                })
              }
            />
          </label>
          <div className="lm-default-text-style">
            <span>Standardschriftstil</span>
            {(
              [
                [Bold, "Fett", "bold"],
                [Italic, "Kursiv", "italic"],
              ] as const
            ).map(([Icon, label, key]) => (
              <button
                type="button"
                key={key}
                aria-label={label}
                aria-pressed={configured.textStyle.includes(key)}
                onClick={() => {
                  const other = key === "bold" ? "italic" : "bold";
                  const hasOther = configured.textStyle.includes(other);
                  updateSettings({
                    textStyle: configured.textStyle.includes(key)
                      ? hasOther
                        ? other
                        : "regular"
                      : hasOther
                        ? "bold-italic"
                        : key,
                  });
                }}
              >
                <Icon size={15} />
              </button>
            ))}
            <UnderlinePicker
              value={configured.underlineStyle}
              onChange={(underlineStyle) => updateSettings({ underlineStyle })}
            />
          </div>
          <label>
            Hintergrund{" "}
            <ColorSwatches
              name="Board-Hintergrund"
              value={configured.background || (dark ? "#202124" : "#faf9fc")}
              onChange={(e) => updateSettings({ background: e.target.value })}
            />{" "}
            <button onClick={() => updateSettings({ background: "" })}>
              Standard
            </button>
          </label>
          <details className="lm-settings-tools">
            <summary>Werkzeugleiste</summary>
            {tools
              .filter(({ id }) => !hiddenTools.includes(id))
              .map(({ id, label }) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={!configured.hidden.includes(id)}
                    onChange={(e) =>
                      updateSettings({
                        hidden: e.target.checked
                          ? configured.hidden.filter((tool) => tool !== id)
                          : [...configured.hidden, id],
                      })
                    }
                  />
                  {label}
                </label>
              ))}

            {configured.pinned && (
              <button onClick={() => updateSettings({ pinned: null })}>
                Angeheftete Form entfernen
              </button>
            )}
          </details>
          {settingsTab && tabOverrides[settingsTab] && (
            <button
              onClick={() => {
                const next = { ...tabOverrides };
                delete next[settingsTab];
                setTabOverrides(next);
                localStorage.setItem(
                  "lifemap-tab-options",
                  JSON.stringify(next),
                );
              }}
            >
              Allgemeine Einstellungen übernehmen
            </button>
          )}
        </StoredPanel>
      )}
      {form && (
        <StoredPanel
          name="polygon"
          className="lm-settings"
          label="Freie Form bearbeiten"
        >
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
            onClick={() => pinPolygon(form)}
          >
            In die Leiste ziehen
          </button>
          <button onClick={() => setForm(null)}>Schließen</button>
        </StoredPanel>
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
        onPointerMove={(e) => {
          const target = document
            .elementsFromPoint(e.clientX, e.clientY)
            .map((item) =>
              item.closest(".react-flow__node-shape,.react-flow__edge"),
            )
            .find(Boolean);
          const id = target?.getAttribute("data-id");
          const bounds = target?.getBoundingClientRect();
          if (!e.buttons && id && bounds && !editing && !preview) {
            const edge = target!.classList.contains("react-flow__edge");
            setLinkHover({
              id: edge ? "line:" + id : id,
              x: edge ? e.clientX : (bounds.left + bounds.right) / 2,
              y: edge ? e.clientY - 11 : bounds.bottom - 8,
            });
          } else setLinkHover(null);
          if (tool === "connect" && connectFrom.current)
            setLinkPointer({ x: e.clientX, y: e.clientY });
        }}
        onContextMenu={(e) => {
          if (
            (e.target as HTMLElement).closest(
              ".react-flow__node,.react-flow__edge",
            )
          )
            return;
          e.preventDefault();
          setImportError("");
          setImportAt({ x: e.clientX, y: e.clientY });
        }}
        tabIndex={-1}
        onPointerDownCapture={(e) => {
          leavingText.current = Boolean(
            editing && !(e.target as HTMLElement).closest(".lm-live-note"),
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
        style={
          {
            "--lm-ui": preferences.accent,
            "--lm-board-zoom": board.viewport.zoom,
          } as CSSProperties
        }
        className={`lm-canvas lm-pattern-${preferences.pattern} ${tool === "select" || tool === "paint" ? "lm-crosshair" : ""}${shapeTool ? " lm-drawing" : ""}${tool === "connect" ? " lm-connecting" : ""}${tool === "jump" ? " lm-jump-mode" : ""}`}
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
              link: startLink,
              inspect: (id) => {
                const node = board.nodes.find((n) => n.id === id);
                const group = node?.data.representGroup ?? node?.data.group;
                if (!group) return false;
                setShownGroup(group);
                return true;
              },
              jump: (link) => void followJump(link),
            }}
          >
            <ReactFlow<ShapeNode>
              nodes={[
                ...board.nodes.map((n) => ({
                  ...n,
                  selectable:
                    n.data.kind === "connection-anchor" ? false : n.selectable,
                  className: groupFlash.includes(n.id)
                    ? "lm-group-flash"
                    : undefined,
                  style: {
                    ...n.style,
                    opacity:
                      n.data.kind === "connection-anchor" ? 0 : fade(n.id),
                    pointerEvents:
                      n.data.kind === "connection-anchor" || fade(n.id) === 0
                        ? ("none" as const)
                        : undefined,
                  },
                })),
                ...previewNodes.map((n) => ({
                  ...n,
                  selectable: false,
                  draggable: false,
                  style: {
                    ...n.style,
                    opacity: 0.38,
                    pointerEvents: "none" as const,
                  },
                })),
                ...proxyNodes,
              ]}
              edges={renderedEdges.map((e) => ({
                ...e,
                type: "boardLine",
                selectable: !previewEdgeIds.has(e.id),
                sourceHandle: e.source.startsWith("line:")
                  ? "center"
                  : e.sourceHandle,
                targetHandle: e.target.startsWith("line:")
                  ? "end"
                  : e.targetHandle,
                style: {
                  ...e.style,
                  opacity: previewEdgeIds.has(e.id)
                    ? 0.38
                    : fade("line:" + e.id),
                },
                hidden: fade("line:" + e.id) === 0,
                data: {
                  ...e.data,
                  startLink: previewEdgeIds.has(e.id) ? undefined : startLink,
                  route: e.type,
                  sourcePoint: (() => {
                    const node = board.nodes.find((n) => n.id === e.source);
                    if (!node) return;
                    return node.data.kind === "connection-anchor"
                      ? node.position
                      : typeof e.data?.sourceOffset === "number"
                        ? connectionPoint(
                            node,
                            e.sourceHandle as Side,
                            e.data.sourceOffset,
                          )
                        : undefined;
                  })(),
                  targetPoint:
                    board.nodes.find(
                      (n) =>
                        n.id === e.target &&
                        n.data.kind === "connection-anchor",
                    )?.position ??
                    (typeof e.data?.targetOffset === "number" &&
                    !e.target.startsWith("line:")
                      ? (() => {
                          const node = board.nodes.find(
                            (n) => n.id === e.target,
                          );
                          return node
                            ? connectionPoint(
                                node,
                                e.targetHandle as Side,
                                e.data!.targetOffset as number,
                              )
                            : undefined;
                        })()
                      : undefined),
                  thread: preferences.pattern === "cork",
                  anchor: reportAnchor,
                  connectTo:
                    tool === "connect" && connectFrom.current
                      ? connectTo
                      : undefined,
                },
              }))}
              edgeTypes={edgeTypes}
              onEdgeClick={(_, e) => {
                if (
                  tool === "connect" &&
                  connectFrom.current &&
                  !previewEdgeIds.has(e.id)
                )
                  connectTo("line:" + e.id);
                else if (tool === "connect" && !previewEdgeIds.has(e.id)) {
                  setBoard((b) => ({
                    ...b,
                    nodes: b.nodes.map((n) => ({ ...n, selected: false })),
                    edges: b.edges.map((edge) => ({
                      ...edge,
                      selected: edge.id === e.id,
                    })),
                  }));
                }
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
                        !(
                          (groupPicking ||
                            confirmGroup ||
                            (tool === "select" &&
                              change.type === "select" &&
                              !change.selected &&
                              selected.length >= 2 &&
                              changes.every(
                                (c) => c.type === "select" && !c.selected,
                              ))) &&
                          change.type === "select"
                        ) &&
                        (!("id" in change) ||
                          (!change.id.startsWith("line:") &&
                            !previewNodes.some((n) => n.id === change.id))),
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
              onConnect={(connection) => {
                connect(connection);
                connectFrom.current = connection.target;
                setBoard((b) => ({
                  ...b,
                  nodes: b.nodes.map((n) => ({
                    ...n,
                    selected: n.id === connection.target,
                  })),
                  edges: b.edges.map((e) => ({ ...e, selected: false })),
                }));
              }}
              connectionMode={ConnectionMode.Loose}
              connectionLineStyle={{
                stroke: connection.color,
                strokeWidth:
                  creationStroke(connection.width, board.viewport.zoom) *
                  connectionWeight *
                  board.viewport.zoom,
                strokeDasharray: connection.dash,
              }}
              onNodeDragStart={(_, node) => {
                checkpoint();
                if (node.data.group)
                  groupDrag.current = {
                    id: node.id,
                    start: node.position,
                    nodes: board.nodes.filter(
                      (n) => n.data.group === node.data.group,
                    ),
                  };
              }}
              onNodeDrag={(_, node) => {
                const drag = groupDrag.current;
                if (!drag || drag.id !== node.id) return;
                const dx = node.position.x - drag.start.x,
                  dy = node.position.y - drag.start.y;
                setBoard((b) => ({
                  ...b,
                  nodes: b.nodes.map((n) => {
                    const seed = drag.nodes.find((item) => item.id === n.id);
                    return seed
                      ? {
                          ...n,
                          position: {
                            x: seed.position.x + dx,
                            y: seed.position.y + dy,
                          },
                        }
                      : n;
                  }),
                }));
              }}
              onNodeDragStop={() => {
                groupDrag.current = null;
              }}
              onSelectionDragStart={checkpoint}
              onNodeClick={(event, node) => {
                if (
                  tool !== "jump" &&
                  node.data.representGroup &&
                  !event.ctrlKey
                ) {
                  setShownGroup(node.data.representGroup);
                  return;
                }
                if (tool === "jump") {
                  void pickJump(
                    { node: node.id },
                    currentTab,
                    flow.screenToFlowPosition(
                      { x: event.clientX, y: event.clientY },
                      { snapToGrid: false },
                    ),
                  );
                  return;
                }
                if (event.ctrlKey && node.data.group) {
                  checkpoint();
                  patch(node.id, { group: undefined });
                  return;
                }
                if (groupPicking) {
                  if (!selected.some((n) => n.id === node.id))
                    setGroupFlash([node.id]);
                  setBoard((b) => ({
                    ...b,
                    nodes: b.nodes.map((n) => ({
                      ...n,
                      selected:
                        n.id === node.id
                          ? !selected.some((item) => item.id === n.id)
                          : selected.some((item) => item.id === n.id),
                    })),
                  }));
                  return;
                }
                if (leavingText.current) {
                  leavingText.current = false;
                  return;
                }

                if (tool === "paint" && node.data.kind !== "image") {
                  checkpoint();
                  patch(
                    node.id,
                    paintMode === "opacity"
                      ? { opacity: paintOpacity }
                      : paintMode === "stroke"
                        ? { stroke: fill, strokeWidth: paintWidth }
                        : paintMode === "all"
                          ? { fill, opacity: paintOpacity }
                          : { fill },
                  );
                }
                if (tool === "eraser" && node.data.kind === "ink") {
                  checkpoint();
                  setBoard((b) => ({
                    ...b,
                    nodes: b.nodes.filter((n) => n.id !== node.id),
                    edges: b.edges.filter(
                      (edge) =>
                        edge.source !== node.id && edge.target !== node.id,
                    ),
                  }));
                  return;
                }
                if (tool === "connect")
                  connectTo(node.id, { x: event.clientX, y: event.clientY });
              }}
              onPaneClick={(event) => {
                if (tool === "web-link") {
                  const url = linkToPlace.current;
                  const media = {
                    kind: "link" as const,
                    url: url || "https://",
                    name: url ? new URL(url).hostname : "Webadresse",
                  };
                  add(
                    "media",
                    event.clientX,
                    event.clientY,
                    undefined,
                    undefined,
                    { media },
                  );
                  setTool("hand");
                  setToolMenu(null);
                  return;
                }
                if (tool === "connect") {
                  if (!connectFrom.current) {
                    clearCanvasPopups();
                    return;
                  }
                  const point = flow.screenToFlowPosition(
                    { x: event.clientX, y: event.clientY },
                    { snapToGrid: false },
                  );
                  const node = newShape(
                    "connection-anchor",
                    point.x,
                    point.y,
                    "transparent",
                    10,
                    10,
                  );
                  connectTo(node.id, undefined, node);
                  return;
                }
                if (tool === "jump") {
                  const point = flow.screenToFlowPosition(
                    { x: event.clientX, y: event.clientY },
                    { snapToGrid: false },
                  );
                  const group = groupAt(point);
                  void pickJump(
                    group ? { group } : { point },
                    currentTab,
                    point,
                  );
                  return;
                }
                if (
                  (groupPicking || tool === "select") &&
                  selected.length >= 2 &&
                  !confirmGroup
                )
                  setConfirmGroup(true);
                else clearCanvasPopups();
              }}
              onMoveStart={(event) => {
                if (
                  event?.type !== "mousedown" &&
                  event?.type !== "pointerdown" &&
                  event?.type !== "touchstart"
                )
                  return;
                if (
                  !(event.target instanceof Element) ||
                  !event.target.closest(".react-flow__pane")
                )
                  return;
                setBoard((b) => ({
                  ...b,
                  nodes: b.nodes.map((n) =>
                    n.selected ? { ...n, selected: false } : n,
                  ),
                  edges: b.edges.map((e) =>
                    e.selected ? { ...e, selected: false } : e,
                  ),
                }));
              }}
              nodesDraggable={
                !editing && ["select", "write", "hand"].includes(tool)
              }
              nodesConnectable={
                !editing && (tool === "select" || tool === "connect")
              }
              elementsSelectable={!shapeTool && tool !== "paint"}
              selectionOnDrag={tool === "select"}
              selectionMode={SelectionMode.Partial}
              multiSelectionKeyCode="Shift"
              selectionKeyCode={null}
              panOnDrag={
                tool === "hand" || tool === "write" ? [0, 1, 2] : [1, 2]
              }
              panActivationKeyCode={null}
              paneClickDistance={5}
              panOnScroll={false}
              zoomOnScroll={false}
              zoomOnPinch
              zoomOnDoubleClick={false}
              zoomActivationKeyCode="Control"
              minZoom={Math.min(minimumInteractiveZoom, board.viewport.zoom)}
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
        {tool === "polygon" && drawPolygon && (
          <div
            className="lm-draw-layer lm-polygon-plot"
            onPointerMove={(e) => {
              const last = drawPolygon.at(-1);
              if (!last) return;
              const [x, y] = last,
                dx = e.clientX - x,
                dy = e.clientY - y;
              polygonGuide.current?.setAttribute(
                "d",
                curvedPolygon
                  ? "M " +
                      x +
                      " " +
                      y +
                      " Q " +
                      (x + dx / 2 - dy * 0.23) +
                      " " +
                      (y + dy / 2 + dx * 0.23) +
                      " " +
                      e.clientX +
                      " " +
                      e.clientY
                  : "M " + x + " " + y + " L " + e.clientX + " " + e.clientY,
              );
              const first = drawPolygon[0];
              polygonStart.current?.setAttribute(
                "r",
                drawPolygon.length >= 3 &&
                  Math.hypot(first[0] - e.clientX, first[1] - e.clientY) <= 13
                  ? "12"
                  : "7",
              );
            }}
            onClick={(e) => {
              const point: PolygonPoint = [e.clientX, e.clientY];
              const first = drawPolygon[0];
              if (
                first &&
                drawPolygon.length >= 3 &&
                Math.hypot(point[0] - first[0], point[1] - first[1]) <= 13
              ) {
                const x = Math.min(...drawPolygon.map((p) => p[0])),
                  y = Math.min(...drawPolygon.map((p) => p[1]));
                const width = Math.max(
                    40,
                    Math.max(...drawPolygon.map((p) => p[0])) - x,
                  ),
                  height = Math.max(
                    40,
                    Math.max(...drawPolygon.map((p) => p[1])) - y,
                  );
                const points = drawPolygon.map(
                  ([px, py]) =>
                    [
                      ((px - x) / width) * 100,
                      ((py - y) / height) * 100,
                    ] as PolygonPoint,
                );
                const id = add(
                  "polygon",
                  x,
                  y,
                  width / board.viewport.zoom,
                  height / board.viewport.zoom,
                  { points, curved: curvedPolygon },
                );
                updatePreferences({
                  recent: points,
                  recentForms: [
                    points,
                    ...generalPreferences.recentForms.filter(
                      (form) => JSON.stringify(form) !== JSON.stringify(points),
                    ),
                  ].slice(0, 5),
                });
                setDrawPolygon(null);
                setTool("hand");
                setToolMenu(null);
                setPinForm({ x: e.clientX, y: e.clientY, points, id });
              } else if (drawPolygon.length < 100)
                setDrawPolygon([...drawPolygon, point]);
            }}
          >
            <svg className="lm-polygon-preview" aria-hidden>
              <path
                d={
                  curvedPolygon
                    ? curvedOutline(drawPolygon, false)
                    : drawPolygon.length
                      ? "M " + drawPolygon.map((p) => p.join(",")).join(" L ")
                      : ""
                }
                fill="none"
                stroke={fill}
                strokeWidth={2}
              />
              {drawPolygon.length > 0 &&
                (() => {
                  const [x, y] = drawPolygon.at(-1)!;
                  return (
                    <path
                      key={drawPolygon.length}
                      ref={polygonGuide}
                      d={"M " + x + " " + y}
                      fill="none"
                      stroke={fill}
                      strokeWidth={2}
                    />
                  );
                })()}
              {drawPolygon.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  ref={i === 0 ? polygonStart : undefined}
                  r={i === 0 ? 7 : 4}
                  fill="#fff"
                  stroke="#6e55a5"
                  strokeWidth={2}
                />
              ))}
            </svg>
          </div>
        )}
        {pinForm && (
          <div
            className="lm-pin-form"
            style={{
              left: Math.min(pinForm.x, innerWidth - 210),
              top: Math.min(pinForm.y, innerHeight - 70),
            }}
          >
            <button
              onClick={() => {
                pinPolygon(pinForm.points);
                setPinForm(null);
              }}
            >
              Hinzufügen
            </button>
            {!pinForm.straightened && (
              <button
                onClick={() => {
                  const points = straightenForm(pinForm.points);
                  checkpoint();
                  patch(pinForm.id, { points });
                  updatePreferences({
                    recent: points,
                    recentForms: [
                      points,
                      ...generalPreferences.recentForms.filter(
                        (form) => form !== pinForm.points,
                      ),
                    ].slice(0, 5),
                  });
                  setPinForm({ ...pinForm, points, straightened: true });
                }}
              >
                Begradigen
              </button>
            )}
            <button aria-label="Schließen" onClick={() => setPinForm(null)}>
              ×
            </button>
          </div>
        )}
        {shapeTool && !(tool === "polygon" && drawPolygon) && storage.ready && (
          <div
            className="lm-draw-layer"
            onDoubleClick={(e) => {
              const id = shapeHit.current;
              const node = board.nodes.find((n) => n.id === id);
              if (
                !node ||
                tool === "ink" ||
                ["image", "ink", "media"].includes(node.data.kind)
              )
                return;
              e.stopPropagation();
              setTool("write");
              begin(node.id);
            }}
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
                  width:
                    tool === "circle"
                      ? Math.max(
                          Math.abs(e.clientX - start.x),
                          Math.abs(e.clientY - start.y),
                        )
                      : Math.abs(e.clientX - start.x),
                  height:
                    tool === "circle"
                      ? Math.max(
                          Math.abs(e.clientX - start.x),
                          Math.abs(e.clientY - start.y),
                        )
                      : Math.abs(e.clientY - start.y),
                });
            }}
            onPointerUp={(e) => {
              const start = drawing.current;
              if (!start) return;
              if (tool !== "ink" && shapeHit.current && !leavingText.current) {
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
                drag =
                  w > 8 ||
                  h > 8 ||
                  (tool === "ink" &&
                    strokePoints.current.some(
                      ([x, y]) => Math.hypot(x - start.x, y - start.y) > 8,
                    ));
              if (tool === "symbols" && drag && !leavingText.current) {
                add(
                  customSymbols[symbol] ? "image" : "symbol",
                  Math.min(start.x, e.clientX),
                  Math.min(start.y, e.clientY),
                  Math.max(42, w) / board.viewport.zoom,
                  Math.max(42, h) / board.viewport.zoom,
                  {
                    text: symbol,
                    fill: "transparent",
                    stroke: "transparent",
                    image: customSymbols[symbol],
                  },
                );
                drawing.current = null;
                setDraft(null);
                return;
              }
              if (!drag || (leavingText.current && tool !== "ink")) {
                if (!leavingText.current) clearCanvasPopups();
                drawing.current = null;
                setDraft(null);
                setStroke([]);
                return;
              }
              if (tool === "ink") {
                const points = displayStroke(strokePoints.current);
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
                      fill: pen.color,
                      strokeWidth: pen.width,
                      opacity: pen.opacity,
                      inkStyle: pen.style,
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
                drag
                  ? Math.max(60, tool === "circle" ? Math.max(w, h) : w) /
                      board.viewport.zoom
                  : undefined,
                drag
                  ? Math.max(50, tool === "circle" ? Math.max(60, w, h) : h) /
                      board.viewport.zoom
                  : undefined,
                tool === "polygon"
                  ? { points: polygonTemplate ?? preferences.recent }
                  : {},
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
        {importAt && (
          <section
            className="lm-import-menu lm-format"
            style={{
              left: Math.max(8, Math.min(innerWidth - 310, importAt.x)),
              top: Math.max(65, Math.min(innerHeight - 240, importAt.y)),
              right: "auto",
              maxHeight: "45vh",
              overflow: "auto",
            }}
            aria-label="LifeMap importieren"
          >
            <strong>LifeMap importieren</strong>
            {tabs
              .filter((t) => t.id !== currentTab)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={async () => {
                    try {
                      const response = await fetch(
                        "/api/sketchboard?tab=" + encodeURIComponent(t.id),
                      );
                      if (!response.ok)
                        throw new Error("Tab konnte nicht geladen werden.");
                      loadImport((await response.json()).board);
                    } catch (error) {
                      setImportError((error as Error).message);
                    }
                  }}
                >
                  {t.title}
                </button>
              ))}
            {Object.entries(importNotes)
              .filter(
                ([key, value]) =>
                  value &&
                  (notebookFolder(key) ||
                    /^(?:(?:week|month):)?\d{4}-\d{2}-\d{2}$/.test(key)),
              )
              .map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const point = importAt;
                    const text = readNoteLines(value)
                      .map((line) => line.text)
                      .join("\n");
                    add("sticky", point.x, point.y, undefined, undefined, {
                      text,
                    });
                    setEditing("");
                    setImportAt(null);
                    setToolMenu(null);
                  }}
                >
                  <FileText size={15} />
                  {notebookTitle(key, value)}
                </button>
              ))}
            <label>
              Gespeicherte Datei{" "}
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 8_000_000)
                      throw new Error("Die Datei ist zu groß.");
                    loadImport(JSON.parse(await file.text()));
                  } catch (error) {
                    setImportError((error as Error).message);
                  }
                }}
              />
            </label>
            {importError && <span role="alert">{importError}</span>}
            <button onClick={() => setImportAt(null)}>Abbrechen</button>
          </section>
        )}
        {preview &&
          (() => {
            const point = flow.flowToScreenPosition(preview);
            const width =
              Math.max(
                ...previewNodes.map((n) => n.position.x + (n.width ?? 0)),
              ) - preview.x;
            const height =
              Math.max(
                ...previewNodes.map((n) => n.position.y + (n.height ?? 0)),
              ) - preview.y;
            return (
              <>
                <div
                  className="lm-import-preview"
                  style={{
                    left: point.x,
                    top: point.y,
                    width: width * board.viewport.zoom,
                    height: height * board.viewport.zoom,
                  }}
                  onPointerDown={(e) => {
                    previewDrag.current = {
                      x: e.clientX,
                      y: e.clientY,
                      left: preview.x,
                      top: preview.y,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const drag = previewDrag.current;
                    if (
                      !drag ||
                      !e.currentTarget.hasPointerCapture(e.pointerId)
                    )
                      return;
                    setPreview(
                      (p) =>
                        p && {
                          ...p,
                          x:
                            drag.left +
                            (e.clientX - drag.x) / board.viewport.zoom,
                          y:
                            drag.top +
                            (e.clientY - drag.y) / board.viewport.zoom,
                        },
                    );
                  }}
                >
                  {["nw", "ne", "sw", "se"].map((corner) => (
                    <button
                      key={corner}
                      className={"lm-import-handle lm-import-" + corner}
                      aria-label="Importgröße ändern"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        e.currentTarget.dataset.start = JSON.stringify({
                          clientX: e.clientX,
                          clientY: e.clientY,
                          x: preview.x,
                          y: preview.y,
                          scale: preview.scale,
                          width,
                          height,
                        });
                      }}
                      onPointerMove={(e) => {
                        if (!e.currentTarget.hasPointerCapture(e.pointerId))
                          return;
                        const start = JSON.parse(
                          e.currentTarget.dataset.start!,
                        );
                        const dx =
                          ((e.clientX - start.clientX) *
                            (corner.endsWith("w") ? -1 : 1)) /
                          board.viewport.zoom;
                        const dy =
                          ((e.clientY - start.clientY) *
                            (corner.startsWith("n") ? -1 : 1)) /
                          board.viewport.zoom;
                        const change =
                          (dx * start.width + dy * start.height) /
                          (start.width ** 2 + start.height ** 2);
                        const scale = Math.max(
                          0.1,
                          Math.min(5, start.scale * (1 + change)),
                        );
                        setPreview(
                          (p) =>
                            p && {
                              ...p,
                              scale,
                              x:
                                start.x +
                                (corner.endsWith("w")
                                  ? start.width * (1 - scale / start.scale)
                                  : 0),
                              y:
                                start.y +
                                (corner.startsWith("n")
                                  ? start.height * (1 - scale / start.scale)
                                  : 0),
                            },
                        );
                      }}
                    />
                  ))}
                </div>
                <div className="lm-import-actions">
                  <button onClick={mergePreview}>Zusammenführen</button>
                  <button onClick={() => setPreview(null)}>Abbrechen</button>
                </div>
              </>
            );
          })()}
        {stroke.length > 0 && (
          <svg className="lm-ink-preview">
            <polyline
              points={displayStroke(stroke).join(" ")}
              fill="none"
              stroke={pen.color}
              strokeWidth={
                creationStroke(pen.width, board.viewport.zoom) *
                board.viewport.zoom
              }
              opacity={pen.opacity}
            />
          </svg>
        )}
        {tool === "connect" &&
          connectFrom.current &&
          linkPointer &&
          (() => {
            const id = connectFrom.current;
            const node = board.nodes.find((n) => n.id === id);
            const hit = document
              .elementsFromPoint(linkPointer.x, linkPointer.y)
              .map((el) =>
                el.closest(".react-flow__node-shape,.react-flow__edge"),
              )
              .find(Boolean);
            const hitId = hit?.getAttribute("data-id");
            const destination = board.nodes.find(
              (n) => n.id === hitId && n.id !== id,
            );
            const edgePoint =
              hit?.classList.contains("react-flow__edge") &&
              hitId &&
              id !== "line:" + hitId
                ? anchors[hitId]
                : undefined;
            const pointer = flow.screenToFlowPosition(linkPointer, {
              snapToGrid: false,
            });
            const side = destination
              ? connectionSide(destination, pointer)
              : undefined;
            const end =
              destination && side
                ? connectionPoint(destination, side[0], side[2])
                : (edgePoint ?? pointer);
            const sourceSide =
              node && node.data.kind !== "connection-anchor"
                ? connectionSide(node, end)
                : undefined;
            const start = node
              ? sourceSide
                ? connectionPoint(node, sourceSide[0], sourceSide[2])
                : node.position
              : anchors[id.slice(5)];
            if (!start) return null;
            const [path] = boardEdgePath(connection.type, {
              sourceX: start.x,
              sourceY: start.y,
              targetX: end.x,
              targetY: end.y,
              sourcePosition: node
                ? ((sourceSide?.[0] ?? "right") as Position)
                : Position.Top,
              targetPosition: edgePoint
                ? Position.Top
                : side
                  ? (side[0] as Position)
                  : Position.Left,
            });
            const { x, y, zoom } = flow.getViewport();
            const bounds = host.current?.getBoundingClientRect();
            const thread = preferences.pattern === "cork";
            return (
              <svg className="lm-link-preview" aria-hidden>
                <defs>
                  <marker
                    id="lm-preview-arrow"
                    viewBox="-10 -10 20 20"
                    markerWidth={Math.max(
                      26,
                      creationStroke(connection.width, zoom) *
                        connectionWeight *
                        2.15,
                    )}
                    markerHeight={Math.max(
                      26,
                      creationStroke(connection.width, zoom) *
                        connectionWeight *
                        2.15,
                    )}
                    markerUnits="userSpaceOnUse"
                    orient="auto-start-reverse"
                  >
                    <polyline
                      points="-7,-5 0,0 -7,5 -7,-5"
                      fill={connection.color}
                      stroke={connection.color}
                    />
                  </marker>
                </defs>
                <path
                  transform={`translate(${x + (bounds?.left ?? 0)} ${y + (bounds?.top ?? 0)}) scale(${zoom})`}
                  className={
                    thread ? "react-flow__edge-path lm-thread" : undefined
                  }
                  d={path}
                  fill="none"
                  stroke={connection.color}
                  strokeWidth={
                    creationStroke(connection.width, zoom) * connectionWeight
                  }
                  strokeLinecap={thread ? "round" : undefined}
                  strokeDasharray={connection.dash}
                  markerEnd={
                    connection.arrows !== "none"
                      ? "url(#lm-preview-arrow)"
                      : undefined
                  }
                  markerStart={
                    connection.arrows === "both"
                      ? "url(#lm-preview-arrow)"
                      : undefined
                  }
                />
              </svg>
            );
          })()}
        {draft && (
          <div
            className="lm-draft"
            data-preview={tool}
            style={{
              left: draft.x,
              top: draft.y,
              width: draft.width,
              height: draft.height,
              background:
                tool === "text"
                  ? "transparent"
                  : tool === "sticky"
                    ? palette[3]
                    : fill,
            }}
          >
            {tool === "symbols" &&
              (customSymbols[symbol] ? (
                <img
                  src={customSymbols[symbol]}
                  className="lm-symbol-art"
                  alt=""
                />
              ) : (
                <SymbolArt name={symbol} stroke="#4e485f" fill="none" />
              ))}
            {(tool === "polygon" || tool === "diamond") && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d={roundedOutline(
                    tool === "diamond"
                      ? [
                          [50, 0],
                          [100, 50],
                          [50, 100],
                          [0, 50],
                        ]
                      : (polygonTemplate ?? preferences.recent),
                    0,
                  )}
                  fill={fill}
                  stroke="#a58bc7"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
        )}
      </div>
      {shownGroup &&
        (() => {
          const list = board.nodes.filter((n) => n.data.group === shownGroup);
          const b = groupBounds(shownGroup);
          if (!b) return null;
          const scale = Math.min(
            1.7,
            (innerWidth * 0.72) / Math.max(1, b.width),
            (innerHeight * 0.65) / Math.max(1, b.height),
          );
          return (
            <div
              className="lm-group-overlay"
              onClick={() => setShownGroup(null)}
            >
              <section
                role="dialog"
                aria-label="Elementgruppe"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: b.width * scale + 32,
                  height: b.height * scale + 48,
                }}
              >
                <button
                  type="button"
                  className="lm-group-overlay-close"
                  aria-label="Schließen"
                  onClick={() => setShownGroup(null)}
                >
                  <X size={17} />
                </button>
                <div
                  className="lm-group-overlay-content"
                  style={{
                    width: b.width,
                    height: b.height,
                    transform: "scale(" + scale + ")",
                  }}
                >
                  {list.map((n) => (
                    <div
                      key={n.id}
                      className="lm-group-overlay-item"
                      style={{
                        left: n.position.x - b.x,
                        top: n.position.y - b.y,
                        width: n.width,
                        height: n.height,
                        background:
                          n.data.kind === "text" ? "transparent" : n.data.fill,
                        borderRadius:
                          n.data.kind === "circle" || n.data.kind === "ellipse"
                            ? "50%"
                            : n.data.radius,
                        color: n.data.color,
                        fontSize: n.data.fontSize,
                        fontFamily:
                          n.data.font === "System" ? undefined : n.data.font,
                      }}
                    >
                      {n.data.image ? (
                        <img src={n.data.image} alt="" />
                      ) : n.data.kind === "symbol" ? (
                        <SymbolArt
                          name={n.data.text}
                          stroke={n.data.color}
                          fill={n.data.fill}
                        />
                      ) : (
                        n.data.text
                      )}
                      {n.data.jumps?.map((link) => (
                        <button
                          key={link.id}
                          type="button"
                          onClick={() => {
                            setShownGroup(null);
                            void followJump(link);
                          }}
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          );
        })()}
      {board.nodes
        .flatMap((n) => n.data.jumps ?? [])
        .filter((jump) => jump.sourceGroup && !jump.sourceOffset)
        .map((jump) => {
          const bounds = groupBounds(jump.sourceGroup!);
          if (!bounds) return null;
          const p = flow.flowToScreenPosition({
            x: bounds.x + bounds.width / 2,
            y: bounds.y,
          });
          return (
            <button
              key={jump.id}
              type="button"
              className="lm-group-jump"
              style={{ left: p.x, top: p.y }}
              onClick={() => void followJump(jump)}
            >
              <Link2 size={13} />
              {jump.label}
            </button>
          );
        })}
      {board.nodes.flatMap((node) =>
        (node.data.jumps ?? [])
          .filter((jump) => jump.sourceOffset)
          .map((jump) => {
            const p = flow.flowToScreenPosition({
              x: node.position.x + jump.sourceOffset!.x,
              y: node.position.y + jump.sourceOffset!.y,
            });
            return (
              <button
                key={jump.id}
                type="button"
                className="lm-placed-jump"
                style={{ left: p.x, top: p.y }}
                onClick={() => void followJump(jump)}
              >
                <Link2 size={13} />
                {jump.label}
              </button>
            );
          }),
      )}
      {jumpDraft?.tab === currentTab &&
        jumpDraft.position &&
        (() => {
          const point = flow.flowToScreenPosition(jumpDraft.position);
          return (
            <div
              className="lm-placed-jump lm-jump-draft"
              style={{ left: point.x, top: point.y }}
            >
              <Link2 size={13} />
              <input
                autoFocus
                aria-label="Name des Sprungbuttons"
                maxLength={80}
                value={jumpLabel}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setJumpLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </div>
          );
        })()}
      {tool === "connect" &&
        connectFrom.current &&
        (() => {
          const n = board.nodes.find((node) => node.id === connectFrom.current);
          const raw = n
            ? {
                x:
                  n.position.x +
                  (n.data.kind === "connection-anchor"
                    ? 0
                    : (n.width ?? 0) / 2),
                y:
                  n.position.y +
                  (n.data.kind === "connection-anchor" ? 0 : (n.height ?? 0)),
              }
            : anchors[connectFrom.current!.slice(5)];
          if (!raw) return null;
          const point = flow.flowToScreenPosition(raw);
          return (
            <button
              type="button"
              className="lm-placed-jump lm-connection-stop"
              aria-label="Verbindung beenden"
              title="Verbindung beenden"
              style={{ left: point.x + 12, top: point.y + 12 }}
              onClick={() => {
                connectFrom.current = null;
                setLinkPointer(null);
                setBoard((b) => ({
                  ...b,
                  edges: b.edges.map((edge) => ({ ...edge, selected: false })),
                  nodes: b.nodes.map((n) => ({ ...n, selected: false })),
                }));
              }}
            >
              <X size={14} />
            </button>
          );
        })()}
      {sourceGroupFrame &&
        jumpDraft?.tab === currentTab &&
        (() => {
          const origin = flow.flowToScreenPosition(sourceGroupFrame);
          return (
            <div
              className="lm-group-frame lm-jump-source"
              style={{
                left: origin.x,
                top: origin.y,
                width: sourceGroupFrame.width * board.viewport.zoom,
                height: sourceGroupFrame.height * board.viewport.zoom,
              }}
            />
          );
        })()}
      {groupId &&
        members.length > 1 &&
        (() => {
          const left = Math.min(...members.map((n) => n.position.x)),
            top = Math.min(...members.map((n) => n.position.y));
          const width =
            Math.max(...members.map((n) => n.position.x + (n.width ?? 0))) -
            left;
          const height =
            Math.max(...members.map((n) => n.position.y + (n.height ?? 0))) -
            top;
          const origin = flow.flowToScreenPosition({ x: left, y: top });
          return (
            <GroupFrame
              left={origin.x}
              top={origin.y}
              width={width * board.viewport.zoom}
              height={height * board.viewport.zoom}
              onStart={checkpoint}
              onScale={(scale) =>
                setBoard((b) => ({
                  ...b,
                  nodes: b.nodes.map((n) => {
                    const seed = members.find((member) => member.id === n.id);
                    if (!seed) return n;
                    const w = Math.max(10, (seed.width ?? 10) * scale),
                      h = Math.max(10, (seed.height ?? 10) * scale);
                    return {
                      ...n,
                      width: w,
                      height: h,
                      style: { ...n.style, width: w, height: h },
                      position: {
                        x: left + (seed.position.x - left) * scale,
                        y: top + (seed.position.y - top) * scale,
                      },
                      data: {
                        ...n.data,
                        fontSize: Math.max(2, seed.data.fontSize * scale),
                      },
                    };
                  }),
                }))
              }
            />
          );
        })()}
      {linkHover && (
        <button
          type="button"
          className="lm-hover-link"
          aria-label="Verbindung beginnen"
          style={{ left: linkHover.x, top: linkHover.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            startLink(linkHover.id);
            setLinkHover(null);
          }}
        >
          <Waypoints size={15} />
        </button>
      )}
      {(tool !== "connect" || selectedEdges.length > 0) &&
        (selected.some((n) => n.data.kind !== "connection-anchor") ||
          selectedEdges.length > 0) && (
          <StoredPanel
            name="element"
            className="lm-format"
            label="Element formatieren"
            style={
              formatPosition
                ? {
                    ...formatPosition,
                    right: "auto",
                    maxHeight: "min(55vh, 460px)",
                    overflow: "auto",
                  }
                : selected[0] || selectedEdges[0]
                  ? (() => {
                      const edgePoint = anchors[selectedEdges[0]?.id];
                      const n = selected[0] ?? {
                        position: edgePoint ?? { x: 0, y: 0 },
                        width: 0,
                        height: 0,
                      };
                      const point = flow.flowToScreenPosition({
                        x: n.position.x + (n.width ?? 0),
                        y: n.position.y,
                      });
                      const origin = flow.flowToScreenPosition(n.position);
                      const bottom =
                        origin.y + (n.height ?? 0) * board.viewport.zoom;
                      const width = Math.min(294, innerWidth - 16),
                        height = Math.min(460, innerHeight * 0.55);
                      const clamp = (x: number, y: number) => ({
                        left: Math.max(8, Math.min(innerWidth - width - 8, x)),
                        top: Math.max(
                          70,
                          Math.min(innerHeight - height - 16, y),
                        ),
                      });
                      const candidates = [
                        clamp(point.x + 12, point.y),
                        clamp(origin.x - width - 12, origin.y),
                        clamp(origin.x, bottom + 12),
                        clamp(origin.x, origin.y - height - 12),
                        clamp(innerWidth - width - 16, 76),
                      ];
                      const overlap = ({
                        left,
                        top,
                      }: (typeof candidates)[number]) =>
                        board.nodes.reduce((total, item) => {
                          const screen = flow.flowToScreenPosition(
                            item.position,
                          );
                          const across = Math.max(
                            0,
                            Math.min(
                              left + width,
                              screen.x +
                                (item.width ?? 0) * board.viewport.zoom,
                            ) - Math.max(left, screen.x),
                          );
                          const down = Math.max(
                            0,
                            Math.min(
                              top + height,
                              screen.y +
                                (item.height ?? 0) * board.viewport.zoom,
                            ) - Math.max(top, screen.y),
                          );
                          return total + across * down;
                        }, 0);
                      const nearby = selected[0]
                        ? candidates.slice(0, 4)
                        : candidates;
                      const best = nearby.reduce((a, b) =>
                        overlap(b) < overlap(a) ? b : a,
                      );
                      return {
                        ...best,
                        right: "auto",
                        maxHeight: "min(55vh, 460px)",
                        overflow: "auto",
                      };
                    })()
                  : undefined
            }
          >
            <div
              className="lm-format-grip lm-format-drag-edge"
              onPointerDown={(e) => {
                if (
                  e.button !== 0 ||
                  (e.target as HTMLElement).closest("button,input,select")
                )
                  return;
                const bounds =
                  e.currentTarget.parentElement!.getBoundingClientRect();
                formatDrag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  left: bounds.left,
                  top: bounds.top,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const drag = formatDrag.current;
                if (!drag || !e.currentTarget.hasPointerCapture(e.pointerId))
                  return;
                setFormatPosition({
                  left: Math.max(
                    8,
                    Math.min(innerWidth - 80, drag.left + e.clientX - drag.x),
                  ),
                  top: Math.max(
                    65,
                    Math.min(innerHeight - 50, drag.top + e.clientY - drag.y),
                  ),
                });
              }}
              onDoubleClick={(e) => {
                if (!(e.target as HTMLElement).closest("button"))
                  setFormatPosition(null);
              }}
            ></div>
            {data && (
              <>
                {data.kind === "sticky" && (
                  <section
                    className="lm-sticky-options"
                    aria-label="Notizzettel-Vorlagen"
                  >
                    <div
                      className="lm-sticky-gallery"
                      role="group"
                      aria-label="Vorlagen auswählen"
                      tabIndex={0}
                    >
                      {Object.entries(stickyStyles).map(([style, label]) => (
                        <button
                          key={style}
                          type="button"
                          title={label}
                          aria-label={label}
                          aria-pressed={
                            !data.stickyMask &&
                            (data.stickyStyle ?? "pin") === style
                          }
                          onClick={() =>
                            format({
                              stickyStyle: style as ShapeData["stickyStyle"],
                              stickyMask: undefined,
                            })
                          }
                        >
                          <StickyPaper
                            paper={{
                              fill: data.fill,
                              paper: data.paper,
                              stickyStyle: style as ShapeData["stickyStyle"],
                            }}
                            className="lm-sticky-surface"
                          />
                        </button>
                      ))}
                      {stickyImports.map(({ name, src }, index) => (
                        <button
                          key={index}
                          type="button"
                          title={name}
                          aria-label={name}
                          aria-pressed={data.stickyMask === src}
                          onClick={() => format({ stickyMask: src })}
                        >
                          <StickyPaper
                            paper={{ fill: data.fill, stickyMask: src }}
                            className="lm-sticky-surface"
                          />
                        </button>
                      ))}
                      <label
                        className="lm-import-tile"
                        title="Notizzettel importieren"
                      >
                        <Plus size={19} aria-hidden />
                        <input
                          type="file"
                          aria-label="Notizzettel importieren"
                          accept="image/png,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            if (
                              file.size > 650_000 ||
                              !["image/png", "image/webp"].includes(file.type)
                            ) {
                              setStickyError(
                                "PNG oder WebP mit transparentem Hintergrund, bis 650 KB.",
                              );
                              return;
                            }
                            const ids = new Set(
                              selected.map((node) => node.id),
                            );
                            const reader = new FileReader();
                            reader.onerror = () =>
                              setStickyError(
                                "Die Datei konnte nicht gelesen werden.",
                              );
                            reader.onload = () => {
                              const src = reader.result;
                              if (!validPicture(src)) {
                                setStickyError(
                                  "Die Datei konnte nicht als Vorlage gelesen werden.",
                                );
                                return;
                              }
                              const next = [
                                ...stickyImports,
                                { name: file.name.slice(0, 90), src },
                              ];
                              try {
                                localStorage.setItem(
                                  "lifemap-note-templates",
                                  JSON.stringify(next),
                                );
                                setStickyImports(next);
                                setStickyError("");
                                checkpoint();
                                setBoard((b) => ({
                                  ...b,
                                  nodes: b.nodes.map((n) =>
                                    ids.has(n.id) && n.data.kind === "sticky"
                                      ? {
                                          ...n,
                                          data: { ...n.data, stickyMask: src },
                                        }
                                      : n,
                                  ),
                                }));
                              } catch {
                                setStickyError(
                                  "Der lokale Vorlagenspeicher ist voll.",
                                );
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                    {stickyError && <small role="alert">{stickyError}</small>}
                  </section>
                )}

                <div className="lm-compact-format">
                  <ColorSwatches
                    name="Formfüllung"
                    presetGroup={preferences.paletteStyle}
                    value={data.fill}
                    onChange={(e) => format({ fill: e.target.value })}
                    presets={
                      elementPalettes[
                        preferences.paletteStyle as keyof typeof elementPalettes
                      ]?.colors ?? palette
                    }
                  />
                  <details className="lm-palette-style">
                    <summary
                      aria-label="Farbpalettenstil"
                      title="Farbpalettenstil"
                    >
                      <Palette size={14} />
                    </summary>
                    <div>
                      {Object.entries(elementPalettes).map(([id, style]) => (
                        <button
                          type="button"
                          key={id}
                          aria-pressed={preferences.paletteStyle === id}
                          onClick={(e) => {
                            toolbarPreferences({ paletteStyle: id });
                            e.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                          }}
                        >
                          {style.label}
                          <span aria-hidden>
                            {style.colors.slice(0, 5).map((color) => (
                              <i key={color} style={{ background: color }} />
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                  <ColorSwatches
                    compactBackground
                    name="Schrifthintergrund"
                    value={data.textBackground}
                    onChange={(e) => format({ textBackground: e.target.value })}
                  />
                  <label>
                    <input
                      type="range"
                      aria-label="Deckkraft"
                      className="lm-opacity"
                      min={0}
                      max={1}
                      step={0.05}
                      value={data.opacity ?? 1}
                      onChange={(e) => format({ opacity: +e.target.value })}
                    />
                  </label>
                </div>
                <div className="lm-compact-format">
                  <span>Rand</span>
                  <FormatSamples
                    name="Rundung"
                    rounded
                    value={data.radius}
                    onChange={(radius) => format({ radius })}
                  />
                  <FormatSamples
                    name="Randstärke"
                    value={data.strokeWidth}
                    onChange={(strokeWidth) =>
                      format({
                        strokeWidth,
                        ...(data.stroke === "transparent"
                          ? { stroke: data.color }
                          : {}),
                      })
                    }
                  />
                  <UnderlinePicker
                    border
                    value={data.borderStyle}
                    onChange={(borderStyle) =>
                      format({
                        borderStyle,
                        ...(data.stroke === "transparent"
                          ? { stroke: data.color }
                          : {}),
                      })
                    }
                  />
                </div>
                <div className="lm-compact-format">
                  <ColorSwatches
                    name="Formrand"
                    value={data.stroke}
                    onChange={(e) => format({ stroke: e.target.value })}
                  />
                </div>
                <label className="lm-rotate-control">
                  Drehung{" "}
                  <input
                    type="range"
                    aria-label="Element drehen"
                    min={-180}
                    max={180}
                    value={data.rotation ?? 0}
                    onPointerDown={checkpoint}
                    onKeyDown={(event) => {
                      if (
                        [
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                          "Home",
                          "End",
                        ].includes(event.key)
                      )
                        checkpoint();
                    }}
                    onChange={(event) => {
                      const rotation = +event.target.value;
                      setBoard((b) => ({
                        ...b,
                        nodes: b.nodes.map((node) =>
                          node.selected
                            ? { ...node, data: { ...node.data, rotation } }
                            : node,
                        ),
                      }));
                    }}
                  />
                  <output>{data.rotation ?? 0}°</output>
                </label>
                <strong className="lm-font-heading">Schrift</strong>
                <div className="lm-compact-format lm-compact-text">
                  <select
                    aria-label="Schriftart"
                    value={data.font ?? "System"}
                    onChange={(e) => format({ font: e.target.value })}
                  >
                    {boardFonts.map((font) => (
                      <option key={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Schriftgröße"
                    value={data.fontSize}
                    onChange={(e) => format({ fontSize: +e.target.value })}
                  >
                    {Array.from(
                      new Set([
                        data.fontSize,
                        12,
                        16,
                        18,
                        20,
                        24,
                        28,
                        32,
                        40,
                        48,
                        64,
                        96,
                      ]),
                    )
                      .sort((a, b) => a - b)
                      .map((size) => (
                        <option key={size} value={size}>
                          {Number(size.toPrecision(3))}
                        </option>
                      ))}
                  </select>
                  <button
                    aria-label="Fett"
                    aria-pressed={data.bold}
                    onClick={() => format({ bold: !data.bold })}
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    aria-label="Kursiv"
                    aria-pressed={data.italic}
                    onClick={() => format({ italic: !data.italic })}
                  >
                    <Italic size={15} />
                  </button>
                  <UnderlinePicker
                    value={
                      data.underlineStyle ??
                      (data.underline ? "solid" : undefined)
                    }
                    onChange={(underlineStyle) =>
                      format({ underline: !!underlineStyle, underlineStyle })
                    }
                  />
                </div>
                <div className="lm-compact-format">
                  <ColorSwatches
                    name="Formtext"
                    value={data.color}
                    onChange={(e) => format({ color: e.target.value })}
                  />
                  {(["left", "center", "right"] as const).map((align, i) => {
                    const Icon = [AlignLeft, AlignCenter, AlignRight][i];
                    return (
                      <button
                        key={align}
                        aria-label={"Text " + align}
                        aria-pressed={data.align === align}
                        onClick={() => format({ align })}
                      >
                        <Icon size={15} />
                      </button>
                    );
                  })}
                </div>
                <>
                  {data.kind === "sticky" && (
                    <label>
                      Papier{" "}
                      <select
                        value={data.paper ?? "plain"}
                        onChange={(e) =>
                          format({
                            paper: e.target.value as ShapeData["paper"],
                          })
                        }
                      >
                        <option value="plain">Glatt</option>
                        <option value="lines">Liniert</option>
                        <option value="grid">Kariert</option>
                      </select>
                    </label>
                  )}
                </>
                {selected.length === 1 && (
                  <label className="lm-represent-group">
                    Elementgruppe repräsentieren{" "}
                    <select
                      value={data.representGroup ?? ""}
                      onChange={(e) =>
                        format({ representGroup: e.target.value || undefined })
                      }
                    >
                      <option value="">Keine</option>
                      {[
                        ...new Set(
                          board.nodes
                            .map((n) => n.data.group)
                            .filter(
                              (id): id is string => !!id && id !== data.group,
                            ),
                        ),
                      ].map((id, i) => (
                        <option key={id} value={id}>
                          {board.nodes
                            .find(
                              (n) => n.data.group === id && n.data.text.trim(),
                            )
                            ?.data.text.split("\n")[0] || "Gruppe " + (i + 1)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="lm-format-row">
                  <button
                    onClick={() => {
                      checkpoint();
                      const z =
                        Math.max(0, ...board.nodes.map((n) => n.zIndex || 0)) +
                        1;
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
                        Math.min(0, ...board.nodes.map((n) => n.zIndex || 0)) -
                        1;
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
                  <StandardButton
                    onSave={() => {
                      const {
                        fill,
                        stroke,
                        strokeWidth,
                        radius,
                        opacity,
                        color,
                        font,
                        fontSize,
                        align,
                        bold,
                        italic,
                        underline,
                        underlineStyle,
                        borderStyle,
                        textBackground,
                        stickyStyle,
                        stickyMask,
                        paper,
                      } = data;
                      updatePreferences({
                        elementStyles: {
                          ...preferences.elementStyles,
                          [data.kind]: {
                            fill,
                            stroke,
                            strokeWidth,
                            radius,
                            opacity,
                            color,
                            font,
                            fontSize: fontSize * flow.getViewport().zoom,
                            align,
                            bold,
                            italic,
                            underline,
                            underlineStyle,
                            borderStyle,
                            textBackground,
                            stickyStyle,
                            stickyMask,
                            paper,
                          },
                        },
                      });
                    }}
                  />
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
                        <option
                          key={font}
                          style={{
                            fontFamily: font === "System" ? "system-ui" : font,
                          }}
                        >
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Textfarbe{" "}
                    <ColorSwatches
                      name="Linientext"
                      value={caption.color}
                      onChange={(e) => setCaption({ color: e.target.value })}
                    />
                  </label>
                  <label>
                    Schrifthintergrund{" "}
                    <ColorSwatches
                      name="Linientext-Hintergrund"
                      value={
                        caption.background === "transparent"
                          ? "#ffffff"
                          : caption.background
                      }
                      onChange={(e) =>
                        setCaption({ background: e.target.value })
                      }
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
                  <UnderlinePicker
                    value={caption.underlineStyle}
                    onChange={(underlineStyle) =>
                      setCaption({ underlineStyle })
                    }
                  />
                </fieldset>
                <label>
                  Farbe
                  <ColorSwatches
                    name="Linienfarbe"
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
                  <FormatSamples
                    name="Linienstärke"
                    value={Number(edge.style?.strokeWidth || 1.5)}
                    onChange={(strokeWidth) =>
                      formatEdge({ style: { ...edge.style, strokeWidth } })
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
                      markerStart:
                        e.target.value === "both" ? marker : undefined,
                    });
                  }}
                >
                  <option value="none">Ohne Pfeil</option>
                  <option value="end">Einseitiger Pfeil</option>
                  <option value="both">Beidseitiger Pfeil</option>
                </select>
                <StandardButton
                  onSave={() => {
                    const { text: _text, ...lineCaption } = caption;
                    const line = {
                      type: edge.type ?? "default",
                      color: String(edge.style?.stroke ?? connection.color),
                      width: Number(
                        edge.style?.strokeWidth ?? connection.width,
                      ),
                      dash: String(edge.style?.strokeDasharray ?? ""),
                      arrows: edge.markerStart
                        ? "both"
                        : edge.markerEnd
                          ? "end"
                          : "none",
                    };
                    updatePreferences({
                      ...(corkMode
                        ? { corkConnection: line }
                        : { connection: line }),
                      lineCaption,
                    });
                    setConnectionOverride(null);
                  }}
                />
              </div>
            )}
          </StoredPanel>
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
      {removeTool && (
        <div
          className="lm-pin-form lm-remove-tool"
          style={{
            left: Math.min(removeTool.x, innerWidth - 170),
            top: Math.min(removeTool.y, innerHeight - 52),
          }}
        >
          <button
            onClick={() => {
              removeTool.remove();
              setRemoveTool(null);
            }}
          >
            Entfernen
          </button>
        </div>
      )}
      {confirmGroup && (
        <div
          className="lm-group-confirm"
          role="dialog"
          aria-label="Gruppieren?"
        >
          <span>Gruppieren?</span>
          <button
            type="button"
            aria-label="Gruppierung bestätigen"
            onClick={makeGroup}
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            aria-label="Gruppierung abbrechen"
            onClick={clearCanvasPopups}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {pinSymbol && (
        <div
          className="lm-pin-form lm-symbol-action"
          style={{
            left: Math.min(pinSymbol.x + 4, innerWidth - 155),
            top: Math.min(pinSymbol.y, innerHeight - 55),
          }}
        >
          <button
            onClick={() => {
              attachSymbol(pinSymbol.name);
              setPinSymbol(null);
            }}
          >
            Hinzufügen
          </button>
          <button
            type="button"
            aria-label="Symbol aus Galerie entfernen"
            title="Aus Galerie entfernen"
            onClick={() => {
              updatePreferences({
                hiddenSymbols: [
                  ...generalPreferences.hiddenSymbols,
                  pinSymbol.name,
                ],
              });
              setPinSymbol(null);
            }}
          >
            <X size={15} />
          </button>
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
          <div
            className={
              "lm-tool-options" +
              (["ink", "eraser"].includes(tool) ? " lm-pen-panel" : "")
            }
          >
            {tool === "connect" && !selectedEdges.length && (
              <>
                <span className="line-options" role="group" aria-label="Form">
                  {(
                    [
                      ["default", "Geschwungen"],
                      ["straight", "Gerade"],
                      ["smoothstep", "Abgewinkelt"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={connection.type === value}
                      onClick={() =>
                        setConnectionOverride({ ...connection, type: value })
                      }
                    >
                      <LineSample value={value} />
                    </button>
                  ))}
                </span>
                <span className="line-options" role="group" aria-label="Strich">
                  {(
                    [
                      ["", "Durchgezogen"],
                      ["7 5", "Gestrichelt"],
                      ["2 5", "Gepunktet"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={connection.dash === value}
                      onClick={() =>
                        setConnectionOverride({ ...connection, dash: value })
                      }
                    >
                      <LineSample value={value} />
                    </button>
                  ))}
                </span>
                <span className="line-options" role="group" aria-label="Pfeile">
                  {(
                    [
                      ["none", "Keine"],
                      ["end", "Einseitig"],
                      ["both", "Beidseitig"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={connection.arrows === value}
                      onClick={() =>
                        setConnectionOverride({ ...connection, arrows: value })
                      }
                    >
                      <LineSample value={value} />
                    </button>
                  ))}
                </span>
                <label>
                  Farbe{" "}
                  <ColorSwatches
                    name="Verbindung"
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
                <StandardButton
                  saved={!connectionOverride}
                  onSave={() => {
                    updatePreferences(
                      corkMode
                        ? { corkConnection: connection }
                        : { connection },
                    );
                    setConnectionOverride(null);
                  }}
                />
              </>
            )}
            {(tool === "ink" || tool === "eraser") && (
              <>
                <div className="lm-pen-presets" aria-label="Stiftspitzen">
                  {(
                    [
                      ["pen", "Stift", 3, 1, PenTool],
                      ["brush", "Pinsel", 9, 0.9, Brush],
                      ["marker", "Textmarker", 12, 0.34, Highlighter],
                      ["felt", "Filzstift", 6, 1, Pencil],
                      ["water", "Wasserfarbe", 11, 0.42, Droplet],
                    ] as const
                  ).map(([style, label, width, opacity, Icon]) => (
                    <button
                      key={style}
                      type="button"
                      data-pen-label={label}
                      aria-label={label}
                      aria-pressed={pen.style === style}
                      onClick={() => {
                        setEditing("");
                        setBoard((b) => ({
                          ...b,
                          nodes: b.nodes.map((n) =>
                            n.selected ? { ...n, selected: false } : n,
                          ),
                          edges: b.edges.map((edge) =>
                            edge.selected ? { ...edge, selected: false } : edge,
                          ),
                        }));
                        setTool("ink");
                        setPenOverride({ ...pen, style, width, opacity });
                      }}
                    >
                      <Icon size={17} />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Radiergummi"
                  title="Radiergummi – Stiftstriche entfernen"
                  onClick={() => {
                    setTool("eraser");
                    setToolMenu("ink");
                  }}
                >
                  <Eraser size={18} />
                </button>
                <ColorSwatches
                  name="Stift"
                  value={pen.color}
                  onChange={(e) =>
                    setPenOverride({ ...pen, color: e.target.value })
                  }
                />
                <label>
                  Dicke{" "}
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={pen.width}
                    onChange={(e) =>
                      setPenOverride({ ...pen, width: +e.target.value })
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
                    value={pen.opacity}
                    onChange={(e) =>
                      setPenOverride({ ...pen, opacity: +e.target.value })
                    }
                  />
                </label>
                <div className="lm-pen-secondary">
                  <label>
                    <input
                      type="checkbox"
                      checked={pen.smooth}
                      onChange={(e) =>
                        setPenOverride({ ...pen, smooth: e.target.checked })
                      }
                    />{" "}
                    Glätten
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={pen.straight}
                      onChange={(e) =>
                        setPenOverride({ ...pen, straight: e.target.checked })
                      }
                    />{" "}
                    Gerade Linie
                  </label>
                  <StandardButton
                    saved={!penOverride}
                    onSave={() => {
                      updatePreferences({ pen });
                      setPenOverride(null);
                    }}
                  />
                </div>
              </>
            )}
            {tool === "jump" && (
              <div className="lm-jump-options">
                <span>
                  {jumpDraft
                    ? "Ziel anklicken"
                    : "Startelement oder Gruppe anklicken"}
                </span>
                <input
                  aria-label="Beschriftung des Sprungbuttons"
                  value={jumpLabel}
                  maxLength={80}
                  onChange={(e) => setJumpLabel(e.target.value)}
                />
                {jumpTab && (
                  <>
                    <button
                      type="button"
                      aria-label="Tab als Ziel bestätigen"
                      onClick={() => void pickJump({}, jumpTab)}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (jumpTab === currentTab) {
                          setJumpTab(null);
                          return;
                        }
                        if (jumpDraft)
                          sessionStorage.setItem(
                            "lifemap-jump-draft",
                            JSON.stringify({ ...jumpDraft, label: jumpLabel }),
                          );
                        void openTab(jumpTab);
                      }}
                    >
                      Tab öffnen
                    </button>
                  </>
                )}
                {mediaError && <span role="alert">{mediaError}</span>}
              </div>
            )}
            {toolMenu === "polygon" && (
              <div className="lm-form-picker" aria-label="Formvorlagen">
                <div role="group" aria-label="Freiform-Kanten">
                  <button
                    aria-label="Gerade Kanten"
                    title="Gerade Kanten"
                    aria-pressed={!curvedPolygon}
                    onClick={() => setCurvedPolygon(false)}
                  >
                    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden>
                      <path d="M3 9h20" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                  <button
                    aria-label="Gebogene Kanten"
                    title="Gebogene Kanten"
                    aria-pressed={curvedPolygon}
                    onClick={() => setCurvedPolygon(true)}
                  >
                    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden>
                      <path
                        d="M3 13Q13 1 23 9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                </div>
                {generalPreferences.recentForms.length > 0 && (
                  <div role="group" aria-label="Zuletzt erstellt">
                    <small>Zuletzt erstellt</small>
                    {generalPreferences.recentForms.map((points, i) => (
                      <button
                        key={i}
                        title={"Zuletzt erstellt " + (i + 1)}
                        aria-label={"Zuletzt erstellt " + (i + 1)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/x-lifemap-recent-form",
                            String(i),
                          );
                          e.dataTransfer.setData(
                            "application/x-lifemap-shape",
                            JSON.stringify(points),
                          );
                        }}
                        onDragOver={(e) => {
                          if (
                            e.dataTransfer.types.includes(
                              "application/x-lifemap-recent-form",
                            )
                          )
                            e.preventDefault();
                        }}
                        onDrop={(e) => {
                          const id = e.dataTransfer.getData(
                            "application/x-lifemap-recent-form",
                          );
                          if (id === "") return;
                          e.preventDefault();
                          const next = [...generalPreferences.recentForms];
                          const [moved] = next.splice(Number(id), 1);
                          if (moved) {
                            next.splice(i, 0, moved);
                            updatePreferences({ recentForms: next });
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setRemoveTool({
                            x: e.clientX,
                            y: e.clientY,
                            remove: () =>
                              updatePreferences({
                                recentForms:
                                  generalPreferences.recentForms.filter(
                                    (_, index) => index !== i,
                                  ),
                              }),
                          });
                        }}
                        onClick={() => placeTemplate(points)}
                      >
                        <FormPreview points={points} />
                      </button>
                    ))}
                  </div>
                )}
                <div role="group" aria-label="Vorlagen">
                  {[...formTemplates]
                    .sort(
                      ([a], [b]) =>
                        templateNames.indexOf(a) - templateNames.indexOf(b),
                    )
                    .filter(
                      ([label]) =>
                        !generalPreferences.hiddenTemplates.includes(label),
                    )
                    .map(([label, points]) => (
                      <button
                        key={label}
                        title={label}
                        aria-label={label}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/x-lifemap-form-template",
                            label,
                          );
                          e.dataTransfer.setData(
                            "application/x-lifemap-shape",
                            JSON.stringify(points),
                          );
                        }}
                        onDragOver={(e) => {
                          if (
                            e.dataTransfer.types.includes(
                              "application/x-lifemap-form-template",
                            )
                          )
                            e.preventDefault();
                        }}
                        onDrop={(e) => {
                          const id = e.dataTransfer.getData(
                            "application/x-lifemap-form-template",
                          );
                          if (id) {
                            e.preventDefault();
                            updatePreferences({
                              templateOrder: moveGalleryItem(
                                templateNames,
                                id,
                                label,
                              ),
                            });
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setRemoveTool({
                            x: e.clientX,
                            y: e.clientY,
                            remove: () =>
                              updatePreferences({
                                hiddenTemplates: [
                                  ...generalPreferences.hiddenTemplates,
                                  label,
                                ],
                              }),
                          });
                        }}
                        onClick={() => placeTemplate(points)}
                      >
                        <FormPreview points={points} />
                      </button>
                    ))}
                </div>
              </div>
            )}
            {toolMenu === "symbols" && (
              <div
                className="lm-symbol-picker"
                aria-label="Symbolgalerie"
                tabIndex={0}
              >
                {mediaError && <span role="alert">{mediaError}</span>}
                {symbolNames
                  .filter(
                    (name) => !generalPreferences.hiddenSymbols.includes(name),
                  )
                  .map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={symbol === value}
                      aria-label={value}
                      title={value}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData(
                          "application/x-lifemap-symbol",
                          value,
                        )
                      }
                      onDragOver={(e) => {
                        if (
                          e.dataTransfer.types.includes(
                            "application/x-lifemap-symbol",
                          )
                        )
                          e.preventDefault();
                      }}
                      onDrop={(e) => {
                        const id = e.dataTransfer.getData(
                          "application/x-lifemap-symbol",
                        );
                        if (id) {
                          e.preventDefault();
                          updatePreferences({
                            symbolOrder: moveGalleryItem(
                              symbolNames,
                              id,
                              value,
                            ),
                          });
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const bounds = e.currentTarget.getBoundingClientRect();
                        setPinSymbol({
                          name: value,
                          x: bounds.right,
                          y: bounds.top,
                        });
                      }}
                      onClick={() => setSymbol(value)}
                    >
                      {customSymbols[value] ? (
                        <img
                          className="lm-custom-symbol"
                          alt=""
                          src={customSymbols[value]}
                        />
                      ) : (
                        <SymbolArt
                          name={value}
                          stroke="currentColor"
                          fill="none"
                        />
                      )}
                    </button>
                  ))}
                <label className="lm-import-tile" title="Symbol importieren">
                  <Plus size={19} aria-hidden />
                  <input
                    type="file"
                    aria-label="Symbol importieren"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (!validPicture(reader.result)) {
                          setMediaError(
                            "Symbol bitte als PNG, JPEG, WebP oder GIF bis etwa 650 KB auswählen.",
                          );
                          return;
                        }
                        const name = file.name.slice(0, 80);
                        const next = {
                          ...customSymbols,
                          [name]: reader.result,
                        };
                        try {
                          localStorage.setItem(
                            "lifemap-custom-symbols",
                            JSON.stringify(next),
                          );
                          setCustomSymbols(next);
                          setSymbol(name);
                          setMediaError("");
                        } catch {
                          setMediaError(
                            "Der Speicher für eigene Symbole ist voll.",
                          );
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            )}
            {toolMenu === "image" && (
              <div className="lm-media-menu">
                <button
                  type="button"
                  title="Ordner erstellen"
                  aria-label="Ordner erstellen"
                  onClick={() => {
                    const bounds = host.current?.getBoundingClientRect();
                    if (!bounds) return;
                    add(
                      "folder",
                      bounds.left + bounds.width / 2 - 110,
                      bounds.top + bounds.height / 2 - 65,
                    );
                    setTool("hand");
                    setToolMenu(null);
                  }}
                >
                  <FolderPlus size={19} />
                </button>
                <button
                  type="button"
                  title="Bild"
                  aria-label="Bild"
                  onClick={() => void pickMedia("image")}
                >
                  <ImagePlus size={19} />
                </button>
                <button
                  type="button"
                  title="Video"
                  aria-label="Video"
                  onClick={() => void pickMedia("video")}
                >
                  <Video size={19} />
                </button>
                <button
                  type="button"
                  title="Dokument"
                  aria-label="Dokument"
                  onClick={() => void pickMedia("document")}
                >
                  <FileText size={19} />
                </button>
                <button
                  type="button"
                  title="Tab importieren"
                  aria-label="Tab importieren"
                  onClick={() => void showTabImport()}
                >
                  <PanelsTopLeft size={19} />
                </button>
                <button
                  type="button"
                  title="Link aus Zwischenablage"
                  aria-label="Link aus Zwischenablage"
                  onClick={() => void pasteMediaLink()}
                >
                  <Link2 size={19} />
                </button>
                {mediaError && <span role="alert">{mediaError}</span>}
              </div>
            )}
            <button
              aria-label="Werkzeugoptionen schließen"
              onClick={() => {
                setToolMenu(null);
                setJumpDraft(null);
                setJumpTab(null);
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
          onDragStart={(e) => {
            const id = (e.target as Element).closest<HTMLElement>(
              "[data-toolbar-id]",
            )?.dataset.toolbarId;
            if (!id) return;
            e.dataTransfer.setData("application/x-lifemap-tool", id);
            e.dataTransfer.effectAllowed = "move";
            const ghost = document.createElement("canvas");
            ghost.width = ghost.height = 1;
            ghost.style.position = "fixed";
            ghost.style.left = "-10px";
            document.body.append(ghost);
            dragGhost.current = ghost;
            e.dataTransfer.setDragImage(ghost, 0, 0);
          }}
          onDragEnd={() => {
            dragGhost.current?.remove();
            dragGhost.current = null;
            setToolbarDrop(null);
          }}
          onDragLeave={(e) => {
            if (
              !(e.relatedTarget instanceof Node) ||
              !e.currentTarget.contains(e.relatedTarget)
            )
              setToolbarDrop(null);
          }}
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.some(
                (type) =>
                  type === "application/x-lifemap-shape" ||
                  type === "application/x-lifemap-symbol" ||
                  type === "application/x-lifemap-tool",
              )
            ) {
              e.preventDefault();
              const slot = dragSlot(e.clientX);
              const nav = e.currentTarget.getBoundingClientRect();
              const items = e.currentTarget.querySelectorAll<HTMLElement>(
                ":scope > [data-toolbar-id]",
              );
              const before = items[slot]?.getBoundingClientRect(),
                after = items[slot - 1]?.getBoundingClientRect();
              setToolbarDrop({
                slot,
                x:
                  before && after
                    ? (before.left + after.right) / 2 - nav.left
                    : before
                      ? before.left - nav.left - 2
                      : after
                        ? after.right - nav.left + 2
                        : 5,
              });
            }
          }}
          onDrop={(e) => {
            setToolbarDrop(null);
            const moved = e.dataTransfer.getData("application/x-lifemap-tool");
            if (moved && visibleToolbar.includes(moved)) {
              e.preventDefault();
              const slot = dragSlot(e.clientX);
              const next = visibleToolbar.filter((id) => id !== moved);
              next.splice(
                slot - (visibleToolbar.indexOf(moved) < slot ? 1 : 0),
                0,
                moved,
              );
              toolbarPreferences({ toolbarOrder: next });
              return;
            }
            const raw = e.dataTransfer.getData("application/x-lifemap-shape");
            const name = e.dataTransfer.getData("application/x-lifemap-symbol");
            if (name && symbolNames.includes(name)) {
              e.preventDefault();
              attachSymbol(name, dragSlot(e.clientX));
              return;
            }
            if (!raw) return;
            e.preventDefault();
            const points = JSON.parse(raw);
            if (
              validPoints(points) &&
              !pinnedForms.some((form) => JSON.stringify(form) === raw)
            ) {
              const order = [...visibleToolbar];
              order.splice(
                dragSlot(e.clientX),
                0,
                "form:" + JSON.stringify(points),
              );
              toolbarPreferences({
                pinned: null,
                pinnedForms: [...pinnedForms, points],
                toolbarOrder: order,
              });
            }
          }}
        >
          {visibleToolbar.map((id) => (
            <Fragment key={id}>
              {id === firstStyleTool && (
                <span className="lm-toolbar-separator" aria-hidden />
              )}
              {toolbarItems.get(id)}
            </Fragment>
          ))}
          {toolbarDrop && (
            <i
              className="lm-toolbar-drop"
              style={{ left: toolbarDrop.x }}
              aria-hidden
            />
          )}
          {colors && (
            <div className="lm-tool-palette">
              {tool === "paint" && (
                <div className="lm-paint-options">
                  <select
                    aria-label="Färber anwenden auf"
                    value={paintMode}
                    onChange={(e) => setPaintMode(e.target.value)}
                  >
                    <option value="fill">Nur Füllfarbe</option>
                    <option value="all">Füllfarbe und Deckkraft</option>
                    <option value="opacity">Nur Deckkraft</option>
                    <option value="stroke">Umrandung</option>
                  </select>
                  <label>
                    Deckkraft{" "}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={paintOpacity}
                      onChange={(e) => setPaintOpacity(+e.target.value)}
                    />
                  </label>
                  <StandardButton
                    onSave={() =>
                      updatePreferences({
                        paint: {
                          mode: paintMode,
                          opacity: paintOpacity,
                          width: paintWidth,
                          color: fill,
                        },
                      })
                    }
                  />
                  {paintMode === "stroke" && (
                    <label>
                      Randstärke{" "}
                      <input
                        type="range"
                        min={0}
                        max={12}
                        value={paintWidth}
                        onChange={(e) => setPaintWidth(+e.target.value)}
                      />
                    </label>
                  )}
                </div>
              )}

              <ColorSwatches
                name="Färber"
                value={fill}
                onChange={(e) => {
                  setFill(e.target.value);
                  if (tool !== "paint" && selected.length)
                    format({ fill: e.target.value });
                }}
                presets={palette}
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
          <span>{Number((board.viewport.zoom * 100).toPrecision(3))}%</span>
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
