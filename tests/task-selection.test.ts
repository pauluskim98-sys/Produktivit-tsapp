import test from "node:test";
import assert from "node:assert/strict";
import { representedTaskIds } from "../lib/task-selection.ts";
test("collapsed calendar markers expose every represented task without duplicate selection", () => {
  assert.deepEqual(representedTaskIds("one", '["one","two","two","three"]'), [
    "one",
    "two",
    "three",
  ]);
});
test("malformed marker metadata cannot introduce non-task values", () => {
  assert.deepEqual(representedTaskIds("one", "broken"), ["one"]);
  assert.deepEqual(representedTaskIds(undefined, '[null,3,"task",""]'), [
    "task",
  ]);
  assert.deepEqual(representedTaskIds(undefined, undefined), []);
});
