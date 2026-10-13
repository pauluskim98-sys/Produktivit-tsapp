import { getLife, saveLife } from "@/lib/life";
import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(getLife(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(saveLife(await request.json()));
  } catch (e) {
    return errorResponse(e);
  }
}
