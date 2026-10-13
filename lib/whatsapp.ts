import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { getLife, saveLife } from "./life";
export const whatsappDir = join(
  dirname(
    process.env.DATABASE_PATH || join(process.cwd(), "data", "raum.sqlite"),
  ),
  "whatsapp",
);
function running(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
export function whatsappStatus() {
  try {
    const s = JSON.parse(readFileSync(join(whatsappDir, "state.json"), "utf8"));
    if (!s.pid || !running(s.pid))
      return { status: "disconnected", contacts: [], error: s.error };
    return s;
  } catch {
    return { status: "disconnected", contacts: [] };
  }
}
export function startWhatsapp() {
  const s = whatsappStatus();
  if (["starting", "qr", "ready"].includes(s.status)) return s;
  mkdirSync(whatsappDir, { recursive: true, mode: 0o700 });
  const child = spawn(
    process.execPath,
    [join(process.cwd(), "scripts", "whatsapp-worker.mjs")],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WHATSAPP_DIR: whatsappDir,
      },
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
  const state = { status: "starting", pid: child.pid, contacts: [] };
  writeFileSync(join(whatsappDir, "state.json"), JSON.stringify(state), {
    mode: 0o600,
  });
  return state;
}
export function stopWhatsapp() {
  const s = whatsappStatus();
  if (s.pid && running(s.pid))
    writeFileSync(join(whatsappDir, "stop"), "1", { mode: 0o600 });
  return { status: "disconnected", contacts: [] };
}
export function syncWhatsapp() {
  const s = whatsappStatus();
  if (s.status !== "ready") throw new Error("Zuerst WhatsApp verbinden.");
  const life = getLife();
  life.friends = life.friends.map((f) => {
    const c = s.contacts.find(
      (c: { id: string; lastContact: string }) => c.id === f.whatsappId,
    );
    return c?.lastContact && c.lastContact > f.lastContact
      ? { ...f, lastContact: c.lastContact }
      : f;
  });
  saveLife(life);
  return { state: s, life };
}
export function linkWhatsapp(person: string, chat: string) {
  const s = whatsappStatus();
  if (
    s.status !== "ready" ||
    !s.contacts.some((c: { id: string }) => c.id === chat)
  )
    throw new Error("Bitte einen verbundenen Kontakt wählen.");
  const life = getLife();
  if (!life.friends.some((f) => f.id === person))
    throw new Error("Person nicht gefunden.");
  life.friends = life.friends.map((f) =>
    f.id === person ? { ...f, whatsappId: chat } : f,
  );
  saveLife(life);
  return syncWhatsapp();
}
