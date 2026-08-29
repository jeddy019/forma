export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWeeklyReportEmail } from '@/lib/email/send';
import { generateWeeklyReport, type StudentReportRow } from '@/lib/report/generateWeeklyReport';

// Phase B W2 (weekly branded proof report) - the automatic half of the
// founder model's weekly deliverable. Runs on the same Monday timing as
// EMAIL 4 (monday-summary) but targets tutor-role accounts (the founder),
// sending each student's branded PDF report to their parent_email with the
// standing report_note as the founder's voice. The monday-summary cron
// stays for parent-role accounts; under the founder model there are none.
//
// Guard rails, mirroring the generation cron's isolation discipline:
//   - last_report_sent_at >= since means "already sent this week", skipped
//     (so a manual mid-week send from the student page prevents a duplicate
//     Monday email and vice versa).
//   - one student failing must never stop the rest - each send is its own
//     try/catch.
const DAYS_IN_WEEK = 7;

type AdminClient = ReturnType<typeof createAdminClient>;

interface OwnerRow {
  id: string;
  email: string;
  brand_name: string | null;
  brand_accent: string | null;
}

async function sendReportForStudent(admin: AdminClient, owner: OwnerRow, student: StudentReportRow, now: Date): Promise<boolean> {
  const { data, pdfBuffer, filename } = await generateWeeklyReport(admin, student, owner, now);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const sent = await sendWeeklyReportEmail(
    student.parent_email as string,
    {
      studentName: student.name,
      worksheetsCompleted: data.worksheetsCompleted,
      averageScorePercentage: data.averageScorePercentage,
      strongestTopic: data.strongestTopic,
      areaToImprove: data.areaToImprove,
      dashboardUrl: `${appUrl}/dashboard/students`,
      brandName: owner.brand_name?.trim() || undefined,
    },
    { filename, content: pdfBuffer }
  );

  if (!sent) return false;

  const { error: stampError } = await admin
    .from('student_profiles')
    .update({ last_report_sent_at: now.toISOString() })
    .eq('id', student.id);
  if (stampError) {
    console.error(`Failed to stamp last_report_sent_at for ${student.id}`, stampError);
  }
  return true;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const sinceIso = new Date(now.getTime() - DAYS_IN_WEEK * 24 * 60 * 60 * 1000).toISOString();

  const { data: owners, error: ownersError } = await admin.from('users').select('id, email, brand_name, brand_accent').eq('role', 'tutor');
  if (ownersError) {
    console.error('Failed to query tutor owners', ownersError);
    return NextResponse.json({ error: 'Failed to query owners' }, { status: 500 });
  }

  const results = { owners: (owners ?? []).length, reportsSent: 0, skippedAlreadySent: 0, failed: 0 };

  for (const owner of owners as OwnerRow[]) {
    const { data: students } = await admin
      .from('student_profiles')
      .select('id, name, parent_email, report_note, owner_id')
      .eq('owner_id', owner.id)
      .not('parent_email', 'is', null)
      .returns<StudentReportRow[]>();

    for (const student of students ?? []) {
      // Already reported this week (manual send or an earlier cron run)?
      const { data: profile } = await admin
        .from('student_profiles')
        .select('last_report_sent_at')
        .eq('id', student.id)
        .single<{ last_report_sent_at: string | null }>();
      if (profile?.last_report_sent_at && profile.last_report_sent_at >= sinceIso) {
        results.skippedAlreadySent++;
        continue;
      }

      try {
        const sent = await sendReportForStudent(admin, owner, student, now);
        if (sent) results.reportsSent++;
        else results.failed++;
      } catch (error) {
        console.error(`Weekly report failed for student ${student.id}`, error);
        results.failed++;
      }
    }
  }

  return NextResponse.json(results, { status: 200 });
}