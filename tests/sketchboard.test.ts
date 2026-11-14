import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyBoard,
  newShape,
  validateBoard,
  duplicateSelection,
} from "../lib/sketchboard.ts";

test("board restores geometry, text, styles, viewport and connection ends", () => {
  const a = newShape("rounded", -320, 40),
    b = newShape("ellipse", 230, 95);
  a.data.text = "Studium\nPrüfungen";
  a.data.bold = true;
  a.zIndex = 3;
  const board = {
    ...emptyBoard(),
    nodes: [a, b],
    viewport: { x: 120, y: -100, zoom: 0.7 },
    edges: [
      {
        id: "connection",
        source: a.id,
        target: b.id,
        sourceHandle: "right",
        targetHandle: "left",
        type: "default",
        style: { stroke: "#888888", strokeWidth: 2 },
        markerEnd: { type: "arrowclosed" as const },
      },
    ],
  };
  const restored = validateBoard(JSON.parse(JSON.stringify(board)));
  assert.equal(restored.nodes[0].data.text, a.data.text);
  assert.equal(restored.nodes[0].zIndex, 3);
  assert.deepEqual(restored.viewport, board.viewport);
  assert.equal(restored.edges[0].target, b.id);
});
test("selection and transient renderer fields are not persisted", () => {
  const n = { ...newShape("sticky", 0, 0), selected: true, dragging: true };
  const clean = validateBoard({ ...emptyBoard(), nodes: [n] }).nodes[0];
  assert.equal(clean.selected, undefined);
  assert.equal(clean.dragging, undefined);
});
test("copy group remaps internal edges and excludes connections to other groups", () => {
  const a = newShape("rectangle", 0, 0),
    b = newShape("text", 200, 30),
    c = newShape("diamond", 800, 40);
  const edges = [
    { id: "a", source: a.id, target: b.id },
    { id: "b", source: b.id, target: c.id },
  ];
  const copied = duplicateSelection([a, b], edges);
  assert.equal(copied.edges.length, 1);
  assert.equal(copied.edges[0].source, copied.nodes[0].id);
  assert.equal(copied.edges[0].target, copied.nodes[1].id);
  assert.notEqual(copied.nodes[0].id, a.id);
  assert.equal(copied.nodes[0].position.x, 30);
});
test("rejects corrupt geometry, dangling edges, duplicate ids and unsafe style content", () => {
  const a = newShape("rounded", 0, 0);
  assert.throws(() => validateBoard({ ...emptyBoard(), nodes: [a, a] }));
  assert.throws(() =>
    validateBoard({ ...emptyBoard(), nodes: [{ ...a, width: NaN }] }),
  );
  assert.throws(() =>
    validateBoard({
      ...emptyBoard(),
      nodes: [{ ...a, data: { ...a.data, fill: "url(https://example.com)" } }],
    }),
  );
  assert.throws(() =>
    validateBoard({
      ...emptyBoard(),
      nodes: [a],
      edges: [{ id: "bad", source: a.id, target: "missing" }],
    }),
  );
});
test("line endpoints and caption formatting survive persistence", () => {
  const first = newShape("rectangle", 10, 10);
  const second = newShape("rectangle", 220, 10);
  const base = {
    source: first.id,
    target: second.id,
    sourceHandle: "right",
    targetHandle: "left",
    style: { stroke: "#888888", strokeWidth: 2 },
  };
  const primary = { ...base, id: "main-line" };
  const branch = {
    ...base,
    id: "branch",
    target: "line:main-line",
    data: { caption: { text: "Bezug", angle: 90, background: "#ffeecc" } },
  };
  const third = {
    ...base,
    id: "line-link",
    source: "line:branch",
    target: "line:main-line",
  };
  const restored = validateBoard({
    ...emptyBoard(),
    nodes: [first, second],
    edges: [primary, branch, third],
  });
  assert.equal(restored.edges[2].source, "line:branch");
  assert.equal(
    (restored.edges[1].data?.caption as { angle: number }).angle,
    90,
  );
  assert.equal(
    (restored.edges[1].data?.caption as { background: string }).background,
    "#ffeecc",
  );
  assert.throws(() => validateBoard({ ...restored, edges: [branch, third] }));
});
