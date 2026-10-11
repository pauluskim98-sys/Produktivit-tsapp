import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  statSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
test("AI configuration, proposal preview, idempotent accept, repeated tasks and validation (mock OpenAI)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "raum-plan-test-"));
  const mock = join(dir, "mock.mjs");
  writeFileSync(
    mock,
    `const real=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://api.openai.com/')){if(String(url).endsWith('/models'))return Response.json({data:[]});const request=JSON.parse(options.body);if(request.store!==false||request.text.format.type!=='json_schema')throw new Error('Missing structured privacy settings');const message=request.input.at(-1).content;if(message==='ERROR')return new Response('',{status:429});return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({answer:'Hier ist dein Plan.',items:[{title:'Test-Lernblock',description:'Kapitel eins',plannedDate:'2026-10-12',time:'10:00',duration:60,color:'blue'},{title:'Buch besorgen',description:'',plannedDate:null,time:'',duration:null,color:'orange'}]})}]}]});}return real(url,options);};`,
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
        OPENAI_API_KEY: "",
      },
      stdio: "pipe",
    },
  );
  const exited = once(server, "exit");
  let logs = "";
  server.stdout.on("data", (x) => (logs += x));
  server.stderr.on("data", (x) => (logs += x));
  try {
    let base;
    for (let i = 0; i < 100; i++) {
      base = logs.match(/http:\/\/127\.0\.0\.1:(\d+)/)?.[0];
      if (base && logs.includes("Ready")) break;
      if (server.exitCode !== null) throw new Error(logs);
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(base, logs);
    async function req(path, body) {
      const r = await fetch(
        base + path,
        body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json", Origin: base },
              body: JSON.stringify(body),
            }
          : {},
      );
      return { status: r.status, data: await r.json() };
    }
    assert.equal(
      (
        await req("/api/planner", {
          message: "Plan",
          start: "2026-10-12",
          weeks: 4,
        })
      ).status,
      503,
    );
    const key = "sk-test-only-123456789012345";
    assert.equal((await req("/api/ai-config", { key })).status, 200);
    assert.equal(statSync(join(dir, "ai-config.json")).mode & 0o777, 0o600);
    const state = await req("/api/state");
    assert.equal(state.data.aiAvailable, true);
    assert.ok(!JSON.stringify(state).includes(key));
    let planned = await req("/api/planner", {
      message: "Plane mein Ziel",
      start: "2026-10-12",
      weeks: 4,
    });
    assert.equal(planned.status, 200, JSON.stringify(planned));
    assert.equal(planned.data.messages.length, 2);
    assert.equal(planned.data.proposals[0].items.length, 2);
    assert.equal(
      (await req("/api/state")).data.todos.length,
      0,
      "Preview must not mutate tasks",
    );
    const id = planned.data.proposals[0].id;
    let accepted = await req("/api/planner", { action: "accept", id });
    assert.equal(accepted.data.todos.length, 2);
    assert.equal(
      (await req("/api/planner", { action: "accept", id })).data.todos.length,
      2,
    );
    assert.equal(
      (
        await req("/api/planner", {
          message: "ERROR",
          start: "2026-10-12",
          weeks: 4,
        })
      ).status,
      400,
    );
    assert.equal((await req("/api/planner")).data.messages.length, 2);
    const day = await req("/api/day", {
      date: "2026-10-12",
      message: "Wie ist mein Tag?",
    });
    assert.equal(day.status, 200, JSON.stringify(day));
    assert.equal(day.data.messages.length, 2);
    assert.equal(
      (await req("/api/day?date=2026-10-13")).data.messages.length,
      0,
    );
    const source = accepted.data.todos.find((t) => t.time);
    const repeat = await req("/api/todos", {
      action: "repeat",
      id: source.id,
      weekdays: [0, 2],
      weeks: 4,
    });
    assert.equal(repeat.status, 200);
    assert.equal(repeat.data.created, 8);
    assert.equal(
      (
        await req("/api/todos", {
          action: "repeat",
          id: source.id,
          weekdays: [0, 2],
          weeks: 4,
        })
      ).data.created,
      0,
    );
    assert.equal(
      (
        await req("/api/todos", {
          action: "repeat",
          id: source.id,
          weekdays: [9],
          weeks: 4,
        })
      ).status,
      400,
    );
  } finally {
    server.kill("SIGTERM");
    await exited;
    rmSync(dir, { recursive: true, force: true });
  }
});
