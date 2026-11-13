import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { newShape } from "../lib/sketchboard.ts";

test(
  "board API persists and rejects stale revisions, corrupt data and cross-origin writes",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "lifemap-board-test-"));
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
          const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
          if (match && output.includes("Ready in")) {
            clearTimeout(timeout);
            resolve(match[0]);
          }
        };
        server.stdout.on("data", read);
        server.stderr.on("data", read);
        server.once("error", reject);
      });
      const get = () => fetch(base + "/api/sketchboard").then((r) => r.json());
      const put = (body, origin = base) =>
        fetch(base + "/api/sketchboard", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify(body),
        });
      const initial = await get();
      assert.equal(initial.revision, 0);
      assert.equal(initial.board.nodes.length, 0);
      const node = newShape("sticky", -40, 130);
      node.data.text = "Dauerhafte Notiz";
      const body = {
        ...initial,
        board: {
          ...initial.board,
          nodes: [node],
          viewport: { x: 42, y: -70, zoom: 1.25 },
        },
      };
      assert.equal((await put(body)).status, 200);
      assert.equal((await put(body)).status, 409);
      const saved = await get();
      assert.equal(saved.revision, 1);
      assert.equal(saved.board.nodes[0].data.text, node.data.text);
      assert.deepEqual(saved.board.viewport, body.board.viewport);
      assert.equal(
        (
          await put({
            ...saved,
            board: { ...saved.board, nodes: [{ ...node, width: -1 }] },
          })
        ).status,
        400,
      );
      assert.equal((await put(saved, "https://example.invalid")).status, 400);
      assert.deepEqual(await get(), saved);
      const calendar = await fetch(base + "/api/state");
      assert.equal(calendar.status, 200);
    } finally {
      server.kill();
      await exited;
    }
  },
);
