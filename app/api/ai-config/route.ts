import { getApiKey, saveApiKey } from "@/lib/ai-config";
import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { key } = await request.json();
    if (typeof key !== "string" || !/^sk-[A-Za-z0-9_-]{15,500}$/.test(key))
      throw new Error("Bitte einen gültigen OpenAI-API-Schlüssel eingeben.");
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Der Schlüssel wurde nicht akzeptiert."
          : "OpenAI ist gerade nicht erreichbar. Bitte später erneut versuchen.",
      );
    saveApiKey(key);
    return Response.json({ available: Boolean(getApiKey()) });
  } catch (e) {
    return errorResponse(
      e instanceof Error && e.name === "TimeoutError"
        ? new Error("Die Verbindung dauert zu lange. Bitte erneut versuchen.")
        : e,
    );
  }
}
