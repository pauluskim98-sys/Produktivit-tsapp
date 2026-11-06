import { isAbsolute } from "node:path";
import { accountConfig } from "../lib/private-account.ts";
if (accountConfig().mode !== "private" || !isAbsolute(process.env.DATABASE_PATH || "")) {
  console.error("Hosting benötigt vollständigen Google-Kontoschutz und einen absoluten DATABASE_PATH. Siehe GOOGLE-SETUP.md.");
  process.exit(1);
}
