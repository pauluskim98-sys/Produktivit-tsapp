import { addressFromText } from "./addresses.ts";
export interface PlaceProposal {
  name: string;
  address: string;
  source: string;
  url: string;
}
const namedCache = new Map<string, { at: number; places: any[] }>();
/** Photon supports name/category queries, unlike a strict street address. */
export async function lookupNamedPlaces(
  query: string,
  city = "Köln",
): Promise<any[]> {
  query = query.replace(/([\p{L}]{3,})(?:straße|strasse)\b/giu, "$1 Straße");
  const q = query.toLocaleLowerCase("de").includes(city.toLocaleLowerCase("de"))
    ? query
    : `${query}, ${city}`;
  const cached = namedCache.get(q);
  if (cached && Date.now() - cached.at < 3600000) return cached.places;
  const url = new URL("https://photon.komoot.io/api/");
  url.search = new URLSearchParams({ q, lang: "de", limit: "5" }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("Ortssuche momentan nicht erreichbar.");
  const data = await r.json();
  let places = (data.features || []).flatMap((f: any) => {
    const p = f.properties || {},
      [lon, lat] = f.geometry?.coordinates || [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const osm_type = (
      { N: "node", W: "way", R: "relation" } as Record<string, string>
    )[p.osm_type];
    return [
      {
        name: p.name,
        lat,
        lon,
        osm_type,
        osm_id: p.osm_id,
        address: {
          road: p.street,
          house_number: p.housenumber,
          postcode: p.postcode,
          city: p.city || p.town || p.village,
        },
        display_name: [p.name, p.street, p.housenumber, p.postcode, p.city]
          .filter(Boolean)
          .join(", "),
      },
    ];
  });
  const street = query.match(/[\p{L}-]+\s+(?:Straße|Strasse)\b/iu)?.[0];
  if (street) {
    const normalize = (s: string) =>
      s
        .toLocaleLowerCase("de")
        .replace(/ß/g, "ss")
        .replace(/[^\p{L}]/gu, "");
    places = places.filter((p: any) =>
      normalize(p.address.road || "").includes(normalize(street)),
    );
  }
  namedCache.set(q, { at: Date.now(), places });
  if (namedCache.size > 200) namedCache.delete(namedCache.keys().next().value!);
  return places;
}
const cache = new Map<string, { at: number; places: any[] }>();
let queue = Promise.resolve();
export async function lookupPlaces(query: string): Promise<any[]> {
  const old = cache.get(query);
  if (old && Date.now() - old.at < 3600000) return old.places;
  const job = queue.then(async () => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "5",
      addressdetails: "1",
      extratags: "1",
    }).toString();
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Lifemap personal calendar/1.0",
        "Accept-Language": "de",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Ortssuche momentan nicht erreichbar.");
    const places = await response.json();
    if (!Array.isArray(places))
      throw new Error("Ortssuche liefert keine gültigen Treffer.");
    cache.set(query, { at: Date.now(), places });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return places;
  });
  queue = job.then(
    () => new Promise<void>((r) => setTimeout(r, 1100)),
    () => new Promise<void>((r) => setTimeout(r, 1100)),
  );
  return job;
}
export function placeQueries(
  title: string,
  context: string,
  city: string,
): string[] {
  const explicit = addressFromText(context);
  const named = context.split(/\n/).flatMap((raw) => {
    const line = raw.trim();
    const doctor = line
      .match(
        /\bDr\.\s*(?:(?:med|dent|rer\.\s*nat)\.\s*)?(?:[\p{Lu}][\p{L}'-]+(?:\s+|$)){1,3}/u,
      )?.[0]
      ?.trim();
    if (doctor) return [doctor];
    if (
      /^(?:Ort|Veranstaltungsort|Location|Praxis|Klinik|Universität|Museum|Theater|Restaurant)\b/i.test(
        line,
      )
    )
      return [
        line
          .replace(/^(?:Ort|Veranstaltungsort|Location)\s*:\s*/i, "")
          .slice(0, 160),
      ];
    return [];
  });
  const cleanTitle = title
    .replace(
      /\b(?:Termin|Besuch|Treffen|Besprechung)\s+(?:bei|mit|im|in)\s+/gi,
      "",
    )
    .replace(/\b\d{1,2}[:.]\d{2}(?:\s*Uhr)?\b/g, "")
    .trim()
    .slice(0, 160);
  return [
    ...new Set(
      [explicit, ...named, cleanTitle]
        .filter((s) => s && s.length > 2)
        .map((s) => (s.includes(city) ? s : `${s}, ${city}`)),
    ),
  ].slice(0, 3);
}
export function proposalFromPlace(p: any): PlaceProposal | null {
  const a = p.address || {};
  const road = a.road || a.pedestrian || a.square;
  if (!road) return null;
  const address = [
    `${road}${a.house_number ? ` ${a.house_number}` : ""}`,
    [a.postcode, a.city || a.town || a.village].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const name = String(p.name || p.display_name?.split(",")[0] || address);
  if (
    !address ||
    !/^(node|way|relation)$/.test(p.osm_type) ||
    !/^\d+$/.test(String(p.osm_id))
  )
    return null;
  return {
    name,
    address,
    source: "OpenStreetMap",
    url: `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`,
  };
}

/** Search snippets are proposals, never confirmed destinations. Only the place query is sent. */
export async function researchAddresses(
  query: string,
): Promise<PlaceProposal[]> {
  const url = new URL("https://www.bing.com/search");
  url.search = new URLSearchParams({
    q: query + " Adresse",
    format: "rss",
    setlang: "de",
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) return [];
  const xml = (await response.text()).slice(0, 300000);
  const clean = (text: string) =>
    text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
      .slice(0, 160);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .flatMap((m) => {
      const title = clean(m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
      const snippet = clean(
        m[1].match(/<description>([\s\S]*?)<\/description>/)?.[1] || "",
      );
      const link = clean(m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "");
      const address = addressFromText(snippet);
      if (!address || !/^https:\/\//.test(link)) return [];
      let host;
      try {
        host = new URL(link).hostname;
      } catch {
        return [];
      }
      return [
        {
          name: title.slice(0, 150),
          address: address.includes("Köln") ? address : address + ", Köln",
          source: host,
          url: link,
        },
      ];
    })
    .slice(0, 3);
}
