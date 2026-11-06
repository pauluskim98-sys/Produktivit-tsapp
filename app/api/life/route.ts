import { accountRoute } from "@/lib/account-route";
import { getLife, saveLife } from "@/lib/life";
import { sameOrigin, errorResponse } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handleGET() {
  return Response.json(getLife(), { headers: { "Cache-Control": "no-store" } });
}
async function handlePOST(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(saveLife(await request.json()));
  } catch (e) {
    return errorResponse(e);
  }
}

export const GET = accountRoute(handleGET);
export const POST = accountRoute(handlePOST);
