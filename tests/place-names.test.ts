import test from "node:test";
import assert from "node:assert/strict";
import { lookupNamedPlaces, proposalFromPlace } from "../lib/place-search.ts";
test("keyword place searches retain named venues and real addresses", async () => {
  const original = globalThis.fetch;
  let url = "";
  globalThis.fetch = async (input) => {
    url = String(input);
    return Response.json({
      features: [
        {
          geometry: { coordinates: [6.96, 50.91] },
          properties: {
            name: "Tagesklinik",
            street: "Alteburger Straße",
            housenumber: "8",
            city: "Köln",
            postcode: "50678",
            osm_type: "N",
            osm_id: 123,
          },
        },
      ],
    });
  };
  try {
    const places = await lookupNamedPlaces(
      "Tagesklinik Alteburgerstraße",
      "Köln",
    );
    const p = proposalFromPlace(places[0]);
    assert.equal(
      new URL(url).searchParams.get("q"),
      "Tagesklinik Alteburger Straße, Köln",
    );
    assert.equal(p?.address, "Alteburger Straße 8, 50678 Köln");
    assert.equal(p?.name, "Tagesklinik");
    assert.equal(places[0].lat, 50.91);
    assert.equal(p?.url, "https://www.openstreetmap.org/node/123");
  } finally {
    globalThis.fetch = original;
  }
});
