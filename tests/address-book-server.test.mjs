import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
test(
  "address book persists entries, protects concurrent edits and restores deletions",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "lifemap-address-book-"));
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
        env: {
          ...process.env,
          DATABASE_PATH: join(dir, "test.sqlite"),
          TODOIST_API_TOKEN: "",
        },
        stdio: "pipe",
      },
    );
    const exited = once(server, "exit");
    let output = "";
    try {
      const base = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(output)), 20000);
        const read = (x) => {
          output += x;
          const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (m && /Ready in/.test(output)) {
            clearTimeout(timeout);
            resolve(m[0]);
          }
        };
        server.stdout.on("data", read);
        server.stderr.on("data", read);
        server.on("exit", () => {
          clearTimeout(timeout);
          reject(new Error(output));
        });
      });
      const post = async (path, body) => {
        const r = await fetch(base + path, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify(body),
        });
        return { status: r.status, data: await r.json() };
      };
      const entry = {
        id: "address-test",
        name: "Universität",
        address: "Albertus-Magnus-Platz, Köln",
      };
      const put = (value, expected) =>
        post("/api/address-book", { id: entry.id, entry: value, expected });
      assert.equal((await put(entry, null)).status, 200);
      assert.deepEqual(
        (await (await fetch(base + "/api/address-book")).json()).entries,
        [entry],
      );
      assert.equal(
        (await put({ ...entry, name: "Anderer Name" }, null)).status,
        400,
      );
      assert.equal((await put(null, entry)).status, 200);
      assert.deepEqual(
        (await (await fetch(base + "/api/address-book")).json()).entries,
        [],
      );
      assert.equal((await put(entry, null)).status, 200);
      assert.equal((await put({ ...entry, name: "" }, entry)).status, 400);
      assert.equal(
        (
          await fetch(base + "/api/address-book", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "https://example.org",
            },
            body: JSON.stringify({
              id: entry.id,
              entry: null,
              expected: entry,
            }),
          })
        ).status,
        400,
      );
      assert.deepEqual(
        (await (await fetch(base + "/api/address-book")).json()).entries,
        [entry],
      );
    } finally {
      server.kill("SIGTERM");
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
