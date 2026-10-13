import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.LIFEMAP_BUILD_DIR || ".next",
  serverExternalPackages: ["node:sqlite", "tesseract.js"],
  poweredByHeader: false,
};
export default config;
