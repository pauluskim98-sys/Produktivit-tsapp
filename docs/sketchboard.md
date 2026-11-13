# LifeMap Sketchboard

The isolated `feature/neues-feature` branch adds `/lifemap/board`, reachable from the calendar's LifeMap link. The calendar remains at `/lifemap`.

## Run

Node 24+, `pnpm install`, `pnpm build`, then `pnpm start --port 3011`.
Open http://127.0.0.1:3011/lifemap/board. For development use `pnpm dev --port 3011`.
The feature checkout uses its own `data/raum.sqlite` by default. It does not modify the stable desktop installation or its calendar database.

## Implementation choice

Next.js App Router / React / TypeScript, existing global CSS and Lucide icons, account-scoped SQLite persistence.

- [tldraw](https://tldraw.dev/community/license) is a full whiteboard SDK but requires a valid production license. Avoid introducing a license-key prerequisite for this local application.
- [React Flow / XYFlow](https://reactflow.dev/examples/whiteboard/rectangle) supplies the viewport, selection, group dragging, resizing and connector geometry. Its MIT-licensed core fits the existing React stack. Custom shapes and a compact toolbar supply the freeform board UI without a fixed graph hierarchy.
- Excalidraw was considered, but its preset styling and text controls are less suited to the requested geometric pastel shapes and bold/italic formatting.

Board code is lazy loaded and scoped under `components/sketchboard`; it does not install keyboard handlers on the calendar route.

## Interaction

Select a toolbar shape and click or draw on the board. Double-click shapes to edit; Escape or Ctrl/Cmd+Enter finishes text editing, plain Enter inserts a newline. Double-click blank space for quick creation. Drag connection handles or choose the connector tool and click two shapes. Select a line for straight/curved, arrow, thickness and color options.

Shift-click adds/removes from selection; drag blank space to select by rectangle. Drag a selected shape to move the selection. Ctrl/Cmd+C/V/D copy, paste and duplicate a selected group including its internal connections. Delete removes the selection. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo/redo. Space+drag or Hand pans. Trackpad/wheel scroll pans; Ctrl+wheel or pinch zooms. Zoom controls and Fit all are at bottom right.

## Persistence and safety

`/api/sketchboard` uses the existing `accountRoute` and account database context. A new additive `Sketchboard` table stores the versioned document. Server-side validation whitelists geometry, shape styling, connection endpoints and viewport; arbitrary HTML/CSS/URLs are never restored. The write uses an optimistic revision guard so a stale window cannot silently overwrite another window. Saves are debounced and serialized. Network failures stay visible and are retried; pending changes trigger a close warning. Export JSON is available if a conflict needs manual recovery.

Undo/redo is session scoped (100 checkpoints); the current board, including viewport and stacking order, persists across restarts. Personal board data and exports are not GitHub source checkpoints.

## Verification

`node --test tests/sketchboard.test.ts` verifies round-trip persistence, rejection of corrupt documents, exclusion of transient renderer state and remapping of copied group connections. `pnpm test` runs existing calendar tests. `pnpm build` checks the complete production build.

Browser checks cover shape creation and text editing, sticky notes, connector dragging, group selection, resize, copy/delete/undo, color modes and reload persistence.
