import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // SQLite schema initialization must not race across parallel build workers.
  experimental: { cpus: 1 },
  distDir: process.env.LIFEMAP_BUILD_DIR || ".next",
  serverExternalPackages: ["node:sqlite", "tesseract.js"],
  poweredByHeader: false,
};
export default config;
