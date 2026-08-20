import express, { type Request, type Response, type NextFunction } from 'express';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// This service is a dumb compile box: it knows nothing about worksheets,
// mark schemes, or Forma's domain model. It accepts LaTeX source (already
// assembled and escaped by the Next.js app - see forma/src/lib/pdf/
// escapeLatex.ts) plus any image attachments the source references, and
// returns a compiled PDF or a diagnostic log. All domain logic stays in
// the Next.js app; this service should never need a Forma-specific change.

const PORT = Number(process.env.PORT ?? 8080);
const COMPILE_SECRET = process.env.LATEX_COMPILE_SECRET;

// Fail closed, not open: if the shared secret isn't configured, refuse to
// start at all rather than silently accepting every request. A
// misconfigured deployment should be loud (crash on boot, visible in
// Render's logs) not quietly wide-open on the public internet.
if (!COMPILE_SECRET || COMPILE_SECRET.trim().length === 0) {
  console.error('FATAL: LATEX_COMPILE_SECRET is not set. Refusing to start.');
  process.exit(1);
}

const MAX_CONCURRENT = 3;
const COMPILE_TIMEOUT_MS = 20_000; // per lualatex pass
const LOG_TAIL_CHARS = 20_000;
const MAX_IMAGES = 30;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image, generous for a rasterized diagram/QR code

// Attachment filenames are written directly under a temp directory and
// referenced from \includegraphics{filename} in the LaTeX source - both
// ends are ours (latexClient.ts generates them), but validate anyway so a
// future caller (or a bug) can't write outside the temp dir via '..' or an
// absolute path.
const SAFE_FILENAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

let activeJobs = 0;
const waiters: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT) {
    activeJobs++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  activeJobs++;
}

function releaseSlot(): void {
  activeJobs--;
  const next = waiters.shift();
  if (next) next();
}

interface CompileImage {
  filename: string;
  base64: string;
}

interface CompileRequestBody {
  source?: unknown;
  images?: unknown;
}

interface RunResult {
  ok: boolean;
  logTail: string;
}

function runLualatex(cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(
      'lualatex',
      ['-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape', 'main.tex'],
      { cwd }
    );

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, COMPILE_TIMEOUT_MS);

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const logTail = (timedOut ? '[compile timed out]\n' : '') + output.slice(-LOG_TAIL_CHARS);
      resolve({ ok: !timedOut && code === 0, logTail });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, logTail: `[failed to spawn lualatex: ${error.message}]` });
    });
  });
}

function validateBody(body: CompileRequestBody): { source: string; images: CompileImage[] } | { error: string } {
  if (typeof body.source !== 'string' || body.source.trim().length === 0) {
    return { error: '"source" must be a non-empty string.' };
  }

  const rawImages = body.images;
  if (rawImages === undefined) {
    return { source: body.source, images: [] };
  }
  if (!Array.isArray(rawImages)) {
    return { error: '"images" must be an array if present.' };
  }
  if (rawImages.length > MAX_IMAGES) {
    return { error: `"images" cannot contain more than ${MAX_IMAGES} entries.` };
  }

  const images: CompileImage[] = [];
  for (const entry of rawImages) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as { filename?: unknown }).filename !== 'string' ||
      typeof (entry as { base64?: unknown }).base64 !== 'string'
    ) {
      return { error: 'Each image must be { filename: string, base64: string }.' };
    }
    const { filename, base64 } = entry as { filename: string; base64: string };
    if (!SAFE_FILENAME.test(filename)) {
      return { error: `Invalid image filename: "${filename}".` };
    }
    if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BYTES) {
      return { error: `Image "${filename}" exceeds the ${MAX_IMAGE_BYTES}-byte limit.` };
    }
    images.push({ filename, base64 });
  }
  return { source: body.source, images };
}

const app = express();
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${COMPILE_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  next();
}

app.post('/compile', requireAuth, async (req: Request, res: Response) => {
  const validated = validateBody(req.body as CompileRequestBody);
  if ('error' in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }
  const { source, images } = validated;

  await acquireSlot();
  let tmpDir: string | null = null;
  try {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'forma-latex-'));

    await writeFile(path.join(tmpDir, 'main.tex'), source, 'utf8');
    for (const image of images) {
      await writeFile(path.join(tmpDir, image.filename), Buffer.from(image.base64, 'base64'));
    }

    // Two passes: needspace/lastpage-dependent content (the "N of M" page
    // count in the footer, needspace's own lookahead) needs a second pass
    // to resolve against the first pass's .aux output.
    let result = await runLualatex(tmpDir);
    if (result.ok) {
      result = await runLualatex(tmpDir);
    }

    if (!result.ok) {
      res.status(500).json({ error: 'compile_failed', log: result.logTail });
      return;
    }

    const pdf = await readFile(path.join(tmpDir, 'main.pdf'));
    res.status(200).contentType('application/pdf').send(pdf);
  } catch (error) {
    console.error('Compile request failed', error);
    res.status(500).json({ error: 'internal_error', log: error instanceof Error ? error.message : String(error) });
  } finally {
    releaseSlot();
    // No compiled artifact or AI-generated source should persist on disk
    // between requests, success or failure.
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`forma-latex-service listening on :${PORT}`);
});
