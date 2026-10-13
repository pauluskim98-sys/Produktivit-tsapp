import test from "node:test";
import assert from "node:assert/strict";
import {
  readShortcutPreference,
  shortcutPreference,
  shortcutsActive,
} from "../lib/shortcut-hints.ts";

test("new browser asks once, including when the user declines", () => {
  assert.equal(readShortcutPreference(null), null);
  const disabled = shortcutPreference(false, 14, 1000);
  assert.deepEqual(readShortcutPreference(JSON.stringify(disabled)), disabled);
  assert.equal(shortcutsActive(disabled, 1001), false);
});
test("chosen number of days expires exactly and reactivation starts a new period", () => {
  const enabled = shortcutPreference(true, 3, 1000);
  const expires = 1000 + 3 * 86400000;
  assert.equal(shortcutsActive(enabled, expires - 1), true);
  assert.equal(shortcutsActive(enabled, expires), false);
  assert.notEqual(readShortcutPreference(JSON.stringify(enabled)), null);
  const renewed = shortcutPreference(true, enabled.days, expires);
  assert.equal(renewed.expiresAt, expires + 3 * 86400000);
  assert.equal(shortcutsActive(renewed, expires), true);
});
test("invalid stored preferences are rejected and duration is bounded", () => {
  for (const raw of [
    "bad JSON",
    "null",
    "{}",
    '{"version":1,"enabled":true,"days":7,"expiresAt":null}',
  ])
    assert.equal(readShortcutPreference(raw), null);
  assert.equal(shortcutPreference(true, 500).days, 365);
  assert.equal(shortcutPreference(true, -3).days, 1);
});
