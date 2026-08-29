export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isActivePro } from '@/lib/payments/planStatus';
import { generateSessionBrief, type SessionBriefStudentRow } from '@/lib/brief/generateSessionBrief';

// Phase B W3 (session brief): streams the founder's branded before-session
// prep PDF as a direct download - no storage, no email, nothing persisted,
// the same on-demand pattern /api/pdf and the invoice PDF route already use.
// It is deliberately founder-facing: the brief reads session notes (a
// tutor-pro entitlement) and its data is practice scores, never parent data.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same budget as the invoice PDF route (Performance Rule 10) - a brief is a
// similarly simple document, no KaTeX, just data + one note block.
const PDF_TIMEOUT_MS = 25_000;

interface OwnerRow {
  role: string | null;
  plan: string | null;
  plan_expires_at: string | null;
  brand_name: string | null;
  brand_accent: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  if (!UUID_PATTERN.test(studentId)) {
    return NextResponse.json({ error: 'Invalid student id.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  // The brief reads session notes, which are a tutor-pro entitlement
  // everywhere else in this app - gate the route the same way so a free-tier
  // account cannot spend a Chromium render on a brief of pro-gated data.
  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at, brand_name, brand_accent').eq('id', user.id).single<OwnerRow>();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return NextResponse.json({ error: 'Session briefs are available on the Tutor plan.' }, { status: 403 });
  }

  // RLS (profiles_own: auth.uid() = owner_id) is the real ownership check -
  // someone else's student simply isn't returned, so "doesn't exist" and
  // "isn't yours" surface identically, same collapse as the invoice route.
  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, name, curriculum_level, year_level')
    .eq('id', studentId)
    .single<SessionBriefStudentRow>();
  if (!student) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
  }

  let pdfBuffer: Buffer;
  let filename: string;
  try {
    const result = await Promise.race([
      generateSessionBrief(createAdminClient(), student, { brand_name: ownerRow.brand_name, brand_accent: ownerRow.brand_accent }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF_TIMEOUT')), PDF_TIMEOUT_MS)),
    ]);
    pdfBuffer = result.pdfBuffer;
    filename = result.filename;
  } catch (error) {
    if (error instanceof Error && error.message === 'PDF_TIMEOUT') {
      return NextResponse.json({ error: 'This is taking longer than expected - please try again.' }, { status: 504 });
    }
    console.error('Session brief PDF generation failed', error);
    return NextResponse.json({ error: 'Could not build the session brief - please try again.' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}