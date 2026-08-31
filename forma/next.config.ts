import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` from auto-generating / re-adding AGENTS.md & CLAUDE.md
  // agent-rules blocks (this project's authoritative instructions live in the
  // repo-root CLAUDE.md, tracked separately). opt-out flag per Next 16.
  agentRules: false,
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/pdf': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/invoices/[id]/pdf': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/webhooks/flutterwave': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/payments/callback': ['node_modules/@sparticuz/chromium/bin/**'],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
