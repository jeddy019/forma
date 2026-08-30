export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateWorksheet, buildWorksheetFromDeterministic } from '@/lib/ai/generateWorksheet';
import { buildUserPrompt } from '@/lib/ai/buildUserPrompt';
import { splitMarkScheme } from '@/lib/ai/splitMarkScheme';
import { resolveBranding } from '@/lib/branding';
import { generateDigitalCode } from '@/lib/utils/digitalCode';
import { sendWeeklyDeliveryEmail, sendScheduleFailedEmail } from '@/lib/email/send';
import { resolveStudentFamilyEmails } from '@/lib/families/parentEmail';
import { isDueNow } from '@/lib/schedule/isDueNow';
import { isActivePro } from '@/lib/payments/planStatus';
import { callMathEngine, matchMathEngineTopic } from '@/lib/ai/mathEngineClient';
import type { Country } from '@/lib/constants';

// Automated Schedule Logic (CLAUDE.md): runs every 30 minutes (vercel.json's
// crons entry), protected by CRON_SECRET (Routing Structure).
//
// "Retry once after 10 minutes" (Technical Challenge 7) is implemented here
// as an immediate retry within the same invocation, not a literal 10-minute
// delay - Tech Stack lists no queue service, and this project's only
// scheduling primitive is Vercel Cron itself, which can't re-invoke a
// single route 10 minutes later without either blocking this function for
// 10 minutes (bad - see Performance Rules) or adding a second cron entry
// and cross-invocation state to track pending retries (real added
// complexity for a timing nuance). This satisfies the actual load-bearing
// requirements - process each schedule independently, retry once, email
// the owner on second failure, never silently skip - documented as a
// deliberate simplification of the timing, not a missed requirement.
// Also not yet handled: a schedule that fails on every single cron tick
// (e.g. a persistently invalid API key) would email its owner again every
// 30 minutes until fixed - there's no "already notified, don't repeat"
// suppression. Flagging rather than pretending this is solved; revisit
// with a last_failure_notified_at column if it becomes a real problem.
const GENERATION_TIMEOUT_MS = 30_000;
const DIGITAL_CODE_UNIQUE_VIOLATION = '23505';
const MAX_INSERT_ATTEMPTS = 3;

type AdminClient = ReturnType<typeof createAdminClient>;

interface ScheduleRow {
  id: string;
  owner_id: string;
  student_id: string;
  subject: string;
  topics: string[] | null;
  difficulty: string;
  day_of_week: number;
  delivery_hour: number;
  delivery_timezone: string;
  last_generated_at: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  exam_board: string | null;
}

