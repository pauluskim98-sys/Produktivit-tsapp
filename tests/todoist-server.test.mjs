import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  statSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
test(
  "Todoist pagination, idempotency, local edits, completion, failed sync and private token storage",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "lifemap-todoist-")),
      mock = join(dir, "mock.mjs");
    writeFileSync(
      mock,
      `const real=globalThis.fetch;let round=0;globalThis.fetch=async(input,options)=>{const u=new URL(String(input));if(u.hostname!=='api.todoist.com')return real(input,options);if(!u.searchParams.get('cursor'))round++;if(round===4)return new Response('',{status:503});if(u.searchParams.get('cursor'))return Response.json({results:round===3?[]:[{id:'weekly',content:'Wochenziel',due:{date:'2026-10-18',string:'diese Woche'}}],next_cursor:null});return Response.json({results:[{id:'day',content:round>1?'Titel aktualisiert':'Tagesaufgabe',due:{date:'2026-10-14'},priority:4}],next_cursor:'page-2'});};`,
    );
    const server = spawn(
      process.execPath,
      [
        "--import",
        mock,
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
    let logs = "";
    try {
      const base = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(logs)), 20000);
        const read = (c) => {
          logs += c;
          const m = logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (m && /Ready in/.test(logs)) {
            clearTimeout(timeout);
            resolve(m[0]);
          }
        };
        server.stdout.on("data", read);
        server.stderr.on("data", read);
        server.on("exit", () => {
          clearTimeout(timeout);
          reject(new Error(logs));
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
      const token = "test-token-not-a-real-credential";
      let result = await post("/api/todoist", { action: "connect", token });
      assert.equal(result.status, 200);
      assert.equal(result.data.todos.length, 2);
      assert.equal(
        result.data.todos.find((t) => t.id === "todoist-day").plannedDate,
        "2026-10-14",
      );
      assert.equal(
        result.data.todos.find((t) => t.id === "todoist-day").time,
        "",
      );
      assert.equal(
        result.data.todos.find((t) => t.id === "todoist-weekly").plannedDate,
        null,
      );
      assert.equal(
        statSync(join(dir, "todoist-config.json")).mode & 0o777,
        0o600,
      );
      const statusText = await (await fetch(base + "/api/todoist")).text();
      assert.ok(!statusText.includes(token));
      const local = result.data.todos.find((t) => t.id === "todoist-day");
      await post("/api/todos", {
        action: "save",
        todo: {
          ...local,
          title: "Mein Titel",
          plannedDate: "2026-10-15",
          time: "15:00",
        },
      });
      result = await post("/api/todoist", { action: "sync" });
      assert.equal(result.data.todos.length, 2);
      assert.equal(
        result.data.todos.find((t) => t.id === local.id).title,
        "Mein Titel",
      );
      assert.equal(
        result.data.todos.find((t) => t.id === local.id).time,
        "15:00",
      );
      result = await post("/api/todoist", { action: "sync" });
      assert.equal(
        result.data.todos.find((t) => t.id === "todoist-weekly").done,
        true,
      );
      const before = result.data.todos;
      result = await post("/api/todoist", { action: "sync" });
      assert.equal(result.status, 400);
      assert.deepEqual(
        (await (await fetch(base + "/api/state")).json()).todos,
        before,
      );
      result = await post("/api/todoist", { action: "disconnect" });
      assert.equal(result.data.connected, false);
      assert.ok(
        !readFileSync(join(dir, "todoist-config.json"), "utf8").includes(token),
      );
    } finally {
      server.kill("SIGTERM");
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
