import test from "node:test";
import assert from "node:assert/strict";
import { parseQuadrant, quadrantOf, withQuadrant } from "../lib/eisenhower.ts";

test("a final quadrant number is removed without changing time or date", () => {
  assert.deepEqual(parseQuadrant("Lernen morgen 16 Uhr, 2"), { title:"Lernen morgen 16 Uhr", quadrant:"2" });
  assert.deepEqual(parseQuadrant("Joggen 4"), { title:"Joggen", quadrant:"4" });
  for (const title of ["Termin 10.04", "Einkauf 14:03", "Kapitel 12", "3"]) assert.deepEqual(parseQuadrant(title), { title });
});

test("reassignment keeps category, period and other tags", () => {
  const tags = withQuadrant(["c:work", "h:day", "q:1", "Projekt"], "4");
  assert.equal(quadrantOf(tags), "4");
  assert.deepEqual(withQuadrant(tags), ["c:work", "h:day", "Projekt"]);
});
