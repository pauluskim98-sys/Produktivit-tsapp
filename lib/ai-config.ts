import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { accountDataPath } from "./db";
import { accountConfig } from "./private-account";
const keyFile = () => join(accountDataPath(), "ai-config.json");
export function getApiKey() {
  const fallback = accountConfig().mode === "local" ? process.env.OPENAI_API_KEY || "" : "";
  try {
    const data = JSON.parse(readFileSync(keyFile(), "utf8"));
    return typeof data.key === "string" && data.key
      ? data.key
      : fallback;
  } catch {
    return fallback;
  }
}
export function saveApiKey(key: string) {
  const file = keyFile();
  mkdirSync(dirname(file), { recursive: true });
  const temp = file + ".tmp";
  writeFileSync(temp, JSON.stringify({ key }), { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, file);
}
