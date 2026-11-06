import { accountConfig, sessionCookie, sessionSubject } from "./private-account";
import { withAccountDatabase } from "./db";

export function accountRoute(handler: (request: Request) => Response | Promise<Response>) {
  return async (request: Request) => {
    const config = accountConfig();
    if (config.mode === "local") return handler(request);
    if (config.mode !== "private") return Response.json({error:"Lifemap ist noch nicht eingerichtet."},{status:503});
    const cookie = request.headers.get("cookie")?.split(";").map((s)=>s.trim()).find((s)=>s.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length+1);
    const subject = await sessionSubject(cookie, config.key);
    if (!subject) return Response.json({error:"Bitte mit Google anmelden."},{status:401});
    const path = new URL(request.url).pathname;
    if (/^\/api\/(whatsapp|reminders|todoist)(?:\/|$)/.test(path)) return Response.json({error:"Diese Verbindung ist nur in der lokalen Lifemap verfügbar."},{status:403});
    const origin = request.headers.get("origin");
    if (request.method !== "GET" && origin !== config.origin) return Response.json({error:"Diese Anfrage ist nicht erlaubt."},{status:403});
    try {
      const response = await withAccountDatabase(subject,()=>handler(request));
      response.headers.set("Cache-Control","private, no-store");
      return response;
    } catch {
      return Response.json({error:"Lifemap konnte diese Anfrage nicht abschließen."},{status:500,headers:{"Cache-Control":"no-store"}});
    }
  };
}
