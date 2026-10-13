import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  mkdirSync,
  writeFileSync,
  renameSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const appRequire = createRequire(import.meta.url);
let libRequire = appRequire;
try {
  appRequire.resolve("@whiskeysockets/baileys");
} catch {
  libRequire = createRequire(
    process.cwd() + "/data/whatsapp-socket/package.json",
  );
}
const B = await import(
  pathToFileURL(libRequire.resolve("@whiskeysockets/baileys")).href
);
const QRCode = libRequire("qrcode");
const pino = libRequire("pino");
const dir = process.env.WHATSAPP_DIR;
mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = join(dir, "state.json"),
  stop = join(dir, "stop");
if (existsSync(stop)) unlinkSync(stop);
const authDb = new DatabaseSync(join(dir, "session.sqlite"));
authDb.exec(
  "PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS AuthKey (type TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(type,id))",
);
const getAuth = (type, id) => {
  const r = authDb
    .prepare("SELECT value FROM AuthKey WHERE type=? AND id=?")
    .get(type, id);
  return r ? JSON.parse(r.value, B.BufferJSON.reviver) : undefined;
};
const putAuth = (type, id, v) => {
  if (v == null)
    authDb.prepare("DELETE FROM AuthKey WHERE type=? AND id=?").run(type, id);
  else
    authDb
      .prepare(
        "INSERT INTO AuthKey(type,id,value) VALUES(?,?,?) ON CONFLICT(type,id) DO UPDATE SET value=excluded.value",
      )
      .run(type, id, JSON.stringify(v, B.BufferJSON.replacer));
};
const auth = {
  creds: getAuth("creds", "main") || B.initAuthCreds(),
  keys: {
    get: async (type, ids) => {
      const r = {};
      for (const id of ids) {
        let v = getAuth(type, id);
        if (type === "app-state-sync-key" && v)
          v = B.proto.Message.AppStateSyncKeyData.fromObject(v);
        if (v) r[id] = v;
      }
      return r;
    },
    set: async (data) => {
      authDb.exec("BEGIN");
      try {
        for (const [type, values] of Object.entries(data))
          for (const [id, v] of Object.entries(values)) putAuth(type, id, v);
        authDb.exec("COMMIT");
      } catch (e) {
        authDb.exec("ROLLBACK");
        throw e;
      }
    },
  },
};
let state = { status: "starting", pid: process.pid, contacts: [] },
  socket,
  stopping = false,
  retries = 0;
const contacts = new Map();
function persist(patch) {
  state = { ...state, ...patch };
  writeFileSync(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
  renameSync(file + ".tmp", file);
}
function absorb(list) {
  for (const c of list) {
    if (!c.id || (!c.id.endsWith("@s.whatsapp.net") && !c.id.endsWith("@lid")))
      continue;
    const prev = contacts.get(c.id) || {
      id: c.id,
      name: "Kontakt",
      lastContact: "",
    };
    const raw =
      c.conversationTimestamp || c.lastMessageRecvTimestamp || c.timestamp;
    const seconds = Number(raw?.toNumber?.() || raw || 0);
    const day =
      seconds > 0
        ? new Date(seconds * 1000).toLocaleDateString("sv-SE", {
            timeZone: "Europe/Berlin",
          })
        : "";
    contacts.set(c.id, {
      id: c.id,
      name: c.name || c.notify || c.verifiedName || c.pushName || prev.name,
      lastContact: day > prev.lastContact ? day : prev.lastContact,
    });
  }
  persist({
    contacts: [...contacts.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    updatedAt: new Date().toISOString(),
  });
}
function messages(list) {
  absorb(
    list.map((m) => ({
      id: m.key?.remoteJid,
      pushName: m.key?.fromMe ? undefined : m.pushName,
      timestamp: m.messageTimestamp,
    })),
  );
}
function updatePeople() {
  if (state.status !== "ready") return;
  try {
    const db = new DatabaseSync(
      process.env.DATABASE_PATH || join(process.cwd(), "data", "raum.sqlite"),
    );
    db.exec("PRAGMA busy_timeout=5000");
    const row = db.prepare("SELECT content FROM LifeState WHERE id=1").get();
    if (row) {
      const life = JSON.parse(row.content);
      life.friends = (life.friends || []).map((f) => {
        const c = contacts.get(f.whatsappId);
        return c?.lastContact && c.lastContact > f.lastContact
          ? { ...f, lastContact: c.lastContact }
          : f;
      });
      db.prepare("UPDATE LifeState SET content=? WHERE id=1").run(
        JSON.stringify(life),
      );
    }
    db.close();
  } catch {
    persist({ error: "Kontaktzeitpunkte konnten nicht übernommen werden." });
  }
}
async function connect() {
  const { version } = await B.fetchLatestBaileysVersion();
  socket = B.default({
    auth,
    version,
    logger: pino({ level: "silent" }),
    browser: B.Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  socket.ev.on("creds.update", () => putAuth("creds", "main", auth.creds));
  socket.ev.on("contacts.upsert", absorb);
  socket.ev.on("contacts.update", absorb);
  socket.ev.on("chats.upsert", absorb);
  socket.ev.on("chats.update", absorb);
  socket.ev.on("messages.upsert", ({ messages: m }) => messages(m));
  socket.ev.on(
    "messaging-history.set",
    ({ chats, contacts: c, messages: m }) => {
      absorb(chats);
      absorb(c);
      messages(m);
    },
  );
  socket.ev.on(
    "connection.update",
    async ({ connection, lastDisconnect, qr }) => {
      if (qr)
        persist({
          status: "qr",
          qr: await QRCode.toDataURL(qr),
          error: undefined,
        });
      if (connection === "open") {
        retries = 0;
        persist({ status: "ready", qr: undefined, error: undefined });
        updatePeople();
      }
      if (connection === "close" && !stopping) {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === B.DisconnectReason.loggedOut) {
          persist({ status: "disconnected", qr: undefined, contacts: [] });
          authDb.prepare("DELETE FROM AuthKey").run();
          process.exit(0);
        }
        if (retries++ < 3) {
          persist({ status: "starting", qr: undefined });
          setTimeout(() => connect().catch(fail), 1500);
        } else fail();
      }
    },
  );
}
function fail(e) {
  if (e) console.error(e.message);
  persist({
    status: "error",
    qr: undefined,
    error: "WhatsApp ist gerade nicht erreichbar. Bitte erneut verbinden.",
  });
  process.exit(1);
}
async function shutdown() {
  stopping = true;
  try {
    await socket?.logout();
    socket?.end(undefined);
  } catch {}
  authDb.prepare("DELETE FROM AuthKey").run();
  persist({ status: "disconnected", qr: undefined, contacts: [] });
  authDb.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
setInterval(() => {
  if (existsSync(stop)) {
    unlinkSync(stop);
    void shutdown();
  } else updatePeople();
}, 4000);
connect().catch(fail);
