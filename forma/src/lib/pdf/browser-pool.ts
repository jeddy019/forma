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
          args: ['--no-first-run', '--disable-dev-shm-usage'],
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
  // Abort signal wired from /api/pdf's timeout. Firing it closes the page
  // mid-print so a timed-out job cannot linger as a zombie holding memory -
  // before this existed, the route's Promise.race returned 504 while the
  // underlying print kept running unbounded in the background.
  signal?: AbortSignal;
}

function abortError(): Error {
  return Object.assign(new Error('PDF print aborted'), { name: 'AbortError' });
}

// Per-step elapsed-time logging. Every step names itself so one real download
// click pinpoints exactly where time (or a hang) went, instead of a single
// opaque "504 after 25s".
export async function generatePdf(
  html: string,
  format: 'A4' | 'Letter' = 'A4',
  options: GeneratePdfOptions = {}
): Promise<Buffer> {
  const started = Date.now();
  const step = (label: string, from: number) =>
    console.log(`[pdf-timing] ${label}: ${Date.now() - from}ms (t+${Date.now() - started}ms)`);

  if (options.signal?.aborted) throw abortError();

  while (activeJobs >= MAX_CONCURRENT) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (options.signal?.aborted) throw abortError();
  }
  activeJobs++;

  let pageClosedByAbort = false;
  try {
    const launchStart = Date.now();
    const browser = await getBrowser();
    step('launch', launchStart);

    if (options.signal?.aborted) throw abortError();

    const contentStart = Date.now();
    const page = await browser.newPage();
    options.signal?.addEventListener(
      'abort',
      () => {
        pageClosedByAbort = true;
        void page.close().catch(() => {});
      },
      { once: true }
    );

    await page.setContent(html, { waitUntil: 'load' });
    step('setContent', contentStart);

    // All fonts are embedded as data URIs (printStyles.ts), so this resolves
    // near-instantly with zero network dependency; it stays as the guard that
    // Chromium has finished applying every face before printing.
    const fontsStart = Date.now();
    await page.evaluate(() => document.fonts.ready);
    step('fonts.ready', fontsStart);

    const pdfStart = Date.now();
    const pdf = await page.pdf({
      format,
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '22mm', right: '22mm' },
      displayHeaderFooter: Boolean(options.headerTemplate || options.footerTemplate),
      headerTemplate: options.headerTemplate ?? '<span></span>',
      footerTemplate: options.footerTemplate ?? '<span></span>',
    });
    step('page.pdf', pdfStart);

    await page.close();
    step('total', started);
    return Buffer.from(pdf);
  } catch (error) {
    if (pageClosedByAbort) {
      // The caller aborted on purpose - the warm browser is fine to keep.
      throw abortError();
    }
    browserInstance = null;
    throw error;
  } finally {
    activeJobs--;
  }
}
