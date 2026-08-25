import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/pdf": ["node_modules/@sparticuz/chromium/bin/**"],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
