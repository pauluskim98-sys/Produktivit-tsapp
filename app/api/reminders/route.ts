import { accountRoute } from "@/lib/account-route";
import { installCommand, reminderStatus } from "@/lib/reminders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handleGET(request: Request) {
  if (new URL(request.url).searchParams.get("download"))
    return new Response(installCommand(), {
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "Content-Disposition": "attachment; filename=Raum-Erinnerungen.command",
        "Cache-Control": "no-store",
      },
    });
  return Response.json(reminderStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export const GET = accountRoute(handleGET);
