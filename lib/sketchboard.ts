import type { Node, Edge, Viewport } from "@xyflow/react";

export const shapeKinds = [
  "rectangle",
  "rounded",
  "ellipse",
  "diamond",
  "text",
  "sticky",
  "image",
  "media",
  "polygon",
  "ink",
] as const;
export type ShapeKind = (typeof shapeKinds)[number];
export type ShapeData = {
  media?: { kind: "video" | "document" | "link"; url: string; name: string };
  textBackground?: string;
  kind: ShapeKind;
  text: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  opacity?: number;
  paper?: "plain" | "lines" | "grid";
  inkStyle?: string;
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  font?: string;
  image?: string;
  points?: [number, number][];
};
export const boardFonts = [
  "System",
  "Arial",
  "Georgia",
  "Verdana",
  "Consolas",
  "Cambria",
  "Trebuchet MS",
  "Times New Roman",
  "Courier New",
  "Segoe UI",
];
export const validPoints = (points: unknown): points is [number, number][] =>
  Array.isArray(points) &&
  points.length >= 2 &&
  points.length <= 1500 &&
  points.every(
    (p) =>
      Array.isArray(p) && p.length === 2 && p.every((v) => number(v, 0, 100)),
  );
export const validPicture = (src: unknown): src is string =>
  typeof src === "string" &&
  src.length <= 900_000 &&
  /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(src);
