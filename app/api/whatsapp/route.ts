import {
  whatsappStatus,
  startWhatsapp,
  stopWhatsapp,
  syncWhatsapp,
  linkWhatsapp,
} from "@/lib/whatsapp";
import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(whatsappStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const b = await request.json();
    if (b.action === "connect") return Response.json(startWhatsapp());
    if (b.action === "disconnect") return Response.json(stopWhatsapp());
    if (b.action === "sync") return Response.json(syncWhatsapp().state);
    if (b.action === "link")
      return Response.json(linkWhatsapp(b.person, b.chat));
    throw new Error("Unbekannte Aktion.");
  } catch (e) {
    return errorResponse(e);
  }
}
