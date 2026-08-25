export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePdf } from '@/lib/pdf/browser-pool';
import { buildFooterTemplate } from '@/lib/pdf/worksheet-template';
import { renderWorksheetHtml, renderMarkSchemeHtml } from '@/lib/render/worksheetHtml';
import type { WorksheetQuestion } from '@/lib/pdf/worksheet-template';
import type { MarkSchemeQuestion } from '@/lib/pdf/mark-scheme-template';
import { isActivePro } from '@/lib/payments/planStatus';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Performance Rule 10's documented "PDF: 25 seconds" cap. The LuaLaTeX
// microservice (whose two-pass compiles needed 55s) is gone - worksheets and
// mark schemes are now HTML rendered in-process and printed by Chromium via
// the shared browser pool, which is a sub-second operation warm.
const PDF_TIMEOUT_MS = 25_000;
const GENERIC_FAILURE_MESSAGE = 'Could not generate the PDF - please try again.';

interface PdfRequestBody {
  worksheetId?: string;
  format?: string;
  document?: string;
}

interface WorksheetRow {
  id: string;
  subject: string;
  topic: string;
  alignment_note: string | null;
  digital_code: string;
  questions_json: { questions: WorksheetQuestion[] };
  mark_scheme_json: { questions: MarkSchemeQuestion[] } | null;
  created_at: string;
  student: { name: string; curriculum_level: string | null; year_level: string | null } | null;
}

function formatFilenameDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

// Strips anything that isn't a filesystem-safe character - subjects like
// "English Language" and student names with spaces both flow through this,
// per the "PDF FILENAME" spec's [StudentFirstName]-[Subject]-[DDMMMYYYY]
// format, which has no separator characters within each segment.
function sanitizeForFilename(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, '');
  return cleaned || 'Student';
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: PdfRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { worksheetId, format, document } = body;
  if (!worksheetId || !UUID_PATTERN.test(worksheetId)) {
    return NextResponse.json({ error: 'worksheetId is required.' }, { status: 400 });
  }
  if (format !== 'A4' && format !== 'Letter') {
    return NextResponse.json({ error: 'format must be "A4" or "Letter".' }, { status: 400 });
  }
  if (document !== 'worksheet' && document !== 'mark_scheme') {
    return NextResponse.json({ error: 'document must be "worksheet" or "mark_scheme".' }, { status: 400 });
  }

  // RLS (worksheets_own / profiles_own, both auth.uid() = owner_id) is the
  // real ownership check here - a worksheet belonging to another user simply
  // isn't returned, so "doesn't exist" and "isn't yours" both surface as the
  // same 404 rather than leaking which case it was.
  const { data: worksheet, error: worksheetError } = await supabase
    .from('worksheets')
    .select(
      'id, subject, topic, alignment_note, digital_code, questions_json, mark_scheme_json, created_at, student:student_profiles(name, curriculum_level, year_level)'
    )
    .eq('id', worksheetId)
    .single<WorksheetRow>();

  if (worksheetError || !worksheet) {
    return NextResponse.json({ error: 'Worksheet not found.' }, { status: 404 });
  }

  if (document === 'mark_scheme') {
    // Permissions Summary: mark schemes are a tutor-pro entitlement only -
    // free tier and the parent plan explicitly exclude them.
    const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
    if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
      return NextResponse.json({ error: 'Mark schemes are available on the Tutor plan.' }, { status: 403 });
    }
    if (!worksheet.mark_scheme_json) {
      console.error('Worksheet has no mark_scheme_json', worksheetId);
      return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
    }
  }

  const createdAt = new Date(worksheet.created_at);
  const studentName = worksheet.student?.name ?? 'Student';
  const curriculumBadge = worksheet.student?.curriculum_level ?? '';
  const yearOrGradeBadge = worksheet.student?.year_level ?? '';

  const html =
    document === 'worksheet'
      ? renderWorksheetHtml(
          {
            header: {
              studentName,
              subject: worksheet.subject,
              topic: worksheet.topic,
              curriculumBadge,
              yearOrGradeBadge,
              alignmentNote: worksheet.alignment_note,
              curriculumLevelForFallback: curriculumBadge,
              digitalCode: worksheet.digital_code,
              createdAt,
            },
            questions: worksheet.questions_json.questions,
          },
        )
      : renderMarkSchemeHtml(
          {
            header: {
              studentName,
              subject: worksheet.subject,
              topic: worksheet.topic,
              curriculumBadge,
              yearOrGradeBadge,
              alignmentNote: worksheet.alignment_note,
              curriculumLevelForFallback: curriculumBadge,
              createdAt,
            },
            // Presence already checked above when document === 'mark_scheme'.
            questions: worksheet.mark_scheme_json!.questions,
          },
        );

  // Chromium prints the HTML directly - no compile service, no image manifest.
  // The abort signal is what makes the timeout real: on expiry it closes the
  // page mid-print (see generatePdf), so a hung print cannot linger as a
  // zombie. The Promise.race stays as belt-and-braces so the client never
  // waits past the cap even if teardown itself stalls.
  const controller = new AbortController();
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await Promise.race([
      generatePdf(html, format, { footerTemplate: buildFooterTemplate(), signal: controller.signal }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error('PDF render timed out'), { name: 'AbortError' }));
        }, PDF_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`PDF render timed out after ${PDF_TIMEOUT_MS}ms for worksheet ${worksheetId} (${document})`);
      return NextResponse.json({ error: 'This is taking longer than expected - please try again.' }, { status: 504 });
    }
    console.error('PDF generation failed', error);
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  const firstName = sanitizeForFilename(studentName.split(' ')[0] ?? '');
  const subjectPart = sanitizeForFilename(worksheet.subject);
  const suffix = document === 'mark_scheme' ? '-MarkScheme' : '';
  const filename = `${firstName}-${subjectPart}-${formatFilenameDate(createdAt)}${suffix}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
