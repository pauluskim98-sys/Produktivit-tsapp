import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
test("Produktionsserver startet den Kalenderabgleich ohne Browser oder API-Anfrage", async () => {
  const dir = mkdtempSync(join(tmpdir(), "raum-server-test-"));
  const path = join(dir, "test.sqlite");
  process.env.DATABASE_PATH = path;
  const { db, USER } = await import("../lib/db.ts");
  db.prepare(
    "INSERT INTO CalendarConnection (id,userId,name,provider,sourceType,source,color,lastSynced) VALUES (?,?,?,?,?,?,?,?)",
  ).run(
    "background-test",
    USER,
    "Test",
    "ics",
    "url",
    "https://127.0.0.1/test.ics",
    "#abc",
    "2020-01-01T00:00:00Z",
  );
  db.close();
  // Intentionally blocked source: tests the unattended trigger and error preservation,
  // without contacting any external server or requiring a real subscription URL.
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
    { env: { ...process.env, DATABASE_PATH: path }, stdio: "pipe" },
  );
  const exited = once(server, "exit");
  let logs = "";
  server.stdout.on("data", (c) => (logs += c));
  server.stderr.on("data", (c) => (logs += c));
  const check = new DatabaseSync(path);
  try {
    let row;
    for (let i = 0; i < 100; i++) {
      row = check
        .prepare(
          "SELECT lastAttemptAt,lastError FROM CalendarConnection WHERE id=?",
        )
        .get("background-test");
      if (row?.lastError) break;
      if (server.exitCode !== null) throw new Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(row.lastAttemptAt, logs);
    assert.match(row.lastError, /Aktualisierung fehlgeschlagen/);
  } finally {
    server.kill("SIGTERM");
    await exited;
    check.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
