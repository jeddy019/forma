import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scheduleNextReview } from '@/lib/srs/engine';
import type { ReviewEntry } from '@/lib/srs/engine';

// Phase B Wave 1 (B7): record the outcome of a spaced-repetition review.
// Pass → advance up the 1/3/7/14/30 ladder; fail → reset to day 1 (RETURN TO
// FUNDAMENTALS re-secures basics before spacing back out). Authorizes by the
// caller's verified email matching the student's profile (never trust the
// client-asserted studentId alone), same as /api/srs/track.
export const runtime = 'nodejs';

const SUB_SKILL_PATTERN = /^[a-z0-9-]{1,120}$/;

interface ReviewedBody {
  studentId?: unknown;
  subSkill?: unknown;
  passed?: unknown;
}

interface ReviewScheduleRow {
  id: string;
  sub_skill: string;
  sub_skill_label: string;
  topic: string | null;
  next_review_at: string;
  interval_days: number;
  ladder_step: number;
  last_reviewed_at: string | null;
}

export async function POST(request: NextRequest) {
  let body: ReviewedBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const studentId = typeof body.studentId === 'string' ? body.studentId : '';
  const subSkill = typeof body.subSkill === 'string' ? body.subSkill.trim() : '';
  const passed = body.passed === true;

  if (!studentId || studentId.length > 64) {
    return NextResponse.json({ error: 'Invalid student.' }, { status: 400 });
  }
  if (!SUB_SKILL_PATTERN.test(subSkill)) {
    return NextResponse.json({ error: 'Invalid sub-skill.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in as a student.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from('student_profiles')
    .select('id, email')
    .eq('id', studentId)
    .ilike('email', user.email)
    .maybeSingle<{ id: string; email: string | null }>();

  if (!student) {
    return NextResponse.json({ error: 'You can only review your own sub-skills.' }, { status: 403 });
  }

  const { data: schedule } = await admin
    .from('review_schedule')
    .select('id, sub_skill, sub_skill_label, topic, next_review_at, interval_days, ladder_step, last_reviewed_at')
    .eq('student_id', studentId)
    .eq('sub_skill', subSkill)
    .maybeSingle<ReviewScheduleRow>();

  if (!schedule) {
    return NextResponse.json({ error: 'This sub-skill is not being tracked.' }, { status: 404 });
  }

  const entry: ReviewEntry = {
    studentId,
    subSkill: schedule.sub_skill,
    subSkillLabel: schedule.sub_skill_label,
    topic: schedule.topic,
    nextReviewAt: schedule.next_review_at,
    intervalDays: schedule.interval_days,
    ladderStep: schedule.ladder_step,
    lastReviewedAt: schedule.last_reviewed_at,
  };

  const next = scheduleNextReview(entry, passed, new Date());

  const { error } = await admin
    .from('review_schedule')
    .update({
      next_review_at: next.nextReviewAt,
      interval_days: next.intervalDays,
      ladder_step: next.ladderStep,
      last_reviewed_at: next.lastReviewedAt,
    })
    .eq('id', schedule.id);

  if (error) {
    return NextResponse.json({ error: 'Could not record the review - please try again.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      nextReviewAt: next.nextReviewAt,
      intervalDays: next.intervalDays,
      ladderStep: next.ladderStep,
    },
    { status: 200 }
  );
}
