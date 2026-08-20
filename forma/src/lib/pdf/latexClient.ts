// Replaces browser-pool.ts's role for worksheet and mark-scheme PDFs only -
// browser-pool.ts itself is untouched and still generates invoice PDFs (see
// invoice-template.ts / api/invoices/[id]/pdf/route.ts), which have no
// maths or diagrams and gain nothing from moving to LaTeX.
//
// This talks to latex-service/ (a separate, self-hosted Node service, not
// part of this Next.js app's deploy) over plain HTTP with a shared-secret
// bearer token - the same auth pattern this codebase already uses for
// CRON_SECRET on its cron routes.

export interface LatexImageAttachment {
  filename: string;
  buffer: Buffer;
}

export class LatexCompileError extends Error {
  // Truncated LaTeX log from the compile service, for server-side
  // diagnostics only - api/pdf/route.ts must keep surfacing its existing
  // generic, no-raw-errors message to the client (Design System's ERROR
  // STATES rule), this is for console.error, not the HTTP response.
  constructor(message: string, public readonly log?: string) {
    super(message);
    this.name = 'LatexCompileError';
  }
}

function getCompileUrl(): string {
  const url = process.env.LATEX_COMPILE_URL;
  if (!url) {
    throw new Error('LATEX_COMPILE_URL is not configured.');
  }
  return url;
}

function getCompileSecret(): string {
  const secret = process.env.LATEX_COMPILE_SECRET;
  if (!secret) {
    throw new Error('LATEX_COMPILE_SECRET is not configured.');
  }
  return secret;
}

export async function compileLatex(source: string, images: LatexImageAttachment[], signal?: AbortSignal): Promise<Buffer> {
  const url = getCompileUrl();
  const secret = getCompileSecret();

  const response = await fetch(`${url.replace(/\/$/, '')}/compile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      source,
      images: images.map((image) => ({ filename: image.filename, base64: image.buffer.toString('base64') })),
    }),
    signal,
  });

  if (!response.ok) {
    let errorBody: { error?: string; log?: string } = {};
    try {
      errorBody = await response.json();
    } catch {
      // Non-JSON error body (e.g. a 502 from the host itself) - fall through
      // with whatever we have.
    }
    throw new LatexCompileError(
      `LaTeX compile failed with status ${response.status}: ${errorBody.error ?? 'unknown error'}`,
      errorBody.log
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
