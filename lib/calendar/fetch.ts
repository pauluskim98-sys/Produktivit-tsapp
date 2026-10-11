import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) === 6)
    return (
      /^[23][0-9a-f]{3}:/i.test(ip) &&
      !/^2001:(db8|0):/i.test(ip) &&
      !/^2002:/i.test(ip)
    );
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}
export async function fetchCalendar(
  source: string,
  redirects = 0,
): Promise<string> {
  if (redirects > 4)
    throw new Error("Zu viele Weiterleitungen beim Kalenderabruf.");
  const url = new URL(source.replace(/^webcal:/i, "https:"));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error(
      "Bitte eine öffentliche HTTPS-Adresse ohne eingebettete Zugangsdaten verwenden.",
    );
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error(
      "Lokale und private Netzwerkadressen sind als Kalenderquelle nicht erlaubt.",
    );
  const address = addresses[0];
  const result = await new Promise<{
    status: number;
    location?: string;
    body: string;
  }>((resolve, reject) => {
    // Pin the validated address to prevent a second DNS lookup (DNS rebinding).
    const req = request(
      {
        hostname: address.address,
        servername: hostname,
        port: 443,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Host: url.host,
          Accept: "text/calendar",
          "User-Agent": "Raum-Calendar/1.0",
        },
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) {
            req.destroy(
              new Error("Der Kalender darf höchstens 2 MB groß sein."),
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode || 500,
            location: res.headers.location,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () =>
      req.destroy(
        new Error("Der Kalenderanbieter antwortet nicht rechtzeitig."),
      ),
    );
    req.on("error", reject);
    req.end();
  });
  if ([301, 302, 303, 307, 308].includes(result.status) && result.location)
    return fetchCalendar(
      new URL(result.location, url).toString(),
      redirects + 1,
    );
  if (result.status < 200 || result.status >= 300)
    throw new Error(
      `Der Kalender konnte nicht geladen werden (HTTP ${result.status}).`,
    );
  return result.body;
}
