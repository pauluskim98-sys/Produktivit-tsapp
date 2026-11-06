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
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
function setup(enabled, ids, board) {
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
  const mode = [];
  const hook = context.exports.useAreaSelection(enabled, ids, (value, keepMode) =>
    (changes.push(Array.from(value)), mode.push(keepMode)),
  );
  const scope = board || { querySelector: () => null };
  const target = (task,legacy) => ({
    dataset: task ? { taskId: task } : {},
    closest(selector) {
      if (selector === "[data-task-id],[data-task-ids]")
        return task ? this : null;
      if(legacy && (selector===".note-todo-row[data-task-id]" || selector.includes("textarea")))return this;
      if(board && selector.startsWith(".note-todo-column,"))return board;
      if (
        selector === ".timeline-scroll,.calendar-overview" ||
        selector.startsWith(".timeline-scroll,")
      )
        return scope;
      return null;
    },
  });
  const event = (task,legacy) => ({
    target: target(task,legacy),
    button: 0,
    clientX:5,
    clientY:5,
    pointerId:1,
    currentTarget: scope,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  });
  return { hook, changes, event, mode };
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
test("clicking a member of a selected group removes just that member", () => {
  const s=setup(false,["a","b","c"]), click={...s.event("b"),detail:1};
  s.hook.bind.onPointerDownCapture(click);
  s.hook.bind.onClickCapture(click);
  assert.deepEqual(s.changes,[["a","c"]]);
  assert.equal(click.prevented,true);
});
test("clicking a to-do inside an active board selection removes just that to-do", () => {
  const board = {
    querySelector:()=>true,
    querySelectorAll:()=>[],
    classList:{contains:(name)=>name==="note-todo-column"},
    setPointerCapture(){},
    releasePointerCapture(){},
  };
  const s=setup(true,["a","b","c"],board);
  const e=s.event("b",true);
  s.hook.bind.onPointerDownCapture(e);
  s.hook.bind.onPointerUp(e);
  assert.deepEqual(s.changes,[["a","c"]]);
  assert.deepEqual(s.mode,[true]);
});
test("a rectangle starting over a legacy to-do text field includes older and new rows", () => {
  const rows = ["older", "newer"].map((taskId,index)=>({
    dataset:{taskId},
    offsetParent:{},
    getBoundingClientRect:()=>({width:90,height:20,left:0,right:90,top:index*25,bottom:index*25+20}),
  }));
  const board={
    querySelector:()=>rows[0],
    querySelectorAll:()=>rows,
    classList:{contains:(name)=>name==="note-todo-column"},
    setPointerCapture(){},
    releasePointerCapture(){},
  };
  const s=setup(true,[],board);
  const start=s.event("older",true);
  s.hook.bind.onPointerDownCapture(start);
  s.hook.bind.onPointerUp({...start,clientX:95,clientY:55});
  assert.deepEqual(s.changes,[["older","newer"]]);
  assert.deepEqual(s.mode,[true]);
});
