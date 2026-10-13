import { whatsappAvatar } from "@/lib/whatsapp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const url = new URL(request.url);
  const avatar = whatsappAvatar(
    url.searchParams.get("id"),
    url.searchParams.get("person"),
  );
  if (!avatar)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const headers = {
    "Content-Type": avatar.type,
    "Cache-Control": "private, no-cache",
    ETag: avatar.etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === avatar.etag)
    return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(avatar.bytes), { headers });
}
