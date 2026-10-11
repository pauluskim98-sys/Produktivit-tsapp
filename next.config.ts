import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  poweredByHeader: false,
};
export default config;
