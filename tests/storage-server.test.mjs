import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
test(
  "local storage uploads, folders, cycle protection, soft-delete restore, safe downloads and inbox notes",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "lifemap-storage-"));
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
      const folder = await post("/api/storage", {
        action: "folder",
        name: "Unterlagen",
      });
      assert.equal(folder.status, 200);
      const id = folder.data.added[0];
      const child = await post("/api/storage", {
        action: "folder",
        name: "Kind",
        parentId: id,
      });
      assert.equal(
        (
          await post("/api/storage", {
            action: "move",
            id,
            parentId: child.data.added[0],
          })
        ).status,
        400,
      );
      const form = new FormData();
      form.set("parentId", id);
      form.append(
        "files",
        new File(["<script>alert(1)</script>"], "example.html", {
          type: "text/html",
        }),
      );
      let r = await fetch(base + "/api/storage", {
        method: "POST",
        headers: { Origin: base },
        body: form,
      });
      const upload = await r.json();
      assert.equal(r.status, 200);
      const file = upload.added[0];
      assert.equal(upload.items.find((x) => x.id === file).parentId, id);
      assert.ok(!JSON.stringify(upload.items).includes("alert(1)"));
      r = await fetch(base + "/api/storage?file=" + file);
      assert.match(r.headers.get("content-disposition"), /^attachment/);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert.equal(await r.text(), "<script>alert(1)</script>");
      const mediaForm = new FormData();
      mediaForm.append(
        "files",
        new File(["0123456789"], "Beispiel.mp4", { type: "video/mp4" }),
      );
      const mediaUpload = await fetch(base + "/api/storage", {
        method: "POST",
        headers: { Origin: base },
        body: mediaForm,
      });
      const media = (await mediaUpload.json()).added[0];
      const piece = await fetch(base + "/api/storage?file=" + media, {
        headers: { Range: "bytes=2-5" },
      });
      assert.equal(piece.status, 206);
      assert.equal(piece.headers.get("content-range"), "bytes 2-5/10");
      assert.equal(await piece.text(), "2345");
      const suffix = await fetch(base + "/api/storage?file=" + media, {
        headers: { Range: "bytes=-3" },
      });
      assert.equal(await suffix.text(), "789");
      assert.equal(
        (
          await fetch(base + "/api/storage?file=" + media, {
            headers: { Range: "bytes=20-30" },
          })
        ).status,
        416,
      );
      assert.match(
        (
          await fetch(base + "/api/storage?file=" + media + "&download=1")
        ).headers.get("content-disposition"),
        /^attachment/,
      );
      await post("/api/storage", {
        action: "rename",
        id: file,
        name: "Neu.html",
      });
      await post("/api/storage", { action: "delete", id: file });
      assert.equal(
        (await fetch(base + "/api/storage?file=" + file)).status,
        404,
      );
      await post("/api/storage", { action: "restore", id: file });
      assert.equal(
        (await fetch(base + "/api/storage?file=" + file)).status,
        200,
      );
      assert.equal(
        (await post("/api/notes", { date: "inbox", content: "Idee speichern" }))
          .status,
        200,
      );
      assert.equal(
        (await (await fetch(base + "/api/state")).json()).dayNotes.inbox,
        "Idee speichern",
      );
    } finally {
      server.kill("SIGTERM");
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
