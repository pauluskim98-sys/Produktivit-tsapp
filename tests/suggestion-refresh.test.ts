import test from "node:test";
import assert from "node:assert/strict";
import {
  suggestionKey,
  unseenSuggestions,
  type Suggestion,
} from "../lib/suggestion-refresh.ts";
const item = (id: string, url = `https://example.org/${id}`): Suggestion => ({
  id,
  url,
  title: id,
  notes: "",
  source: "Test",
  tags: [],
});
test("refresh excludes shown suggestions and returns the next distinct results", () => {
  const pool = Array.from({ length: 20 }, (_, i) => item(String(i)));
  const first = unseenSuggestions(pool, [], 8);
  const next = unseenSuggestions(pool, first.map(suggestionKey), 8);
  assert.deepEqual(
    next.map((s) => s.id),
    ["8", "9", "10", "11", "12", "13", "14", "15"],
  );
  assert.deepEqual(unseenSuggestions(first, first.map(suggestionKey)), []);
});
test("source IDs and tracking links do not disguise an already shown suggestion", () => {
  const original = item("sport-1", "https://example.org/park");
  const duplicate = item(
    "wiki-1",
    "https://example.org/park/?utm_source=feed#map",
  );
  assert.equal(suggestionKey(original), suggestionKey(duplicate));
  assert.equal(unseenSuggestions([original, duplicate], []).length, 1);
});
test("different recipes remain distinct when their source links point to the same site", () => {
  const one = item("meal-1", "https://example.org"),
    two = item("meal-2", "https://example.org");
  assert.notEqual(suggestionKey(one), suggestionKey(two));
});
