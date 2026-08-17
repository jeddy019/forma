export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMondayParentSummaryEmail } from '@/lib/email/send';
import { computeWeeklySummary, type ScoredSubmission } from '@/lib/summary/weeklySummary';

// EMAIL 4: Monday parent summary (Build Phases Step 24). Permissions
// Summary lists "Monday summaries" only under PARENT's paid plan, not
// TUTOR's - unlike the schedules feature (Step 21), which both roles get.
// No per-owner delivery-time preference exists anywhere in the schema (the
// schedules table's delivery_timezone is per-schedule, not per-owner), so
// this runs once at a single fixed time for everyone - see vercel.json's
// cron entry - a documented simplification, not an oversight.
const DAYS_LOOKBACK = 7;

type AdminClient = ReturnType<typeof createAdminClient>;

interface StudentRow {
  id: string;
  name: string;
}

interface SubmissionRow {
  score_percentage: number | null;
  worksheet: { topic: string } | null;
}

async function sendSummaryForStudent(admin: AdminClient, ownerEmail: string, student: StudentRow, sinceIso: string): Promise<void> {
  const { data: submissions } = await admin
    .from('submissions')
    .select('score_percentage, worksheet:worksheets(topic)')
    .eq('student_id', student.id)
    .gte('submitted_at', sinceIso)
    .not('score_percentage', 'is', null)
    .returns<SubmissionRow[]>();

  const scored: ScoredSubmission[] = (submissions ?? [])
    .filter((s): s is SubmissionRow & { score_percentage: number; worksheet: { topic: string } } => s.score_percentage !== null && s.worksheet !== null)
    .map((s) => ({ scorePercentage: s.score_percentage, topic: s.worksheet.topic }));

  const summary = computeWeeklySummary(scored);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  await sendMondayParentSummaryEmail(ownerEmail, {
    studentName: student.name,
    worksheetsCompleted: summary.worksheetsCompleted,
    averageScorePercentage: summary.averageScorePercentage,
    strongestTopic: summary.strongestTopic,
    areaToImprove: summary.areaToImprove,
    // /dashboard/worksheets (Routing Structure's own "History" route) has
    // never been built as its own step - links to the students list
    // instead, which exists and works for a parent, rather than to
    // /dashboard/marking (tutor-only, would dead-end a parent with an
    // upsell message).
    dashboardUrl: `${appUrl}/dashboard/students`,
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const sinceIso = new Date(Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000).toISOString();

  const { data: parents, error: parentsError } = await admin.from('users').select('id, email').eq('role', 'parent').eq('plan', 'pro');
  if (parentsError) {
    console.error('Failed to query parent-pro owners', parentsError);
    return NextResponse.json({ error: 'Failed to query owners' }, { status: 500 });
  }

  const results = { owners: parents?.length ?? 0, studentsSummarised: 0, failed: 0 };

  // Same isolation principle as the generation cron: one owner or one
  // student failing must not stop the rest.
  for (const owner of parents ?? []) {
    const { data: students } = await admin.from('student_profiles').select('id, name').eq('owner_id', owner.id).returns<StudentRow[]>();

    for (const student of students ?? []) {
      try {
        await sendSummaryForStudent(admin, owner.email, student, sinceIso);
        results.studentsSummarised++;
      } catch (error) {
        console.error(`Monday summary failed for student ${student.id}`, error);
        results.failed++;
      }
    }
  }

  return NextResponse.json(results, { status: 200 });
}
