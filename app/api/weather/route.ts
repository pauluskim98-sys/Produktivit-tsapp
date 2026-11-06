import { accountRoute } from "@/lib/account-route";
import { getLife } from "@/lib/life";
export const dynamic = "force-dynamic";
function weatherLabel(code: number | null) {
  if (code == null) return "–";
  if (code === 0) return "☀️ Sonnig";
  if (code <= 3) return "🌤 Bewölkt";
  if (code < 50) return "🌫 Neblig";
  if (code < 70) return "🌧 Regen";
  if (code < 80 || code === 85 || code === 86) return "❄️ Schnee";
  if (code >= 95) return "⛈ Gewitter";
  return "🌦 Schauer";
}
async function handleGET() {
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
      `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&timezone=Europe%2FBerlin`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!r.ok) throw new Error("Wetter derzeit nicht erreichbar.");
    const {daily:d,hourly} = await r.json();
    const hoursByDay = new Map<string,{ time:string; temperature:number|null; rain:number|null; label:string }[]>();
    (hourly?.time ?? []).forEach((stamp:string,index:number)=>{
      const [day,time]=stamp.split("T");
      const hours=hoursByDay.get(day) ?? [];
      const temperature=hourly.temperature_2m[index];
      hours.push({time,temperature:typeof temperature==="number"?Math.round(temperature):null,
        rain:hourly.precipitation_probability[index] ?? null,label:weatherLabel(hourly.weather_code[index])});
      hoursByDay.set(day,hours);
    });
    return Response.json({
      city,
      days: d.time.map((day: string, i: number) => ({
        day,
        min: Math.round(d.temperature_2m_min[i]),
        max: Math.round(d.temperature_2m_max[i]),
        rain: d.precipitation_probability_max[i],
        label: weatherLabel(d.weather_code[i]),
        hours: hoursByDay.get(day) ?? [],
      })),
    });
  } catch (e) {
    return Response.json(
      { days: [], error: (e as Error).message },
      { status: 503 },
    );
  }
}

export const GET = accountRoute(handleGET);
