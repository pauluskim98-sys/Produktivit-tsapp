import { NextResponse } from "next/server";
import { accountConfig, challenge, oauthCookie, randomToken } from "@/lib/private-account";
export const dynamic = "force-dynamic";
export async function GET() {
  const cfg=accountConfig();
  if(cfg.mode!=="private")return new Response("Google-Anmeldung ist nicht eingerichtet.",{status:503});
  const state=randomToken(), verifier=randomToken();
  const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search=new URLSearchParams({client_id:cfg.clientId,redirect_uri:`${cfg.origin}/api/auth/google/callback`,response_type:"code",scope:"openid email",state,code_challenge:await challenge(verifier),code_challenge_method:"S256",prompt:"select_account"}).toString();
  const result=NextResponse.redirect(url);
  result.headers.set("Cache-Control","no-store");
  result.cookies.set(oauthCookie,`${state}.${verifier}`,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
  return result;
}