export function validMedia(
  value: unknown,
): value is NonNullable<ShapeData["media"]> {
  if (!value || typeof value !== "object") return false;
  const { kind, url, name } = value as NonNullable<ShapeData["media"]>;
  if (
    !["video", "document", "link"].includes(kind) ||
    typeof url !== "string" ||
    typeof name !== "string" ||
    name.length > 255
  )
    return false;
  if (url.startsWith("data:"))
    return (
      url.length <= 6_000_000 &&
      (kind === "video"
        ? /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+=*$/.test(url)
        : kind === "document" &&
          /^data:application\/(pdf|octet-stream);base64,[A-Za-z0-9+/]+=*$/.test(
            url,
          ))
    );
  try {
    return (
      url.length <= 2048 && ["https:", "http:"].includes(new URL(url).protocol)
    );
  } catch {
    return false;
  }
}
export type LineLabel = {
  text: string;
  size: number;
  angle: number;
  color: string;
  background: string;
  font: string;
  bold: boolean;
  italic: boolean;
};
export const emptyLineLabel: LineLabel = {
  text: "",
  size: 12,
  angle: 0,
  color: "#29352f",
  background: "transparent",
  font: "System",
  bold: false,
  italic: false,
};
export type ShapeNode = Node<ShapeData, "shape">;
export type Board = {
  version: 1;
  nodes: ShapeNode[];
  edges: Edge[];
  viewport: Viewport;
  grid: boolean;
};
export const palette = [
  "#e9ddfa",
  "#fbe0e8",
  "#ffe4cd",
  "#fff0b8",
  "#dff0e2",
  "#dcecff",
  "#dce0fa",
  "#d6f1f1",
  "#ffffff",
];
export function emptyBoard(): Board {
  return {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    grid: false,
  };
}
export function newShape(
  kind: ShapeKind,
  x: number,
  y: number,
  fill = palette[0],
  width = kind === "sticky" ? 240 : 220,
  height = kind === "text" ? 80 : kind === "sticky" ? 220 : 140,
): ShapeNode {
  return {
    id: crypto.randomUUID(),
    type: "shape",
    position: { x, y },
    width,
    height,
    style: { width, height },
    data: {
      kind,
      text: "",
      fill:
        kind === "text" ? "transparent" : kind === "sticky" ? palette[3] : fill,
      stroke: kind === "text" || kind === "sticky" ? "transparent" : "#a58bc7",
      strokeWidth: 1.5,
      radius: kind === "rounded" ? 24 : kind === "sticky" ? 6 : 0,
      color: "#29352f",
      fontSize: 24,
      bold: false,
      italic: false,
      align: kind === "sticky" || kind === "text" ? "left" : "center",
    },
  };
}
const number = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const color = (v: unknown) =>
  typeof v === "string" && (/^#[0-9a-f]{6}$/i.test(v) || v === "transparent");
const id = (v: unknown) => typeof v === "string" && /^[\w-]{1,100}$/.test(v);
/** Whitelist persisted fields: never restore arbitrary HTML, CSS, handlers or URLs. */
export function validateBoard(input: unknown): Board {
  const b = input as Board;
  if (
    !b ||
    b.version !== 1 ||
    !Array.isArray(b.nodes) ||
    !Array.isArray(b.edges) ||
    b.nodes.length > 3000 ||
    b.edges.length > 6000 ||
    typeof b.grid !== "boolean" ||
    !b.viewport ||
    !number(b.viewport.x, -1e7, 1e7) ||
    !number(b.viewport.y, -1e7, 1e7) ||
    !number(b.viewport.zoom, 0.1, 4)
  )
    throw new Error("Ungültige Zeichenfläche.");
  const ids = new Set<string>();
  const nodes = b.nodes.map((n) => {
    const d = n?.data;
    if (
      !n ||
      !id(n.id) ||
      ids.has(n.id) ||
      n.type !== "shape" ||
      !n.position ||
      !number(n.position.x, -1e7, 1e7) ||
      !number(n.position.y, -1e7, 1e7) ||
      !number(n.width, 10, 10000) ||
      !number(n.height, 10, 10000) ||
      !d ||
      !shapeKinds.includes(d.kind) ||
      typeof d.text !== "string" ||
      d.text.length > 50000 ||
      !color(d.fill) ||
      !color(d.stroke) ||
      !color(d.color) ||
      !number(d.strokeWidth, 0, 12) ||
      !number(d.radius, 0, 200) ||
      !number(d.fontSize, 2, 1200) ||
      typeof d.bold !== "boolean" ||
      typeof d.italic !== "boolean" ||
      !["left", "center", "right"].includes(d.align)
    )
      throw new Error("Ungültiges Element.");
    ids.add(n.id);
    return {
      id: n.id,
      type: "shape" as const,
      position: { x: n.position.x, y: n.position.y },
      width: n.width,
      height: n.height,
      style: { width: n.width, height: n.height },
      zIndex: number(n.zIndex, -100000, 100000) ? n.zIndex : 0,
      data: {
        kind: d.kind,
        ...(["plain", "lines", "grid"].includes(d.paper ?? "")
          ? { paper: d.paper }
          : {}),
        text: d.text,
        fill: d.fill,
        stroke: d.stroke,
        strokeWidth: d.strokeWidth,
        radius: d.radius,
        ...(typeof d.opacity === "number" && number(d.opacity, 0, 1)
          ? { opacity: d.opacity }
          : {}),
        ...(["pen", "brush", "marker", "felt", "water"].includes(
          d.inkStyle ?? "",
        )
          ? { inkStyle: d.inkStyle }
          : {}),
        color: d.color,
        fontSize: d.fontSize,
        bold: d.bold,
        italic: d.italic,
        align: d.align,
        ...(color(d.textBackground)
          ? { textBackground: d.textBackground }
          : {}),
        ...(d.font && boardFonts.includes(d.font) ? { font: d.font } : {}),
        ...(validPicture(d.image) ? { image: d.image } : {}),
        ...(validMedia(d.media) ? { media: d.media } : {}),
        ...(validPoints(d.points) ? { points: d.points } : {}),
      },
    };
  });
  const edgeIds = new Set<string>();
  const edges = b.edges.map((e) => {
    if (
      !e ||
      !id(e.id) ||
      edgeIds.has(e.id) ||
      !(
        ids.has(e.source) ||
        (e.source.startsWith("line:") && edgeIds.has(e.source.slice(5)))
      ) ||
      !(
        ids.has(e.target) ||
        (e.target.startsWith("line:") && edgeIds.has(e.target.slice(5)))
      ) ||
      !["default", "straight", "step", "smoothstep"].includes(
        e.type || "default",
      ) ||
      !["top", "right", "bottom", "left"].includes(e.sourceHandle || "") ||
      !["top", "right", "bottom", "left"].includes(e.targetHandle || "") ||
      !color(e.style?.stroke) ||
      !number(e.style?.strokeWidth, 0.5, 12)
    )
      throw new Error("Ungültige Verbindung.");
    edgeIds.add(e.id);
    const label = e.data?.caption as Partial<LineLabel> | undefined;
    const caption =
      label && typeof label.text === "string"
        ? {
            text: label.text.slice(0, 160),
            size: number(label.size, 8, 72) ? label.size : 12,
            angle: number(label.angle, -180, 180) ? label.angle : 0,
            color: color(label.color) ? label.color : "#29352f",
            background: color(label.background)
              ? label.background
              : "transparent",
            font: boardFonts.includes(label.font ?? "") ? label.font : "System",
            bold: label.bold === true,
            italic: label.italic === true,
          }
        : undefined;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type || "default",
      ...(caption ? { data: { caption } } : {}),
      style: {
        stroke: e.style!.stroke,
        strokeWidth: e.style!.strokeWidth,
        ...(["7 5", "2 5"].includes(String(e.style?.strokeDasharray))
          ? { strokeDasharray: e.style!.strokeDasharray }
          : {}),
      },
      ...(e.markerEnd
        ? {
            markerEnd: {
              type: "arrowclosed" as const,
              color: String(e.style!.stroke),
            },
          }
        : {}),
      ...(e.markerStart
        ? {
            markerStart: {
              type: "arrowclosed" as const,
              color: String(e.style!.stroke),
            },
          }
        : {}),
    };
  });
  return {
    version: 1,
    nodes,
    edges,
    viewport: { ...b.viewport },
    grid: b.grid,
  };
}
export function duplicateSelection(
  nodes: ShapeNode[],
  edges: Edge[],
  offset = 30,
) {
  const mapping = new Map(nodes.map((n) => [n.id, crypto.randomUUID()]));
  return {
    nodes: nodes.map((n) => ({
      ...n,
      id: mapping.get(n.id)!,
      position: { x: n.position.x + offset, y: n.position.y + offset },
      selected: true,
    })),
    edges: edges
      .filter((e) => mapping.has(e.source) && mapping.has(e.target))
      .map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        source: mapping.get(e.source)!,
        target: mapping.get(e.target)!,
        selected: false,
      })),
  };
}
