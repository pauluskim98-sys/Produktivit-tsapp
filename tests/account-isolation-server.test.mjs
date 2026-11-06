import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { issueSession, randomToken, sessionCookie } from "../lib/private-account.ts";

test("two authenticated accounts cannot read each other's tasks, notes or uploads", {timeout:30000}, async () => {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once("error",reject); socket.listen(0,"127.0.0.1",resolve); });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const root = await mkdtemp(join(tmpdir(),"lifemap-isolation-"));
  const key = randomToken(), origin="https://lifemap-test.invalid";
  const child = spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(port)],{env:{...process.env,DATABASE_PATH:join(root,"isolated.sqlite"),LIFEMAP_PUBLIC_ORIGIN:origin,LIFEMAP_GOOGLE_CLIENT_ID:"test.apps.googleusercontent.com",LIFEMAP_GOOGLE_CLIENT_SECRET:"fake-test-only",LIFEMAP_SESSION_SECRET:key},stdio:["ignore","ignore","inherit"]});
  try {
    const url=`http://127.0.0.1:${port}`;
    let ready=false;
    for(let i=0;i<60;i++) {
      if(child.exitCode!==null)break;
      try { ready=(await fetch(`${url}/api/state`,{signal:AbortSignal.timeout(500)})).status===401; if(ready)break; } catch {}
      await pause(150);
    }
    assert.ok(ready,"anonymous access must be denied");
    const account = async (subject) => {
      const cookie = `${sessionCookie}=${await issueSession(key,subject)}`;
      return (path, body) => fetch(`${url}${path}`,{method:body===undefined?"GET":"POST",headers:{Cookie:cookie,Host:"lifemap-test.invalid",Origin:origin,...(body===undefined || body instanceof FormData?{}:{"Content-Type":"application/json"})},body:body===undefined || body instanceof FormData?body:JSON.stringify(body)});
    };
    const alice=await account("test-alice"), bob=await account("test-bob");
    const date="2026-11-05";
    const todo={id:crypto.randomUUID(),title:"Nur Alice",description:"",notes:"",done:false,priority:"none",plannedDate:null,time:"",deadline:null,duration:null,tags:[],subtasks:[],position:1,createdAt:new Date().toISOString()};
    const save = await alice("/api/todos",{action:"save",todo});
    assert.equal(save.status,200,save.ok?undefined:await save.text());
    assert.equal((await alice("/api/notes",{date,content:"Privat"})).status,200);
    const form=new FormData(); form.append("files",new Blob(["Privat"],{type:"text/plain"}),"privat.txt");
    const upload=await alice("/api/storage",form); assert.equal(upload.status,200);
    const file=(await upload.json()).added[0];
    const [own,other] = await Promise.all([alice("/api/state").then(r=>r.json()),bob("/api/state").then(r=>r.json())]);
    assert.equal(own.todos[0].id,todo.id);
    assert.equal(own.dayNotes[date],"Privat");
    assert.deepEqual(other.todos,[]);
    assert.deepEqual(other.dayNotes,{});
    assert.equal((await bob(`/api/storage?file=${file}`)).status,404);
    assert.equal(await (await alice(`/api/storage?file=${file}`)).text(),"Privat");
    assert.equal((await bob("/api/todos",{action:"save",todo:{...todo,title:"Nur Bob"}})).status,200);
    assert.equal((await (await alice("/api/state")).json()).todos[0].title,"Nur Alice");
    assert.equal((await (await bob("/api/state")).json()).todos[0].title,"Nur Bob");
  } finally { child.kill(); }
});
