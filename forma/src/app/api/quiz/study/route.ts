export const runtime = 'nodejs';
export const maxDuration = 60;

// Phase B Wave 1 (B11): smart learning "Study now". Authenticates the logged-in
// student (verified auth email must match student_profiles.email - same pattern
// as the /student portal and /api/srs/track, never a client-asserted identity)
// and generates a short focused quiz on the recommended sub-skill: a topic due
// for spaced review if one exists, otherwise the student's lowest-mastery
// sub-skill. The caller may also pass an explicit target. The owning tutor's
// profile is resolved server-side for ownership + free-tier + email.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQuiz, TrackedError, type GenerateQuizProfile, type RePracticeTarget } from '@/lib/quiz/generateQuiz';
import { toMasteryBarsAggregated } from '@/lib/mastery/masteryView';
import { slugifySubSkill } from '@/lib/subSkill/slugifySubSkill';
import type { SkillMap } from '@/lib/mastery/types';
import type { Country } from '@/lib/constants';

const MAX_LABEL = 120;

interface StudyBody {
  target?: { subSkill?: unknown; label?: unknown } | null;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string | null;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  owner_id: string | null;
  skill_map: SkillMap | null;
  exam_board: string | null;
}

interface ReviewScheduleRow {
  student_id: string;
  sub_skill: string;
  sub_skill_label: string;
  next_review_at: string;
}

interface UserRow {
  email: string | null;
  plan: string | null;
  plan_expires_at: string | null;
  paper_size: string | null;
  brand_name: string | null;
  brand_accent: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in as a student.' }, { status: 401 });
  }

  let body: StudyBody = {};
  try {
    body = (await request.json()) as StudyBody;
  } catch {
    // no body is fine - auto-recommend
  }

  const admin = createAdminClient();
  const { data: matched } = await admin
    .from('student_profiles')
    .select('id, name, email, country, curriculum_level, year_level, subjects, owner_id, skill_map, exam_board')
    .ilike('email', user.email)
    .returns<ProfileRow[]>();

  const profiles = (matched ?? []).filter((p) => p.owner_id);
  if (profiles.length === 0) {
    return NextResponse.json({ error: 'No student profile found for this account.' }, { status: 404 });
  }

  // --- Resolve the target sub-skill ---
  let target: RePracticeTarget | null = null;
  const explicit = body.target;
  if (explicit && typeof explicit.subSkill === 'string' && explicit.subSkill.trim().length > 0) {
    const subSkill = explicit.subSkill.trim().slice(0, MAX_LABEL);
    const label = typeof explicit.label === 'string' && explicit.label.trim() ? explicit.label.trim().slice(0, MAX_LABEL) : subSkill;
    target = { subSkill, label };
  } else {
    // 1) A topic due for spaced review, if any (earliest next_review_at).
    const studentIds = profiles.map((p) => p.id);
    const { data: reviews } = await admin
      .from('review_schedule')
      .select('student_id, sub_skill, sub_skill_label, next_review_at')
      .in('student_id', studentIds)
      .order('next_review_at', { ascending: true })
      .limit(20)
      .returns<ReviewScheduleRow[]>();

    const soonest = (reviews ?? [])[0];
    if (soonest?.sub_skill_label) {
      target = { subSkill: soonest.sub_skill_label, label: soonest.sub_skill_label };
    } else {
      // 2) Lowest-mastery sub-skill across the matched profiles.
      const bars = toMasteryBarsAggregated(profiles.map((p) => p.skill_map));
      // toMasteryBars sorts mastered -> weak, so the last bar is the weakest.
      const weakest = bars.length > 0 ? bars[bars.length - 1] : null;
      if (weakest?.subSkill) {
        target = { subSkill: weakest.subSkill, label: weakest.subSkill };
      }
    }
  }

  if (!target) {
    return NextResponse.json({ error: 'No topics to study yet - complete a worksheet first.' }, { status: 409 });
  }

  // --- Resolve which matched profile owns this sub-skill (for owner info) ---
  const targetKey = slugifySubSkill(target.subSkill);
  const owningProfile = profiles.find((p) => p.skill_map && targetKey in p.skill_map) ?? profiles[0];

  const { data: owner } = await admin
    .from('users')
    .select('email, plan, plan_expires_at, paper_size, brand_name, brand_accent')
    .eq('id', owningProfile.owner_id)
    .single<UserRow>();

  const quizProfile: GenerateQuizProfile = {
    id: owningProfile.id,
    name: owningProfile.name,
    email: owningProfile.email,
    country: owningProfile.country,
    curriculum_level: owningProfile.curriculum_level,
    year_level: owningProfile.year_level,
    subjects: owningProfile.subjects,
    exam_board: owningProfile.exam_board ?? null,
  };

  let inserted;
  try {
    inserted = await generateQuiz({
      profile: quizProfile,
      ownerId: owningProfile.owner_id!,
      owner: {
        email: owner?.email ?? null,
        paper_size: owner?.paper_size ?? 'a4',
        plan: owner?.plan ?? null,
        plan_expires_at: owner?.plan_expires_at ?? null,
        brand_name: owner?.brand_name ?? null,
        brand_accent: owner?.brand_accent ?? null,
      },
      focusSubSkills: [target],
      generatedFrom: 'study',
    });
  } catch (error) {
    if (error instanceof TrackedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Quiz generation failed - please try again.' }, { status: 500 });
  }

  return NextResponse.json({ quiz: inserted, target }, { status: 201 });
}
