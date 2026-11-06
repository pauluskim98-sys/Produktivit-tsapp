export const sessionCookie = "__Host-lifemap_session";
export const oauthCookie = "__Host-lifemap_oauth";
const encoder = new TextEncoder();
export function accountConfig() {
  const origin = process.env.LIFEMAP_PUBLIC_ORIGIN;
  const clientId = process.env.LIFEMAP_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.LIFEMAP_GOOGLE_CLIENT_SECRET;
  const key = process.env.LIFEMAP_SESSION_SECRET;
  if (!(origin || clientId || clientSecret || key)) return { mode:"local" } as const;
  if (!origin || !clientId || !clientSecret || !key || key.length<43) return {mode:"invalid"} as const;
  try { const parsed=new URL(origin); if(parsed.protocol!=="https:" || parsed.origin!==origin) return {mode:"invalid"} as const; } catch { return {mode:"invalid"} as const; }
  return {mode:"private",origin,clientId,clientSecret,key} as const;
}
export function base64url(bytes:Uint8Array) { return btoa(Array.from(bytes,(b)=>String.fromCharCode(b)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
export function randomToken() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function challenge(verifier:string) { return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(verifier)))); }
async function hmac(secret:string) { return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]); }
export function isGoogleSubject(value:unknown): value is string { return typeof value === "string" && /^[\x21-\x7e]{1,255}$/.test(value); }
export async function issueSession(key:string, subject:string) {
  if(!isGoogleSubject(subject)) throw new Error("Ungültiges Google-Konto.");
  const payload=base64url(encoder.encode(JSON.stringify({v:2,subject,exp:Date.now()+7*86400000})));
  return `${payload}.${base64url(new Uint8Array(await crypto.subtle.sign("HMAC",await hmac(key),encoder.encode(payload))))}`;
}
export async function sessionSubject(value:string|undefined,key:string): Promise<string|null> {
  if (!value || !/^[a-zA-Z0-9_-]{1,1000}\.[a-zA-Z0-9_-]{43}$/.test(value)) return null;
  try {
    const [payload,sig]=value.split(".");
    const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),(c)=>c.charCodeAt(0));
    if (!(await crypto.subtle.verify("HMAC",await hmac(key),decode(sig),encoder.encode(payload)))) return null;
    const data=JSON.parse(new TextDecoder().decode(decode(payload)));
    return data.v===2 && isGoogleSubject(data.subject) && Number.isFinite(data.exp) && data.exp>Date.now() ? data.subject : null;
  } catch { return null; }
}
