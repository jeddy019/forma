import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { initialReview } from '@/lib/srs/engine';

// Phase B Wave 1 (B7): opt the (authenticated) student in to spaced review
// for a sub-skill. Authorizes in application code, same principle as the
// /student portal and /api/quiz/solution: never trust a client-asserted
// identity alone - the caller's verified Supabase Auth email must be on file
// for the student they claim to be. Writes go through the service-role client
// (students have no auth.uid() RLS can match, so RLS can't authorize them).
export const runtime = 'nodejs';

const SUB_SKILL_PATTERN = /^[a-z0-9-]{1,120}$/;
const MAX_LABEL = 120;
const MAX_TOPIC = 200;

interface TrackBody {
  studentId?: unknown;
  subSkill?: unknown;
  subSkillLabel?: unknown;
  topic?: unknown;
}

export async function POST(request: NextRequest) {
  let body: TrackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const studentId = typeof body.studentId === 'string' ? body.studentId : '';
  const subSkill = typeof body.subSkill === 'string' ? body.subSkill.trim() : '';
  const subSkillLabel = typeof body.subSkillLabel === 'string' ? body.subSkillLabel.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';

  if (!studentId || studentId.length > 64) {
    return NextResponse.json({ error: 'Invalid student.' }, { status: 400 });
  }
  if (!SUB_SKILL_PATTERN.test(subSkill)) {
    return NextResponse.json({ error: 'Invalid sub-skill.' }, { status: 400 });
  }
  if (!subSkillLabel || subSkillLabel.length > MAX_LABEL) {
    return NextResponse.json({ error: 'Invalid sub-skill name.' }, { status: 400 });
  }
  if (topic.length > MAX_TOPIC) {
    return NextResponse.json({ error: 'Invalid topic.' }, { status: 400 });
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

  // Authorization: the verified auth email must be on this student's profile.
  if (!student) {
    return NextResponse.json({ error: 'You can only track your own sub-skills.' }, { status: 403 });
  }

  const entry = initialReview(
    { studentId, subSkill, subSkillLabel, topic: topic || null },
    new Date()
  );

  const { error } = await admin.from('review_schedule').upsert(
    {
      student_id: studentId,
      sub_skill: subSkill,
      sub_skill_label: subSkillLabel,
      topic: entry.topic,
      next_review_at: entry.nextReviewAt,
      interval_days: entry.intervalDays,
      ladder_step: entry.ladderStep,
      last_reviewed_at: entry.lastReviewedAt,
    },
    { onConflict: 'student_id,sub_skill' }
  );

  if (error) {
    return NextResponse.json({ error: 'Could not start tracking - please try again.' }, { status: 500 });
  }

  return NextResponse.json({ tracked: true }, { status: 200 });
}
