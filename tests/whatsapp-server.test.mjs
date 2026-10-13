import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";

test(
  "WhatsApp import persists choices, filters groups, deduplicates people, updates contact times and serves local photos",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "lifemap-whatsapp-test-"));
    const wa = join(dir, "whatsapp");
    mkdirSync(join(wa, "avatars"), { recursive: true });
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
      "base64",
    );
    const id = "491111@s.whatsapp.net";
    const filename =
      createHash("sha256").update(id).digest("hex") +
      "-" +
      createHash("sha256").update(png).digest("hex") +
      ".png";
    writeFileSync(join(wa, "avatars", filename), png);
    const contacts = [
      {
        id,
        name: "Anna Beispiel",
        lastContact: "2026-10-12",
        avatarFile: filename,
      },
      { id: "492222@s.whatsapp.net", name: "Ben Beispiel", lastContact: "" },
      { id: "12345@g.us", name: "Gruppe", lastContact: "" },
    ];
    const state = () =>
      writeFileSync(
        join(wa, "state.json"),
        JSON.stringify({
          status: "ready",
          protocol: 2,
          pid: process.pid,
          contacts,
        }),
      );
    state();
    const server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "0",
      ],
      {
        env: { ...process.env, DATABASE_PATH: join(dir, "test.sqlite") },
        stdio: "pipe",
      },
    );
    let output = "";
    try {
      const base = await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(output || "Server timeout")),
          20000,
        );
        const inspect = (chunk) => {
          output += chunk;
          const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (match && /Ready in/.test(output)) {
            clearTimeout(timeout);
            resolve(match[0]);
          }
        };
        server.stdout.on("data", inspect);
        server.stderr.on("data", inspect);
        server.on("exit", (code) => {
          clearTimeout(timeout);
          reject(new Error("Server exited " + code + " " + output));
        });
      });
      const request = async (body) => {
        const r = await fetch(base + "/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify(body),
        });
        return { r, data: await r.json() };
      };
      const preview = await request({ action: "contacts" });
      assert.equal(preview.r.status, 200);
      assert.equal(preview.data.contacts.length, 2);
      assert.ok(preview.data.contacts.every((c) => c.selected && c.isNew));
      await request({
        action: "selection",
        ids: ["492222@s.whatsapp.net"],
        selected: false,
      });
      assert.equal(
        (await request({ action: "contacts" })).data.contacts.find(
          (c) => c.name === "Ben Beispiel",
        ).selected,
        false,
      );
      const imported = await request({
        action: "import",
        ids: [id],
        reviewed: [id, "492222@s.whatsapp.net"],
      });
      assert.equal(imported.r.status, 200);
      assert.equal(imported.data.life.friends.length, 1);
      const person = imported.data.life.friends[0];
      assert.equal(person.whatsappId, id);
      const second = await request({
        action: "import",
        ids: [id],
        reviewed: [id, "492222@s.whatsapp.net"],
      });
      assert.equal(second.data.added, 0);
      assert.equal(second.data.life.friends[0].id, person.id);
      assert.equal(
        (
          await request({
            action: "import",
            ids: ["12345@g.us"],
            reviewed: ["12345@g.us"],
          })
        ).r.status,
        400,
      );
      contacts.push({
        id: "493333@s.whatsapp.net",
        name: "Clara Neu",
        lastContact: "",
      });
      contacts[0].lastContact = "2026-10-13";
      state();
      const newer = (await request({ action: "contacts" })).data.contacts;
      assert.equal(newer.find((c) => c.name === "Clara Neu").isNew, true);
      assert.equal(newer.find((c) => c.name === "Clara Neu").selected, true);
      assert.equal(newer.find((c) => c.name === "Ben Beispiel").isNew, false);
      const synced = await request({ action: "sync" });
      assert.equal(synced.data.life.friends[0].lastContact, "2026-10-13");
      assert.equal(synced.data.life.friends.length, 1);
      const photo = await fetch(
        base + "/api/whatsapp/avatar?person=" + person.id,
      );
      assert.equal(photo.status, 200);
      assert.equal(photo.headers.get("content-type"), "image/png");
      assert.deepEqual(Buffer.from(await photo.arrayBuffer()), png);
      const cached = await fetch(
        base + "/api/whatsapp/avatar?person=" + person.id,
        { headers: { "If-None-Match": photo.headers.get("etag") } },
      );
      assert.equal(cached.status, 304);
      assert.equal(
        (await fetch(base + "/api/whatsapp/avatar?id=../../state.json")).status,
        404,
      );
    } finally {
      server.kill("SIGTERM");
      await once(server, "exit").catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
