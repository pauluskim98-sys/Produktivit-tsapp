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
function setup(storage = false) {
  const handlers = {},
    timers = new Map(),
    actions = [];
  let now = 1000,
    timerId = 0,
    cleanup,
    hovered = null;
  class Element {
    constructor(panel = false, weather = false, notes = false) {
      this.panel = panel;
      this.weather = weather;
      this.notes = notes;
    }
    closest(selector) {
      if (selector === ".weather-hours") return this.weather ? this : null;
      if (selector === ".calendar-bottom-notes .note-checklist") return this.notes ? this : null;
      if (selector === ".timeline-scroll,.calendar-overview-large") return this.panel ? null : this;
      return selector === ".app-shell" ? this : this.panel ? this : null;
    }
    contains(node) { return node === this; }
    matches() { return false; }
  }
  const window = {
    innerWidth: 1200,
    innerHeight: 800,
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
    document: {
      querySelectorAll: () => [],
      elementFromPoint: () => hovered,
      activeElement: { tagName: "INPUT" },
    },
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
    openPlan: () => actions.push("plan"),
    inboxOpen: false,
    ...(storage
      ? {
          storageOpen: false,
          setStorage: (open) => actions.push(["storage", open]),
        }
      : {}),
    detailOpen: false,
    blocked: false,
    setInbox: (open) => actions.push(["inbox", open]),
    openDetail: () => actions.push("detail"),
    navigate: (dir) => actions.push(["calendar", dir]),
    stepNotes: (dir) => actions.push(["notes", dir]),
  });
  return {
    actions,
    handlers,
    cleanup,
    hover(panel, weather = false, notes = false) {
      hovered = new Element(panel, weather, notes);
    },
    wheel(dx, panel = false) {
      handlers.wheel({
        target: new Element(panel),
        clientX: 600,
        clientY: 400,
        deltaX: dx,
        deltaY: 0,
        deltaMode: 0,
        ctrlKey: false,
        preventDefault() {},
      });
    },
    vertical(dy, focused=true) {
      hovered = new Element();
      context.document.activeElement = focused ? hovered : new Element(true);
      let prevented=false;
      handlers.wheel({target:hovered,clientX:600,clientY:400,deltaX:0,deltaY:dy,deltaMode:0,preventDefault(){prevented=true;}});
      return prevented;
    },
    settle() {
      for (const fn of [...timers.values()]) fn();
      timers.clear();
    },
    next(ms = 200) {
      now += ms;
    },
  };
}
test("vertical scrolling remains native even without calendar focus",()=>{
  const s=setup();
  assert.equal(s.vertical(25,false),false);
  assert.equal(s.vertical(100),false);
  assert.deepEqual(s.actions,[]);
});
test("calendar swipes navigate immediately once, panel swipes retain history", () => {
  const s = setup();
  s.wheel(-60);
  s.wheel(-70);
  s.settle();
  assert.deepEqual(s.actions, [["calendar", -1]]);
  s.next();
  s.wheel(180, true);
  s.settle();
  assert.deepEqual(s.actions, [["calendar", -1], "forward"]);
  s.next();
  s.wheel(85);
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

test("right edge opens the resource drawer without opening task details", () => {
  const s = setup(true);
  s.handlers.pointermove({ clientX: 1199, buttons: 0, pointerType: "mouse" });
  assert.deepEqual(s.actions, [["storage", true]]);
});

test("momentum and reversals in one swipe cannot advance multiple times", () => {
  const s = setup();
  s.wheel(85);
  s.next(25);
  s.wheel(14);
  s.next(25);
  s.wheel(4);
  s.next(45);
  s.wheel(140);
  s.next(40);
  s.wheel(-160);
  assert.deepEqual(s.actions, [
    ["calendar", 1],
  ]);
});
test("bottom screen edge opens planning without opening a side panel", () => {
  const s = setup(true);
  s.handlers.pointermove({
    clientX: 600,
    clientY: 799,
    buttons: 0,
    pointerType: "mouse",
  });
  assert.deepEqual(s.actions, ["plan"]);
});

test("successive settled swipes need no intervening click or focus change", () => {
  const s = setup();
  for (let i = 0; i < 3; i++) {
    s.wheel(85);
    s.settle();
    s.next(85);
  }
  assert.deepEqual(s.actions, [
    ["calendar", 1],
    ["calendar", 1],
    ["calendar", 1],
  ]);
});

test("pointer over calendar wins over a latched panel target without a click", () => {
  const s = setup();
  s.hover(true);
  s.wheel(40, true);
  s.hover(false);
  s.next(15);
  s.wheel(85, true);
  assert.deepEqual(s.actions, [["calendar", 1]]);
  s.settle();
  s.hover(true);
  s.next(85);
  s.wheel(30, false);
  s.settle();
  assert.deepEqual(s.actions, [["calendar", 1]]);
});

test("small horizontal motions do not change the calendar", () => {
  const s=setup();
  s.wheel(15);
  s.wheel(12);
  s.settle();
  assert.deepEqual(s.actions,[]);
});
test("horizontal scrolling in an hourly weather strip stays native",()=>{
  const s=setup();
  s.hover(true,true);
  s.wheel(260,true);
  assert.deepEqual(s.actions,[]);
});
test("swiping in the notepad steps once without navigating the calendar",()=>{
  const s=setup();
  s.hover(false,false,true);
  s.wheel(40);
  s.wheel(500);
  assert.deepEqual(s.actions,[["notes",1]]);
  s.next();
  s.wheel(-60);
  assert.deepEqual(s.actions,[["notes",1],["notes",-1]]);
});
test("only an energetic horizontal swipe can advance up to three periods", () => {
  const gentle=setup();
  for (let i=0;i<18;i++)gentle.wheel(30);
  assert.deepEqual(gentle.actions,[["calendar",1]]);
  const normal=setup();
  normal.wheel(140);
  normal.wheel(150);
  normal.wheel(110);
  assert.deepEqual(normal.actions,[["calendar",1]]);
  const strong=setup();
  strong.wheel(200);
  strong.wheel(230);
  strong.wheel(300);
  strong.wheel(260);
  assert.deepEqual(strong.actions,[["calendar",1],["calendar",1],["calendar",1]]);
});
