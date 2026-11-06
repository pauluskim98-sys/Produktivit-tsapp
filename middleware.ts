import { NextResponse, type NextRequest } from "next/server";
import { accountConfig, sessionCookie, sessionSubject } from "./lib/private-account";
export async function middleware(request:NextRequest) {
  const config=accountConfig();
  if(config.mode==="local") return NextResponse.next();
  if(config.mode==="invalid") return new NextResponse("Die private Lifemap ist noch nicht vollständig eingerichtet.",{status:503});
  const path=request.nextUrl.pathname;
  if(["/login","/api/auth/google","/api/auth/google/callback"].includes(path)) return NextResponse.next();
  if(await sessionSubject(request.cookies.get(sessionCookie)?.value,config.key)) {
    const response=NextResponse.next(); response.headers.set("Cache-Control","private, no-store"); return response;
  }
  return path.startsWith("/api/") ? NextResponse.json({error:"Bitte mit Google anmelden."},{status:401,headers:{"Cache-Control":"no-store"}}) : NextResponse.redirect(new URL("/login",config.origin));
}
export const config={ matcher:["/lifemap/:path*","/api/:path*","/login"] };
