import {
  whatsappStatus,
  startWhatsapp,
  stopWhatsapp,
  syncWhatsapp,
  linkWhatsapp,
  whatsappContactList,
  saveWhatsappSelection,
  importWhatsappPeople,
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
    if (b.action === "sync") return Response.json(syncWhatsapp());
    if (b.action === "contacts")
      return Response.json(whatsappContactList(Boolean(b.refresh)));
    if (b.action === "selection")
      return Response.json(saveWhatsappSelection(b.ids, b.selected));
    if (b.action === "import")
      return Response.json(importWhatsappPeople(b.ids, b.reviewed));
    if (b.action === "link")
      return Response.json(linkWhatsapp(b.person, b.chat));
    throw new Error("Unbekannte Aktion.");
  } catch (e) {
    return errorResponse(e);
  }
}
