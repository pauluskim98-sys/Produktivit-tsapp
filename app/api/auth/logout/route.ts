import { NextResponse, type NextRequest } from "next/server";
import { accountConfig, sessionCookie } from "@/lib/private-account";
export function POST(request:NextRequest) {
  const cfg=accountConfig();
  if(cfg.mode!=="private" || request.headers.get("origin")!==cfg.origin) return new Response(null,{status:403});
  const response=NextResponse.redirect(new URL("/login",cfg.origin),303);
  response.cookies.set(sessionCookie,"",{path:"/",secure:true,httpOnly:true,sameSite:"lax",maxAge:0});
  return response;
}
