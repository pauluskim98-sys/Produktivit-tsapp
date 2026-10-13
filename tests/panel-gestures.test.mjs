import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(
    new URL("../components/use-panel-swipe.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
function setup() {
  const handlers = {},
    timers = new Map(),
    actions = [];
  let now = 1000,
    timerId = 0,
    cleanup;
  class Element {
    constructor(panel = false) {
      this.panel = panel;
    }
    closest(selector) {
      return selector === ".app-shell" ? this : this.panel ? this : null;
    }
  }
  const window = {
    innerWidth: 1200,
    addEventListener: (name, fn) => {
      handlers[name] = fn;
    },
    removeEventListener: (name) => {
      delete handlers[name];
    },
    dispatchEvent: (event) => {
      actions.push(event.detail);
    },
  };
  const context = {
    exports: {},
    require: () => ({
      useRef: (value) => ({ current: value }),
      useEffect: (fn) => {
        cleanup = fn();
      },
    }),
    Element,
    window,
    document: { querySelectorAll: () => [] },
    getComputedStyle: () => ({ visibility: "visible" }),
    performance: { now: () => now },
    CustomEvent: class {
      constructor(name, options) {
        this.type = name;
        this.detail = options.detail;
      }
    },
    setTimeout: (fn) => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  vm.runInNewContext(source, context);
  context.exports.usePanelSwipe({
    inboxOpen: false,
    detailOpen: false,
    blocked: false,
    setInbox: (open) => actions.push(["inbox", open]),
    openDetail: () => actions.push("detail"),
    navigate: (dir) => actions.push(["calendar", dir]),
  });
  return {
    actions,
    handlers,
    cleanup,
    wheel(dx, panel = false) {
      handlers.wheel({
        target: new Element(panel),
        deltaX: dx,
        deltaY: 0,
        deltaMode: 0,
        ctrlKey: false,
        preventDefault() {},
      });
    },
    settle() {
      for (const fn of [...timers.values()]) fn();
      timers.clear();
    },
    next() {
      now += 200;
    },
  };
}
test("calendar swipes navigate immediately once, panel swipes retain history", () => {
  const s = setup();
  s.wheel(-180);
  s.wheel(-200);
  s.settle();
  assert.deepEqual(s.actions, [["calendar", -1]]);
  s.next();
  s.wheel(180, true);
  s.settle();
  assert.deepEqual(s.actions, [["calendar", -1], "forward"]);
  s.next();
  s.wheel(45);
  s.settle();
  assert.deepEqual(s.actions, [["calendar", -1], "forward", ["calendar", 1]]);
  s.next();
  s.wheel(-45, true);
  s.settle();
  assert.equal(s.actions.length, 3);
  s.cleanup();
  assert.equal(Object.keys(s.handlers).length, 0);
});
test("only the outer screen edges open panels, never a drag or touch pointer", () => {
  const s = setup();
  const pointer = (x, buttons = 0, pointerType = "mouse") =>
    s.handlers.pointermove({ clientX: x, buttons, pointerType });
  pointer(50);
  assert.deepEqual(s.actions, []);
  pointer(2);
  pointer(1);
  assert.deepEqual(s.actions, [["inbox", true]]);
  pointer(100);
  pointer(1199, 1);
  pointer(100);
  pointer(1199, 0, "touch");
  pointer(100);
  pointer(1199);
  assert.deepEqual(s.actions, [["inbox", true]]);
});
