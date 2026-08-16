import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import type { Browser } from 'puppeteer-core';
import { existsSync } from 'node:fs';

let browserInstance: Browser | null = null;
let activeJobs = 0;
const MAX_CONCURRENT = 3;

// @sparticuz/chromium only ships a Linux binary (built for Vercel/Lambda), so
// it cannot launch locally on Windows/macOS dev machines. Outside a serverless
// environment, fall back to a locally installed Chrome or Edge.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const LOCAL_BROWSER_PATHS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter((path): path is string => Boolean(path));

function findLocalExecutablePath(): string {
  const found = LOCAL_BROWSER_PATHS.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      'No local Chrome or Edge installation found for PDF generation. ' +
        'Install Chrome or Edge, or set CHROME_PATH to a browser executable.'
    );
  }
  return found;
}

async function getBrowser(): Promise<Browser> {
  if (browserInstance) return browserInstance;
  browserInstance = await puppeteer.launch(
    isServerless
      ? {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        }
      : {
          executablePath: findLocalExecutablePath(),
          headless: true,
        }
  );
  return browserInstance;
}

export interface GeneratePdfOptions {
  // Repeated on every printed page via Puppeteer's own header/footer
  // mechanism - required for content (like the worksheet footer) that must
  // appear once per page rather than once in the document flow. Omitting
  // both keeps the previous plain-content-only behaviour.
  headerTemplate?: string;
  footerTemplate?: string;
}

export async function generatePdf(
  html: string,
  format: 'A4' | 'Letter' = 'A4',
  options: GeneratePdfOptions = {}
): Promise<Buffer> {
  while (activeJobs >= MAX_CONCURRENT) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  activeJobs++;
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => (window as unknown as { MathJax?: { typesetPromise?: () => Promise<void> } }).MathJax?.typesetPromise?.());
    const displayHeaderFooter = Boolean(options.headerTemplate || options.footerTemplate);
    const pdf = await page.pdf({
      format,
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '22mm', right: '22mm' },
      displayHeaderFooter,
      headerTemplate: options.headerTemplate ?? '<span></span>',
      footerTemplate: options.footerTemplate ?? '<span></span>',
    });
    await page.close();
    return Buffer.from(pdf);
  } catch (error) {
    browserInstance = null;
    throw error;
  } finally {
    activeJobs--;
  }
}
