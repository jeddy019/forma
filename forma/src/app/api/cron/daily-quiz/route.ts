export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQuiz, type GeneratedQuizRow } from '@/lib/quiz/generateQuiz';
import { resolveDailyPlan } from '@/lib/daily/dailyDialPlan';
import { selectDailyTarget } from '@/lib/daily/dailyTarget';
import { clearFundamentalsFlag } from '@/lib/mastery/clearFundamentalsFlag';
import { sendDailyQuizDigestEmail, sendFamilyDailyReadyEmail } from '@/lib/email/send';
import { resolveBranding } from '@/lib/branding';
import { resolveStudentFamilyEmails } from '@/lib/families/parentEmail';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { DIFFICULTY_LEVELS, type Country, type DifficultyLevel } from '@/lib/constants';
import type { SkillMap } from '@/lib/mastery/types';

// W8 Wave D (automatic daily quiz + founder digest): the daily-driver
// automation of the founder model.
//
//   - Runs once each morning (vercel.json: "0 6 * * *") on the Hobby-plain
//     daily schedule, generated BEFORE school, ready when school finishes.
//   - One quiz per student per day, derived from the student's own dials
//     (volume / difficulty posture / holiday posture) and targeted at their
//     exact weakness (fundamentals > weakest sub-skill > most recent topic).
//     No warm-up, no challenge, never easy-tier (all-core type order).
//   - One morning digest email to the founder listing every student's link -
//     the founder forwards it, the student practises after school. Student
//     failures are listed, never silently skipped (same isolation discipline
//     as the other crons: one failing student must not stop the rest, and a
//     retry-once per student mirrors generate-scheduled).
//   - W8 Wave E (2026-08-30): ONE parent-facing email per FAMILY, addressed to
//     families.parent_email (the only place a parent email lives now), listing
//     every child whose practice generated this morning. Grouped by family so
//     a 2-3 child family gets one email, not two or three. The founder digest
//     is separate and unchanged.

type AdminClient = ReturnType<typeof createAdminClient>;

interface OwnerRow {
  id: string;
  email: string | null;
  brand_name: string | null;
  brand_accent: string | null;
  paper_size: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  exam_board: string | null;
  skill_map: SkillMap | null;
  owner_id: string;
  practice_volume: 'light' | 'standard' | 'deep';
  difficulty_posture: 'match' | 'push' | 'consolidate';
  holiday_posture: 'normal' | 'light' | 'paused';
  current_difficulty: string | null;
  last_daily_generated_at: string | null;
}

interface DigestEntry {
  name: string;
  subject: string;
  topic: string;
  url: string;
  digitalCode: string;
}

function normalizeDifficulty(raw: string | null): DifficultyLevel {
  return (DIFFICULTY_LEVELS as readonly string[]).includes(raw ?? '') ? (raw as DifficultyLevel) : 'standard';
}

function startOfUtcDay(now: Date): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

async function loadMostRecentTopic(admin: AdminClient, studentId: string): Promise<{ subject: string | null; topic: string | null } | null> {
  const { data } = await admin
    .from('worksheets')
    .select('subject, topic')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ subject: string | null; topic: string | null } | null>();
  return data;
}

