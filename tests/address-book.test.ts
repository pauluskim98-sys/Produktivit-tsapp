import test from "node:test";
import assert from "node:assert/strict";
import { matchingAddresses, validAddress } from "../lib/address-book.ts";
import { placeQueries, proposalFromPlace } from "../lib/place-search.ts";
import { mapsDirections } from "../lib/maps-directions.ts";
test("saved addresses match umlauts and prioritize a name prefix", () => {
  const entries = [
    { id: "a", name: "Privat", address: "Universitätsstraße 1" },
    { id: "b", name: "Universität", address: "Albertus-Magnus-Platz, Köln" },
  ];
  assert.deepEqual(
    matchingAddresses(entries, "Uni").map((e) => e.id),
    ["b", "a"],
  );
  assert.equal(matchingAddresses(entries, "universitat").length, 2);
  assert.throws(() => validAddress({ id: "a", name: "", address: "X" }));
});
test("Maps arrival uses appointment wall clock and return departure rolls into next day", () => {
  const url = mapsDirections("A", "B", "transit", "2026-10-15", "14:00");
  assert.ok(
    url.includes("!6e1!7e2!8j" + Date.parse("2026-10-15T14:00Z") / 1000),
  );
  const back = mapsDirections(
    "A",
    "B",
    "transit",
    "2026-10-15",
    "23:30",
    true,
    90,
  );
  assert.ok(back.includes("/B/A/"));
  assert.ok(
    back.includes("!6e0!7e2!8j" + Date.parse("2026-10-16T01:00Z") / 1000),
  );
  assert.equal(
    new URL(
      mapsDirections("A", "B", "bike", "2026-10-15", "14:00"),
    ).searchParams.get("travelmode"),
    "bicycling",
  );
});
test("screenshot place context becomes limited queries, and proposals require a real street", () => {
  const q = placeQueries(
    "Besprechung",
    "Ort: Universität zu Köln\nDie Besprechung beginnt morgen.",
    "Köln",
  );
  assert.ok(q.includes("Universität zu Köln"));
  assert.ok(!q.some((s) => s.includes("beginnt morgen")));
  assert.equal(
    proposalFromPlace({ name: "Köln", address: { city: "Köln" } }),
    null,
  );
  assert.equal(
    proposalFromPlace({
      name: "Universität",
      osm_type: "way",
      osm_id: 123,
      address: {
        road: "Albertus-Magnus-Platz",
        postcode: "50923",
        city: "Köln",
      },
    })?.address,
    "Albertus-Magnus-Platz, 50923 Köln",
  );
});
