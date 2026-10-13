import { fetchCalendar } from "@/lib/calendar/fetch";
import { getLife } from "@/lib/life";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Suggestion = {
  id: string;
  title: string;
  notes: string;
  url: string;
  image?: string;
  source: string;
  tags: string[];
};
const cache = new Map<string, { at: number; items: Suggestion[] }>();
async function read(url: string) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "RaumPersonalPlanner/1.0 (personal local calendar)",
    },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("Quelle gerade nicht erreichbar.");
  return r;
}
const clean = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind") || "nearby",
    life = getLife(),
    rhythm =
      life.rhythms.find((r) => r.id === kind) ||
      (life.tabSettings[kind]?.online || life.tabSettings[kind]?.links?.length
        ? {
            id: kind,
            name: life.labels[kind] || kind,
            online: true,
            links: life.tabSettings[kind]?.links,
          }
        : undefined),
    city = life.city,
    key = kind + city + (rhythm ? JSON.stringify(rhythm) : "");
  const old = cache.get(key);
  if (old && Date.now() - old.at < 3600000)
    return Response.json({ items: old.items, updatedAt: old.at, city });
  try {
    let items: Suggestion[] = [];
    if (
      kind === "sport" &&
      !rhythm?.links?.length &&
      /köln|koeln/i.test(city)
    ) {
      const d = await (
        await read(
          "https://de.wikipedia.org/w/api.php?action=query&format=json&titles=Innerer%20Gr%C3%BCng%C3%BCrtel%20(K%C3%B6ln)%7CStadtwald%20(K%C3%B6ln)%7CRheinpark%7CStadionbad%20(K%C3%B6ln)&prop=pageimages%7Cinfo&piprop=thumbnail&pithumbsize=400&inprop=url",
        )
      ).json();
      items = Object.values(d.query?.pages || {})
        .filter((p: any) => p.pageid)
        .map((p: any) => ({
          id: `sport-${p.pageid}`,
          title: `${/bad/i.test(p.title) ? "Schwimmen" : "Laufen oder spazieren"}: ${p.title}`,
          notes: `Bewegung in ${city}. ${p.fullurl}`,
          url: p.fullurl,
          image: p.thumbnail?.source,
          source: "Sportidee · Wikipedia",
          tags: ["Sport"],
        }));
    } else if (kind === "sport" || rhythm?.online) {
      const query = rhythm?.name || `Sport ${city}`;
      if (rhythm?.links?.length) {
        const sources = await Promise.allSettled(
          rhythm.links.map(async (url) => {
            const html = await fetchCalendar(url);
            const title = clean(
              html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || query,
            ).slice(0, 160);
            const image = html.match(
              /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i,
            )?.[1];
            return {
              id: url,
              title,
              notes: `Quelle für ${query}: ${url}`,
              url,
              source: new URL(url).hostname,
              tags: [`r:${rhythm.id}`],
              image: image ? new URL(image, url).href : undefined,
            };
          }),
        );
        items = sources.flatMap((r) =>
          r.status === "fulfilled" ? [r.value] : [],
        );
      }
      if (!items.length) {
        const data = await (
          await read(
            `https://de.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=8&prop=pageimages|info&piprop=thumbnail&pithumbsize=400&inprop=url`,
          )
        ).json();
        items = Object.values(data.query?.pages || {})
          .sort((a: any, b: any) => a.index - b.index)
          .map((p: any) => ({
            id: `wiki-${p.pageid}`,
            title: p.title,
            notes: `${query}: ${p.fullurl}`,
            url: p.fullurl,
            image: p.thumbnail?.source,
            source: "Wikipedia · Themenvorschlag",
            tags: [rhythm ? `r:${rhythm.id}` : "Sport"],
          }));
      }
    } else if (kind === "food") {
      const data = await (
        await read("https://www.themealdb.com/api/json/v1/1/search.php?s=pasta")
      ).json();
      items = (data.meals || [])
        .slice(0, 8)
        .map((m: Record<string, string>) => ({
          id: `meal-${m.idMeal}`,
          image: m.strMealThumb,
          title: `Kochen: ${m.strMeal}`,
          notes: `Kategorie: ${m.strCategory || ""}\nZutaten: ${Array.from(
            { length: 20 },
            (_, i) => m[`strIngredient${i + 1}`],
          )
            .filter(Boolean)
            .join(", ")}\n${(m.strInstructions || "").slice(0, 4500)}`,
          url: m.strSource?.startsWith("https://")
            ? m.strSource
            : `https://www.themealdb.com/meal/${m.idMeal}`,
          source: "TheMealDB · Rezeptidee",
          tags: ["Essen"],
        }));
    } else {
      if (kind === "events" && /köln|koeln|cologne/i.test(city)) {
        try {
          const data = await (
            await read(
              "https://www.stadt-koeln.de/externe-dienste/open-data/events-od.php?ndays=30&nobrs=1",
            )
          ).json();
          const today = new Date().toLocaleDateString("sv-SE");
          const current = (data.items || [])
            .filter((e: any) => e.endedatum >= today)
            .slice(0, 12);
          if (current.length) {
            items = current.map((e: any) => ({
              id: `event-${e.link}`,
              title: clean(e.title),
              image: e.teaserbild
                ? new URL(
                    e.teaserbild,
                    "https://www.stadt-koeln.de",
                  ).href.replace(/^http:/, "https:")
                : undefined,
              notes: `${e.beginndatum} · ${e.uhrzeit} · ${e.veranstaltungsort}\n${clean(e.description || "")}`,
              url: e.link.replace(/^http:/, "https:"),
              source: "Stadt Köln · Veranstaltung",
              tags: ["Aktivitäten"],
            }));
            const at = Date.now();
            cache.set(key, { at, items });
            return Response.json({ items, updatedAt: at, city });
          }
        } catch {}
      }
      const coords = await (
        await read(
          `https://de.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&titles=${encodeURIComponent(city)}`,
        )
      ).json();
      const coord = Object.values(coords.query?.pages || {}).flatMap(
        (p: any) => p.coordinates || [],
      )[0] as { lat: number; lon: number } | undefined;
      if (!coord)
        throw new Error("Für diesen Ort wurden keine Koordinaten gefunden.");
      const data = await (
        await read(
          `https://de.wikipedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord=${coord.lat}%7C${coord.lon}&gsradius=10000&gslimit=50`,
        )
      ).json();
      const places = (data.query?.geosearch || []).filter(
        (p: any) =>
          !/bahnhof|straße|domkloster|haltestelle/i.test(p.title) &&
          /museum|park|garten|theater|kirche|dom|brücke|zentrum|bibliothek|sport|kino/i.test(
            p.title,
          ),
      );
      items = places.slice(0, 10).map((p: any) => ({
        id: `place-${p.pageid}`,
        title: `${kind === "events" ? "Ausflug" : "Besuch"}: ${p.title}`,
        notes: `Aktivitätsidee in ${city}, ungefähr ${Math.round(p.dist)} m vom Ortszentrum. Öffnungszeiten und Programm auf der Website des Ortes prüfen.`,
        url: `https://de.wikipedia.org/?curid=${p.pageid}`,
        source: "Wikipedia · Ortsvorschlag",
        tags: [kind === "events" ? "Aktivitäten" : "In der Nähe"],
      }));
    }
    if (!items.length)
      throw new Error("Die Quelle liefert derzeit keine passenden Vorschläge.");
    const at = Date.now();
    cache.set(key, { at, items });
    return Response.json({ items, updatedAt: at, city });
  } catch (e) {
    return Response.json(
      {
        items: old?.items || [],
        city,
        error: e instanceof Error ? e.message : "Vorschläge nicht erreichbar.",
      },
      { status: old ? 200 : 503 },
    );
  }
}