// One student's daily attempt, with a single retry (same shape as the
// generate-scheduled cron's retry-once). Returns the digest entry on success
// or the failure reason.
async function generateForStudent(
  admin: AdminClient,
  owner: OwnerRow,
  student: StudentRow,
  now: Date
): Promise<{ studentId: string; entry?: DigestEntry; reason?: string }> {
  const plan = resolveDailyPlan({
    practiceVolume: student.practice_volume,
    difficultyPosture: student.difficulty_posture,
    holidayPosture: student.holiday_posture,
    currentDifficulty: normalizeDifficulty(student.current_difficulty),
  });
  if (!plan) return { studentId: student.id, reason: 'holiday-paused' };

  if (student.last_daily_generated_at && student.last_daily_generated_at >= startOfUtcDay(now)) {
    return { studentId: student.id, reason: 'already-generated' };
  }

  const skillMap = student.skill_map ?? {};
  const recentWorksheet = await loadMostRecentTopic(admin, student.id);
  const target = selectDailyTarget(skillMap, recentWorksheet ? [recentWorksheet] : []);
  if (!target) return { studentId: student.id, reason: 'no-history' };

  // Dietary rules stay AI-side even when the maths engine could own the topic:
  // the directives are folded into the topic/sub-skill text the engine never
  // sees, exactly like every manual generation path.
  const topicPrompt =
    target.kind === 'recent' && target.subject
      ? `${target.topic} (${target.subject})`
      : target.topic;
  const topicPromptSanitized = stripHtmlTags(topicPrompt).trim();
  const subSkillDirective =
    target.kind === 'weakest' && target.subSkill
      ? `Write every question on this exact sub-skill, do not decompose freely: "${stripHtmlTags(target.subSkill).trim()}".`
      : undefined;
  const fundamentalsTarget =
    target.kind === 'fundamentals' && target.subSkill ? { subSkill: target.subSkill, topic: target.topic } : null;

  const attempt = async (): Promise<GeneratedQuizRow> =>
    generateQuiz({
      profile: {
        id: student.id,
        name: student.name,
        country: student.country,
        curriculum_level: student.curriculum_level,
        year_level: student.year_level,
        subjects: student.subjects,
        exam_board: student.exam_board,
      },
      ownerId: owner.id,
      owner: {
        email: owner.email,
        paper_size: owner.paper_size,
        brand_name: owner.brand_name,
        brand_accent: owner.brand_accent,
      },
      generatedFrom: 'daily',
      questionCount: plan.questionCount,
      dailyStyle: true,
      topicPrompt: topicPromptSanitized,
      subSkillDirective,
      fundamentalsTarget,
      sendReadyEmail: false,
    });

  let inserted: GeneratedQuizRow;
  try {
    inserted = await attempt();
  } catch (firstError) {
    console.error(`Daily quiz failed for ${student.id} (attempt 1)`, firstError);
    try {
      inserted = await attempt();
    } catch (secondError) {
      console.error(`Daily quiz failed for ${student.id} (attempt 2)`, secondError);
      return { studentId: student.id, reason: 'failed' };
    }
  }

  // Stamp idempotency so a re-run this morning can never mint a second quiz
  // for the same student.
  await admin.from('student_profiles').update({ last_daily_generated_at: now.toISOString() }).eq('id', student.id);

  // Fundamentals flag cleared once the fundamentals-routed set exists
  // (mirrors /api/generate/daily/route.ts).
  if (fundamentalsTarget) {
    try {
      await admin
        .from('student_profiles')
        .update({ skill_map: clearFundamentalsFlag(student.skill_map ?? {}, fundamentalsTarget.subSkill) })
        .eq('id', student.id);
    } catch (error) {
      console.error('Failed to clear fundamentals flag', error);
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    studentId: student.id,
    entry: {
      name: student.name,
      subject: inserted.subject,
      topic: inserted.topic,
      url: `${appUrl}/q/${inserted.digital_code}`,
      digitalCode: inserted.digital_code,
    },
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: owners, error: ownersError } = await admin
    .from('users')
    .select('id, email, brand_name, brand_accent, paper_size')
    .eq('role', 'tutor');
  if (ownersError) {
    console.error('Failed to query tutor owners', ownersError);
    return NextResponse.json({ error: 'Failed to query owners' }, { status: 500 });
  }

  const results = {
    owners: (owners ?? []).length,
    generated: 0,
    skippedPaused: 0,
    skippedAlready: 0,
    skippedNoHistory: 0,
    failed: 0,
    digestsSent: 0,
    familyEmailsSent: 0,
    studentsNoFamilyEmail: 0,
  };

  for (const owner of owners as OwnerRow[]) {
    const { data: students } = await admin
      .from('student_profiles')
      .select(
        'id, name, country, curriculum_level, year_level, subjects, exam_board, skill_map, owner_id, practice_volume, difficulty_posture, holiday_posture, current_difficulty, last_daily_generated_at'
      )
      .eq('owner_id', owner.id)
      .returns<StudentRow[]>();

    if (!students || students.length === 0) continue;

    // Parallel within a single owner (the founder has a handful of students;
    // sequential 30-45s AI generations would blow this route's maxDuration
    // budget) - each student still isolated so one failure can't starve the
    // others.
    const outcomes = await Promise.all(students.map((student) => generateForStudent(admin, owner, student, now)));

    const entries: DigestEntry[] = [];
    const generatedByStudent = new Map<string, DigestEntry>();
    for (const outcome of outcomes) {
      if (outcome.entry) {
        results.generated++;
        entries.push(outcome.entry);
        generatedByStudent.set(outcome.studentId, outcome.entry);
        continue;
      }
      switch (outcome.reason) {
        case 'holiday-paused':
          results.skippedPaused++;
          break;
        case 'already-generated':
          results.skippedAlready++;
          break;
        case 'no-history':
          results.skippedNoHistory++;
          break;
        default:
          results.failed++;
      }
    }

    // W8 Wave E: group this morning's generated quizzes by family and send ONE
    // parent-facing email per family (never one per child - a 2-3 child family
    // must get a single digestible email, the founder model's core promise).
    // Students whose family has no parent_email set get NO parent email -
    // that state is visible in the founder digest below and on the dashboard,
    // never silently skipped, but nothing is sent to a missing address.
    if (generatedByStudent.size > 0) {
      const { emails: familyEmails, missing } = await resolveStudentFamilyEmails(admin, [...generatedByStudent.keys()]);
      results.studentsNoFamilyEmail += missing;

      const byFamily = new Map<string, DigestEntry[]>();
      for (const [studentId, entry] of generatedByStudent) {
        const parentEmail = familyEmails.get(studentId);
        if (!parentEmail) continue;
        const bucket = byFamily.get(parentEmail);
        if (bucket) bucket.push(entry);
        else byFamily.set(parentEmail, [entry]);
      }
      for (const [parentEmail, familyEntries] of byFamily) {
        const sent = await sendFamilyDailyReadyEmail(parentEmail, {
          dateLabel: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          entries: familyEntries,
          brandName: resolveBranding(owner).name,
        });
        if (sent) results.familyEmailsSent++;
        else console.error(`Failed to send family-ready email to ${parentEmail}`);
      }
    }

    // The digest always goes out - even when every student skipped or failed,
    // the founder must see that a morning passed and what state it left
    // things in (planes never fly silently on the founder's dashboard).
    // It goes to the owner's email unless FOUNDER_DIGEST_EMAIL is set, in
    // which case the single-deliverable founder address wins (Resend's free
    // testing tier 403s anything but the founder's verified inbox - see
    // CLAUDE.md's email/DIGEST notes).
    const digestTo =
      (process.env.FOUNDER_DIGEST_EMAIL || (owner.email as string | null)) ?? null;
    if (digestTo) {
      const sendResult = await sendDailyQuizDigestEmail(digestTo, {
        dateLabel: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        generated: entries,
        skippedCount: results.skippedPaused + results.skippedAlready + results.skippedNoHistory,
        failedCount: results.failed,
        brandName: resolveBranding(owner).name,
      });
      if (sendResult) results.digestsSent++;
      else console.error(`Failed to send daily digest to ${digestTo}`);
    }
  }

  return NextResponse.json(results, { status: 200 });
}