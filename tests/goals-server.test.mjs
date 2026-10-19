import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { goalTarget, setGoalTarget } from "../lib/goals.ts";
test(
  "dated goal rules persist alongside legacy targets; invalid rules leave saved state intact",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "lifemap-goals-"));
    const child = spawn(
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
    const exited = once(child, "exit");
    let output = "";
    try {
      const base = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(output)), 20000);
        const read = (x) => {
          output += x;
          const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (m && /Ready in/.test(output)) {
            clearTimeout(timeout);
            resolve(`http://127.0.0.1:${m[1]}`);
          }
        };
        child.stdout.on("data", read);
        child.stderr.on("data", read);
        child.once("error", reject);
      });
      const get = () => fetch(base + "/api/life").then((r) => r.json());
      const post = (body) =>
        fetch(base + "/api/life", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify(body),
        });
      let life = await get();
      life.goalSettings = { sport: { week: { target: 2, unit: "hours" } } };
      assert.equal((await post(life)).status, 200);
      life = setGoalTarget(
        life,
        "sport",
        "year",
        "2027-01-01",
        { target: 48, unit: "hours" },
        true,
      );
      assert.equal((await post(life)).status, 200);
      const saved = await get();
      assert.equal(goalTarget(saved, "sport", "week", "2026-12-21").target, 2);
      assert.equal(goalTarget(saved, "sport", "week", "2027-06-01").target, 1);
      assert.equal(goalTarget(saved, "sport", "month", "2027-06-01").target, 4);
      const invalid = {
        ...saved,
        goalPeriodSettings: {
          sport: { week: { "2027-01-01": { target: 1, unit: "hours" } } },
        },
      };
      assert.equal((await post(invalid)).status, 400);
      assert.deepEqual(await get(), saved);
      const manual = setGoalTarget(saved, "sport", "week", "2027-06-07", {
        target: 3,
        unit: "hours",
      });
      assert.equal((await post(manual)).status, 200);
      const fresh = await get();
      assert.equal(goalTarget(fresh, "sport", "week", "2027-06-01").target, 1);
      assert.equal(goalTarget(fresh, "sport", "week", "2027-07-01").target, 3);
      assert.deepEqual(fresh.rhythms, saved.rhythms);
    } finally {
      child.kill("SIGTERM");
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