async function generateAndDeliver(schedule: ScheduleRow, admin: AdminClient): Promise<void> {
  const { data: student } = await admin
    .from('student_profiles')
    .select('id, name, country, curriculum_level, year_level, subjects, exam_board')
    .eq('id', schedule.student_id)
    .single<StudentRow>();
  if (!student) throw new Error(`Student ${schedule.student_id} not found`);

  // Step 4 of Automated Schedule Logic: "fetch student profile and latest
  // session_notes" - Phase 6 Steps 33-34 built the input UI and wired the
  // same query into /api/generate; this route's own copy (written ahead
  // of that UI existing) needed no change now that real rows exist.
  const { data: latestNote } = await admin
    .from('session_notes')
    .select('content')
    .eq('student_id', schedule.student_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const topicText = schedule.topics && schedule.topics.length > 0 ? schedule.topics.join(', ') : `General ${schedule.subject} practice`;
  // buildUserPrompt has no dedicated difficulty parameter - manual
  // generation doesn't pass one either (that's Adaptive Difficulty, Step
  // 23, still unbuilt). Folded into the topic text itself so the value the
  // schedule actually stores isn't silently discarded.
  const topicPrompt = `${topicText}. Target difficulty: ${schedule.difficulty}.`;

  const userPrompt = buildUserPrompt({
    studentName: student.name,
    country: student.country,
    curriculumLevel: student.curriculum_level,
    yearLevel: student.year_level,
    subjectHint: student.subjects ?? [],
    sessionNotes: latestNote?.content ?? 'none',
    topicPrompt,
    examBoard: student.exam_board ?? undefined,
  });

  // --- Deterministic routing (Phase 10) ---
  // Same pattern as /api/generate/route.ts. Scheduled worksheets are always
  // 10 questions. The schedule stores the subject, which gives us a head
  // start on routing — but we still check the topic text for maths engine
  // matches since the topics array is the real signal.
  let worksheet;
  const topicMatch = await matchMathEngineTopic(topicPrompt);
  if (topicMatch.is_deterministic && topicMatch.matched_keys.length > 0) {
    const engineResult = await callMathEngine({
      curriculum: student.curriculum_level,
      locale: student.country === 'canada_ontario' ? 'ontario' : student.country === 'united_states' ? 'us' : 'england',
      difficulty: student.curriculum_level.includes('A-Level') ? 'higher' : 'standard',
      year_level: student.year_level,
      topic: topicPrompt,
      question_count: 10,
    });

    if (engineResult && engineResult.questions.length === 10) {
      worksheet = buildWorksheetFromDeterministic(engineResult.questions, {
        subject: engineResult.subject,
        topic: engineResult.topic,
        curriculum: engineResult.curriculum,
        year_level: engineResult.year_level,
        difficulty: engineResult.difficulty_overall,
        alignment_note: engineResult.alignment_note,
      });
      console.log(`[deterministic] Routed scheduled ${topicPrompt} to maths engine (${topicMatch.matched_keys[0]}), 10 questions`);
    } else {
      console.log(`[deterministic] Engine returned ${engineResult?.questions?.length ?? 0}/10 questions, falling back to AI`);
    }
  }

  // --- AI fallback (existing path) ---
  if (!worksheet) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
    try {
      worksheet = await generateWorksheet(userPrompt, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  const { questionsJson, markSchemeJson } = splitMarkScheme(worksheet);

  const { data: ownerRow } = await admin.from('users').select('email, paper_size, brand_name, brand_accent').eq('id', schedule.owner_id).single();

  // digital_code is UNIQUE - same collision-retry pattern as /api/generate.
  let inserted: { id: string; digital_code: string } | null = null;
  let insertError: { code?: string; message: string } | null = null;
  for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
    const result = await admin
      .from('worksheets')
      .insert({
        owner_id: schedule.owner_id,
        student_id: schedule.student_id,
        prompt_used: topicPrompt,
        questions_json: questionsJson,
        mark_scheme_json: markSchemeJson,
        alignment_note: worksheet.alignment_note,
        digital_code: generateDigitalCode(),
        subject: worksheet.subject,
        topic: worksheet.topic,
        difficulty: worksheet.difficulty_overall,
        paper_size: ownerRow?.paper_size ?? 'a4',
        generated_from: 'scheduled',
      })
      .select('id, digital_code')
      .single();

    inserted = result.data;
    insertError = result.error;
    if (!insertError) break;
    if (insertError.code !== DIGITAL_CODE_UNIQUE_VIOLATION) break;
  }

  if (insertError || !inserted) {
    throw new Error(`Failed to store scheduled worksheet: ${insertError?.message ?? 'unknown error'}`);
  }

  await admin.from('schedules').update({ last_generated_at: new Date().toISOString() }).eq('id', schedule.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  // W8 Wave E (family-first, 2026-08-30): same recipient rule as every other
  // ready/summary send - family email first, owner fallback. EMAIL 3's
  // template and weekly scheduling semantics are unchanged.
  const { emails } = await resolveStudentFamilyEmails(admin, [student.id]);
  const recipientEmail = emails.get(student.id) ?? ownerRow?.email;
  if (recipientEmail) {
    await sendWeeklyDeliveryEmail(recipientEmail, {
      studentName: student.name,
      subject: worksheet.subject,
      topic: worksheet.topic,
      worksheetUrl: `${appUrl}/s/${inserted.digital_code}`,
      sentToStudentDirectly: false,
      manageScheduleUrl: `${appUrl}/dashboard/schedule`,
      portalUrl: `${appUrl}/student/login`,
      brandName: resolveBranding(ownerRow).name,
    });
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: schedules, error } = await admin
    .from('schedules')
    .select('id, owner_id, student_id, subject, topics, difficulty, day_of_week, delivery_hour, delivery_timezone, last_generated_at')
    .eq('is_paused', false)
    .or(`paused_until.is.null,paused_until.lt.${now.toISOString()}`)
    .returns<ScheduleRow[]>();

  if (error) {
    console.error('Failed to query schedules', error);
    return NextResponse.json({ error: 'Failed to query schedules' }, { status: 500 });
  }

  const dueOnSchedule = (schedules ?? []).filter((schedule) =>
    isDueNow(
      {
        dayOfWeek: schedule.day_of_week,
        deliveryHour: schedule.delivery_hour,
        deliveryTimezone: schedule.delivery_timezone,
        lastGeneratedAt: schedule.last_generated_at,
      },
      now
    )
  );

  // Automation is a paid feature (Permissions Summary) and schedule
  // creation is already gated on isActivePro (schedule/actions.ts), but a
  // schedule created while pro outlives its owner's subscription lapsing -
  // nothing else stops this cron from generating against it forever.
  // Batch-fetched once per run rather than per schedule (N+1), and a
  // lapsed owner is skipped, not treated as a failure - there's nothing
  // wrong to retry or notify about, the schedule just isn't active.
  const ownerIds = [...new Set(dueOnSchedule.map((s) => s.owner_id))];
  const { data: owners } = ownerIds.length
    ? await admin.from('users').select('id, plan, plan_expires_at').in('id', ownerIds)
    : { data: [] };
  const activeProOwnerIds = new Set((owners ?? []).filter((o) => isActivePro(o.plan, o.plan_expires_at)).map((o) => o.id));

  const dueSchedules = dueOnSchedule.filter((schedule) => activeProOwnerIds.has(schedule.owner_id));
  const skippedNotPro = dueOnSchedule.length - dueSchedules.length;
  const results = { processed: dueSchedules.length, succeeded: 0, failed: 0, skippedNotPro };

  // Technical Challenge 7: one failing schedule must never stop the others -
  // each gets its own try/catch and runs sequentially (not Promise.all), so
  // one slow or stuck generation can't starve the rest of this route's own
  // maxDuration budget in an unpredictable order.
  for (const schedule of dueSchedules) {
    try {
      await generateAndDeliver(schedule, admin);
      results.succeeded++;
      continue;
    } catch (firstError) {
      console.error(`Schedule ${schedule.id} failed (attempt 1)`, firstError);
    }

    try {
      await generateAndDeliver(schedule, admin);
      results.succeeded++;
      continue;
    } catch (secondError) {
      console.error(`Schedule ${schedule.id} failed (attempt 2)`, secondError);
      results.failed++;
    }

    const [{ data: student }, { data: owner }] = await Promise.all([
      admin.from('student_profiles').select('name').eq('id', schedule.student_id).single(),
      admin.from('users').select('email, brand_name, brand_accent').eq('id', schedule.owner_id).single(),
    ]);
    if (owner?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      await sendScheduleFailedEmail(owner.email, {
        studentName: student?.name ?? 'your student',
        subject: schedule.subject,
        scheduleUrl: `${appUrl}/dashboard/schedule`,
        brandName: resolveBranding(owner).name,
      });
    }
  }

  return NextResponse.json(results, { status: 200 });
}
