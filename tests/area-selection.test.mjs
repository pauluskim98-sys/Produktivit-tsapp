import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { representedTaskIds } from "../lib/task-selection.ts";
const source = ts.transpileModule(
  readFileSync(
    new URL("../components/use-area-selection.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
function setup(enabled, ids) {
  const changes = [];
  const context = {
    exports: {},
    require: (name) =>
      name === "react"
        ? {
            useRef: (value) => ({ current: value }),
            useState: (value) => [value, () => {}],
            useEffect: () => {},
          }
        : { representedTaskIds },
    document: {},
    getComputedStyle: () => ({ visibility: "visible" }),
  };
  vm.runInNewContext(source, context);
  const hook = context.exports.useAreaSelection(enabled, ids, (value) =>
    changes.push(Array.from(value)),
  );
  const scope = { querySelector: () => null };
  const target = (task) => ({
    dataset: task ? { taskId: task } : {},
    closest(selector) {
      if (selector === "[data-task-id],[data-task-ids]")
        return task ? this : null;
      if (
        selector === ".timeline-scroll,.calendar-overview" ||
        selector.startsWith(".timeline-scroll,")
      )
        return scope;
      return null;
    },
  });
  const event = (task) => ({
    target: target(task),
    button: 0,
    currentTarget: scope,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  });
  return { hook, changes, event };
}
test("blank calendar click clears group selection and consumes creation click", () => {
  const s = setup(false, ["a", "b"]),
    e = s.event();
  s.hook.bind.onPointerDownCapture(e);
  assert.deepEqual(s.changes, [[]]);
  assert.equal(e.prevented, true);
  assert.equal(e.stopped, true);
  const click = {
    target: e.target,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
  s.hook.bind.onClickCapture(click);
  assert.equal(click.prevented, true);
});
test("pressing a selected task preserves all IDs for a shared drag", () => {
  const s = setup(false, ["a", "b"]),
    e = s.event("a");
  s.hook.bind.onPointerDownCapture(e);
  assert.deepEqual(s.changes, []);
  assert.equal(e.prevented, undefined);
});
test("selection mode can be dismissed even on an empty calendar", () => {
  const s = setup(true, []);
  s.hook.bind.onPointerDownCapture(s.event());
  assert.deepEqual(s.changes, [[]]);
});
