import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

test(
  "manual refresh bypasses cached recipes and topics; finite sources and failures are explicit",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "lifemap-suggestions-"));
    const mock = join(dir, "mock.mjs");
    writeFileSync(
      mock,
      `const real=globalThis.fetch;globalThis.fetch=async(input,options)=>{const u=new URL(String(input));if(u.hostname==='www.themealdb.com'){const letter=u.searchParams.get('f');if(letter==='c')throw new Error('Test source offline');const ids=letter==='a'?[1,2,3,4,101,102,103,104,105,106,107,108]:Array.from({length:8},(_,i)=>(letter==='b'?201:1)+i);return Response.json({meals:ids.map(id=>({idMeal:String(id),strMeal:'Rezept '+id,strCategory:'Vegetarian',strSource:'https://example.org/recipe/'+id,strInstructions:'Test recipe'}))});}if(u.hostname==='www.stadt-koeln.de')return Response.json({items:Array.from({length:30},(_,i)=>({title:'Aktivität '+i,beginndatum:'2099-10-13',endedatum:'2099-10-14',uhrzeit:'18:00',veranstaltungsort:'Köln',link:'https://www.stadt-koeln.de/event-'+i,description:'Test event'}))});if(u.hostname==='de.wikipedia.org'){const start=u.searchParams.has('titles')?1:100+Number(u.searchParams.get('gsroffset')||0);return Response.json({query:{pages:Object.fromEntries(Array.from({length:u.searchParams.has('titles')?4:12},(_,i)=>[start+i,{pageid:start+i,index:i,title:'Thema '+(start+i),fullurl:'https://de.wikipedia.org/wiki/Test_'+(start+i)}]))}});}return real(input,options);};`,
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
      const get = async (kind, refresh = false) => {
        const r = await fetch(
          base +
            "/api/suggestions?kind=" +
            kind +
            (refresh ? "&refresh=1" : ""),
        );
        assert.equal(r.headers.get("cache-control"), "no-store");
        return r.json();
      };
      const ids = (d) => d.items.map((x) => x.id);
      const enabledLife = await (await fetch(base + "/api/life")).json();
      enabledLife.tabSettings.food = { online: true };
      enabledLife.tabSettings.events = { online: true };
      await fetch(base + "/api/life", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify(enabledLife),
      });
      const food = await get("food");
      assert.equal(food.items.length, 8);
      assert.equal(food.items[0].id, "meal-1");
      assert.deepEqual(ids(await get("food")), ids(food));
      const next = await get("food", true);
      assert.equal(next.items.length, 8);
      assert.ok(next.items.every((x) => !ids(food).includes(x.id)));
      assert.deepEqual(ids(await get("food")), ids(next));
      const third = await get("food", true);
      assert.ok(
        third.items.every(
          (x) => !ids(food).includes(x.id) && !ids(next).includes(x.id),
        ),
      );
      const failed = await get("food", true);
      assert.ok(failed.error);
      assert.deepEqual(ids(failed), ids(third));
      const events = await get("events"),
        more = await get("events", true),
        last = await get("events", true),
        none = await get("events", true);
      assert.equal(events.items.length, 12);
      assert.equal(more.items.length, 12);
      assert.equal(last.items.length, 6);
      assert.ok(more.items.every((x) => !ids(events).includes(x.id)));
      assert.ok(none.notice);
      assert.deepEqual(ids(none), ids(last));
      const sport = await get("sport"),
        newSport = await get("sport", true);
      assert.ok(newSport.items.length);
      assert.ok(
        newSport.items.every((x) => !sport.items.some((y) => y.url === x.url)),
      );
      const life = await (await fetch(base + "/api/life")).json();
      life.rhythms.push({
        id: "photo",
        name: "Fotografie",
        days: 7,
        target: 1,
        unit: "times",
        online: true,
      });
      await fetch(base + "/api/life", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify(life),
      });
      const topic = await get("photo"),
        nextTopic = await get("photo", true);
      assert.ok(nextTopic.items.every((x) => !ids(topic).includes(x.id)));
    } finally {
      server.kill("SIGTERM");
      await once(server, "exit").catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
