import { NextResponse, type NextRequest } from "next/server";
import { accountConfig, isGoogleSubject, issueSession, oauthCookie, sessionCookie } from "@/lib/private-account";
export async function GET(request:NextRequest) {
  const cfg=accountConfig();
  if(cfg.mode!=="private")return new Response(null,{status:503});
  const finish=(path:string)=>{const response=NextResponse.redirect(new URL(path,cfg.origin));response.headers.set("Cache-Control","no-store");response.cookies.set(oauthCookie,"",{path:"/",secure:true,httpOnly:true,sameSite:"lax",maxAge:0});return response;};
  const [state,verifier]=(request.cookies.get(oauthCookie)?.value||"").split(".");
  const params=request.nextUrl.searchParams, code=params.get("code");
  if(!code || !state || !verifier || params.get("state")!==state) return finish("/login?status=failed");
  try {
    const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({code,client_id:cfg.clientId,client_secret:cfg.clientSecret,redirect_uri:`${cfg.origin}/api/auth/google/callback`,grant_type:"authorization_code",code_verifier:verifier}),cache:"no-store",signal:AbortSignal.timeout(12000)});
    const token=await tokenResponse.json();
    if(!tokenResponse.ok || typeof token.access_token!=="string")return finish("/login?status=failed");
    const profileResponse=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${token.access_token}`},cache:"no-store",signal:AbortSignal.timeout(12000)});
    const profile=await profileResponse.json();
    if(!profileResponse.ok || profile.email_verified!==true || !isGoogleSubject(profile.sub)) return finish("/login?status=denied");
    const response=finish("/lifemap");
    response.cookies.set(sessionCookie,await issueSession(cfg.key,profile.sub),{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:7*86400});
    return response;
  } catch { return finish("/login?status=failed"); }
}
