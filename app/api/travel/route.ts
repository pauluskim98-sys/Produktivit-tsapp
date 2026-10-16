import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { lookupPlaces } from "@/lib/place-search";
async function geocode(address: string) {
  const coordinates = address.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (
    coordinates &&
    Math.abs(Number(coordinates[1])) <= 90 &&
    Math.abs(Number(coordinates[2])) <= 180
  )
    return {
      lat: Number(coordinates[1]),
      lon: Number(coordinates[2]),
      label: address,
    };
  const [place] = await lookupPlaces(address);
  if (
    !place ||
    !Number.isFinite(Number(place.lat)) ||
    !Number.isFinite(Number(place.lon))
  )
    throw new Error(`Adresse nicht gefunden: ${address}`);
  return {
    lat: Number(place.lat),
    lon: Number(place.lon),
    label: String(place.display_name),
  };
}
type Place = { lat: number; lon: number; label: string };
async function bikeRoute(from: Place, to: Place) {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat};${from.lon},${from.lat}`;
  const response = await fetch(
    `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${coords}?overview=false&steps=false`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error("Fahrradrouten momentan nicht erreichbar.");
  const result = await response.json();
  const legs = result.routes?.[0]?.legs;
  if (result.code !== "Ok" || legs?.length !== 2)
    throw new Error("Keine passende Radroute gefunden.");
  return {
    mode: "bike",
    before: Math.ceil(legs[0].duration / 60),
    after: Math.ceil(legs[1].duration / 60),
    label: "OpenStreetMap · Fahrrad",
  };
}
async function railJourney(
  from: Place,
  to: Place,
  when: string,
  arrive: boolean,
) {
  const url = new URL("https://v6.db.transport.rest/journeys");
  url.search = new URLSearchParams({
    "from.latitude": String(from.lat),
    "from.longitude": String(from.lon),
    "from.address": from.label,
    "to.latitude": String(to.lat),
    "to.longitude": String(to.lon),
    "to.address": to.label,
    results: "3",
    bus: "false",
    national: "false",
    nationalExpress: "false",
    ferry: "false",
    taxi: "false",
    remarks: "false",
    language: "de",
    [arrive ? "arrival" : "departure"]: when,
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Bahn-Auskunft momentan nicht erreichbar.");
  const data = await response.json();
  const journey = data.journeys?.find(
    (j: any) =>
      j.legs?.some((leg: any) => leg.line) &&
      !j.legs.some((leg: any) => leg.cancelled),
  );
  if (!journey)
    throw new Error(
      "Keine Bahnverbindung gefunden. Kurze reine Fußwege werden nicht übernommen.",
    );
  const first = journey.legs[0],
    last = journey.legs.at(-1);
  const begin = Date.parse(first.departure || first.plannedDeparture),
    end = Date.parse(last.arrival || last.plannedArrival),
    moment = Date.parse(when);
  if (!Number.isFinite(begin) || !Number.isFinite(end))
    throw new Error("Bahnzeit nicht verfügbar.");
  return {
    minutes: Math.ceil(
      ((arrive ? moment : end) - (arrive ? begin : moment)) / 60000,
    ),
    lines: journey.legs
      .map((l: any) => l.line?.name)
      .filter(Boolean)
      .join(" · "),
  };
}
async function transitRoute(
  from: Place,
  to: Place,
  start: string,
  end: string,
) {
  const [outbound, inbound] = await Promise.all([
    railJourney(from, to, start, true),
    railJourney(to, from, end, false),
  ]);
  return {
    mode: "transit",
    before: outbound.minutes,
    after: inbound.minutes,
    label: `Bahn + Fußwege · ${outbound.lines} / ${inbound.lines}`,
  };
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { origin, destination, start, end } = await request.json();
    if (
      ![origin, destination].every(
        (s) => typeof s === "string" && s.trim() && s.length <= 1000,
      ) ||
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end))
    )
      throw new Error(
        "Bitte Startadresse, Zieladresse und Terminzeit angeben.",
      );
    const from = await geocode(origin.trim()),
      to = await geocode(destination.trim());
    const results = await Promise.allSettled([
      transitRoute(from, to, start, end),
      bikeRoute(from, to),
    ]);
    const options = results.map((result, index) =>
      result.status === "fulfilled" &&
      result.value.before >= 0 &&
      result.value.after >= 0 &&
      result.value.before <= 1440 &&
      result.value.after <= 1440
        ? result.value
        : {
            mode: index === 0 ? "transit" : "bike",
            error:
              result.status === "rejected"
                ? result.reason.message
                : "Wegzeit nicht verfügbar.",
          },
    );
    return Response.json(
      { options, origin: from.label, destination: to.label },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
