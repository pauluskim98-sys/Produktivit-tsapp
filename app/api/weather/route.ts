import { getLife } from "@/lib/life";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const city = getLife().city;
    const geo = await (
      await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de`,
        { signal: AbortSignal.timeout(10000) },
      )
    ).json();
    const g = geo.results?.[0];
    if (!g) throw new Error("Ort nicht gefunden.");
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Europe%2FBerlin`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!r.ok) throw new Error("Wetter derzeit nicht erreichbar.");
    const d = (await r.json()).daily;
    return Response.json({
      city,
      days: d.time.map((day: string, i: number) => ({
        day,
        min: Math.round(d.temperature_2m_min[i]),
        max: Math.round(d.temperature_2m_max[i]),
        rain: d.precipitation_probability_max[i],
        label:
          d.weather_code[i] === 0
            ? "☀️ Sonnig"
            : d.weather_code[i] <= 3
              ? "🌤 Bewölkt"
              : d.weather_code[i] < 50
                ? "🌫 Neblig"
                : d.weather_code[i] < 70
                  ? "🌧 Regen"
                  : d.weather_code[i] < 80
                    ? "❄️ Schnee"
                    : "🌦 Schauer",
      })),
    });
  } catch (e) {
    return Response.json(
      { days: [], error: (e as Error).message },
      { status: 503 },
    );
  }
}
