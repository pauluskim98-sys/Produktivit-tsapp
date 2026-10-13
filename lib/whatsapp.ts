import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { getLife, saveLife } from "./life";
import {
  personalContacts,
  matchesContact,
  personJid,
} from "../scripts/whatsapp-contacts.mjs";
import { importChoices, importPeople } from "./whatsapp-import";
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
    const contacts = personalContacts(s.contacts || []);
    if (!s.pid || !running(s.pid))
      return { status: "disconnected", contacts, error: s.error };
    return { ...s, contacts };
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
  const state = {
    status: "starting",
    pid: child.pid,
    contacts: s.contacts || [],
    protocol: 2,
  };
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
    const c = s.contacts.find((c: any) => matchesContact(c, f.whatsappId));
    return c?.lastContact && c.lastContact > f.lastContact
      ? { ...f, lastContact: c.lastContact }
      : f;
  });
  saveLife(life);
  return { state: s, life, message: "Kontaktzeitpunkte aktualisiert." };
}
export function linkWhatsapp(person: string, chat: string) {
  const s = whatsappStatus();
  if (
    s.status !== "ready" ||
    !s.contacts.some((c: any) => matchesContact(c, chat))
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

export function whatsappContactList(requestRefresh = false) {
  const state = whatsappStatus();
  if (state.status !== "ready")
    throw new Error("Zuerst WhatsApp über den QR-Code verbinden.");
  if (requestRefresh)
    writeFileSync(join(whatsappDir, "refresh-contacts"), "1", { mode: 0o600 });
  return { state, contacts: importChoices(state.contacts, getLife()) };
}
export function saveWhatsappSelection(ids: unknown, selected: unknown) {
  if (
    !Array.isArray(ids) ||
    ids.length > 10000 ||
    ids.some((id) => typeof id !== "string" || !personJid(id)) ||
    typeof selected !== "boolean"
  )
    throw new Error("Kontaktauswahl prüfen.");
  const state = whatsappStatus();
  const life = getLife();
  const prefs = life.whatsappImport || { selected: {}, seen: [] };
  for (const id of ids) {
    const c = state.contacts.find((c: any) => matchesContact(c, id));
    if (!c) throw new Error("Kontakt nicht gefunden.");
    for (const alias of c.aliases) prefs.selected[alias] = selected;
  }
  life.whatsappImport = prefs;
  saveLife(life);
  return { life, contacts: importChoices(state.contacts, life) };
}
export function importWhatsappPeople(ids: unknown, reviewed: unknown) {
  if (
    !Array.isArray(ids) ||
    ids.length > 10000 ||
    ids.some((id) => typeof id !== "string")
  )
    throw new Error("Kontaktauswahl prüfen.");
  if (
    !Array.isArray(reviewed) ||
    reviewed.length > 10000 ||
    reviewed.some((id) => typeof id !== "string" || !personJid(id))
  )
    throw new Error("Kontaktliste prüfen.");
  const state = whatsappStatus();
  if (state.status !== "ready") throw new Error("Zuerst WhatsApp verbinden.");
  const result = importPeople(
    state.contacts,
    getLife(),
    ids,
    () => crypto.randomUUID(),
    reviewed,
  );
  saveLife(result.life);
  return {
    ...result,
    contacts: importChoices(state.contacts, result.life),
    message: `${result.added} Personen hinzugefügt · ${result.updated} aktualisiert`,
  };
}

export function whatsappAvatar(id: string | null, person: string | null) {
  const life = getLife();
  if (person)
    id = life.friends.find((f) => f.id === person)?.whatsappId || null;
  if (!id || !personJid(id)) return null;
  const c = whatsappStatus().contacts.find((c: any) => matchesContact(c, id));
  if (
    !c?.avatarFile ||
    !/^[a-f0-9]{64}-[a-f0-9]{64}\.(jpg|png|webp)$/.test(c.avatarFile)
  )
    return null;
  try {
    return {
      bytes: readFileSync(join(whatsappDir, "avatars", c.avatarFile)),
      type: c.avatarFile.endsWith(".png")
        ? "image/png"
        : c.avatarFile.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg",
      etag: `"${c.avatarFile}"`,
    };
  } catch {
    return null;
  }
}
