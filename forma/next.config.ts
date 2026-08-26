import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
