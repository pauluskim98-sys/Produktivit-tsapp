import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  personJid,
  personalContacts,
  matchesContact,
} from "./whatsapp-contacts.mjs";
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
let cached = {};
try {
  cached = JSON.parse(readFileSync(file, "utf8"));
} catch {}
let state = { status: "starting", pid: process.pid, contacts: [], protocol: 2 },
  socket,
  stopping = false,
  retries = 0;
const contacts = new Map(
  personalContacts(cached.contacts || []).map((c) => [c.id, c]),
);
const pictureQueue = new Set();
let fetchingPictures = false;
const picturesDir = join(dir, "avatars");
mkdirSync(picturesDir, { recursive: true, mode: 0o700 });
function persist(patch) {
  state = { ...state, ...patch };
  writeFileSync(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
  renameSync(file + ".tmp", file);
}
function contactState() {
  persist({
    contacts: [...contacts.values()],
    updatedAt: new Date().toISOString(),
  });
}
function absorb(list) {
  const incoming = list
    .filter((c) => personJid(c.id))
    .map((c) => {
      const raw =
        c.conversationTimestamp || c.lastMessageRecvTimestamp || c.timestamp;
      const seconds = Number(raw?.toNumber?.() || raw || 0);
      return {
        ...c,
        lastContact:
          seconds > 0 && Number.isFinite(seconds)
            ? new Date(seconds * 1000).toLocaleDateString("sv-SE", {
                timeZone: "Europe/Berlin",
              })
            : c.lastContact || "",
      };
    });
  const own = personJid(socket?.user?.id || auth.creds.me?.id);
  const merged = personalContacts([...contacts.values(), ...incoming]).filter(
    (c) => !matchesContact(c, own),
  );
  contacts.clear();
  for (const c of merged) {
    contacts.set(c.id, c);
    const changed = incoming.some(
      (next) => matchesContact(c, next.id) && Object.hasOwn(next, "imgUrl"),
    );
    if (
      changed ||
      !c.pictureCheckedAt ||
      Date.now() - c.pictureCheckedAt > 86400000
    )
      pictureQueue.add(c.id);
  }
  contactState();
  void updatePictures();
}
async function updatePictures() {
  if (fetchingPictures || state.status !== "ready" || !socket) return;
  fetchingPictures = true;
  try {
    while (pictureQueue.size && state.status === "ready" && !stopping) {
      const id = pictureQueue.values().next().value;
      pictureQueue.delete(id);
      const c = contacts.get(id);
      if (!c) continue;
      try {
        const href = await socket.profilePictureUrl(id, "preview", 5000);
        if (!href) {
          c.avatarFile = "";
          continue;
        }
        const url = new URL(href);
        // Fetch only a WhatsApp CDN thumbnail, never a supplied arbitrary URL.
        if (
          url.protocol !== "https:" ||
          !(
            url.hostname === "pps.whatsapp.net" ||
            url.hostname.endsWith(".whatsapp.net") ||
            url.hostname.endsWith(".fbcdn.net")
          )
        )
          continue;
        const response = await fetch(url, {
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) continue;
        const reader = response.body?.getReader();
        if (!reader) continue;
        const chunks = [];
        let size = 0;
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.length;
            if (size > 2 * 1024 * 1024) throw new Error("Thumbnail too large");
            chunks.push(Buffer.from(part.value));
          }
        } finally {
          await reader.cancel();
        }
        const bytes = Buffer.concat(chunks);
        const ext =
          bytes[0] === 255 && bytes[1] === 216
            ? "jpg"
            : bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              ? "png"
              : bytes.toString("ascii", 0, 4) === "RIFF" &&
                  bytes.toString("ascii", 8, 12) === "WEBP"
                ? "webp"
                : "";
        if (!ext) continue;
        const name =
          createHash("sha256").update(id).digest("hex") +
          "-" +
          createHash("sha256").update(bytes).digest("hex") +
          "." +
          ext;
        writeFileSync(join(picturesDir, name), bytes, { mode: 0o600 });
        const current = [...contacts.values()].find((p) =>
          matchesContact(p, id),
        );
        if (current) current.avatarFile = name;
      } catch {
        /* No visible photo: initials are shown instead. */
      } finally {
        c.pictureCheckedAt = Date.now();
        contactState();
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  } finally {
    fetchingPictures = false;
  }
}

function messages(list) {
  absorb(
    list.map((m) => ({
      id: m.key?.remoteJid,
      phoneNumber: m.key?.remoteJidAlt?.endsWith("@s.whatsapp.net")
        ? m.key.remoteJidAlt
        : undefined,
      lid: m.key?.remoteJidAlt?.endsWith("@lid")
        ? m.key.remoteJidAlt
        : undefined,
      pushName: m.key?.fromMe ? undefined : m.pushName,
      timestamp: m.messageTimestamp,
    })),
  );
}
function updatePeople() {
  if (state.status !== "ready") return;
  let db;
  try {
    db = new DatabaseSync(
      process.env.DATABASE_PATH || join(process.cwd(), "data", "raum.sqlite"),
    );
    db.exec("PRAGMA busy_timeout=5000");
    db.exec("BEGIN IMMEDIATE");
    const row = db.prepare("SELECT content FROM LifeState WHERE id=1").get();
    if (row) {
      const life = JSON.parse(row.content);
      life.friends = (life.friends || []).map((f) => {
        const c = [...contacts.values()].find((c) =>
          matchesContact(c, f.whatsappId),
        );
        return c?.lastContact && c.lastContact > f.lastContact
          ? { ...f, lastContact: c.lastContact }
          : f;
      });
      db.prepare("UPDATE LifeState SET content=? WHERE id=1").run(
        JSON.stringify(life),
      );
    }
    db.exec("COMMIT");
  } catch {
    try {
      db?.exec("ROLLBACK");
    } catch {}
    persist({ error: "Kontaktzeitpunkte konnten nicht übernommen werden." });
  } finally {
    db?.close();
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
        for (const c of contacts.values())
          if (!c.pictureCheckedAt || Date.now() - c.pictureCheckedAt > 86400000)
            pictureQueue.add(c.id);
        void updatePictures();
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
  } else {
    const refresh = join(dir, "refresh-contacts");
    if (existsSync(refresh) && state.status === "ready") {
      unlinkSync(refresh);
      for (const c of contacts.values()) pictureQueue.add(c.id);
      void socket
        .resyncAppState(["regular", "regular_low", "regular_high"], false)
        .catch(() => {});
      void updatePictures();
    }
    updatePeople();
  }
}, 4000);
connect().catch(fail);
