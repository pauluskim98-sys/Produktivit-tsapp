import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { dirname, join } from "node:path";
const file = join(
  dirname(
    process.env.DATABASE_PATH || join(process.cwd(), "data", "raum.sqlite"),
  ),
  "ai-config.json",
);
export function getApiKey() {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return typeof data.key === "string" && data.key
      ? data.key
      : process.env.OPENAI_API_KEY || "";
  } catch {
    return process.env.OPENAI_API_KEY || "";
  }
}
export function saveApiKey(key: string) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = file + ".tmp";
  writeFileSync(temp, JSON.stringify({ key }), { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, file);
}
