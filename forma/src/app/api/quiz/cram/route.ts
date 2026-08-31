export const runtime = 'nodejs';
export const maxDuration = 60;

// Phase B Wave 5 (B75): CRAM MODE - exam-week focused practice. A public
// route (the student who just took a quiz may be anonymous, same security
// model as B10 re-practice): resolves the student + tutor owner SERVER-SIDE
// from the worksheet's stored student_id, never from a client-asserted
// identity, and returns only the new quiz's code.
//
// Board: 20 mixed core questions (all-core typeOrder, no warm-up, no
// challenge - high intensity), drawn from the student's WEAKEST sub-skills.
// Weak sub-skills come from the student's own skill_map via toMasteryBars
// (sort mastered -> weak, so the last bars are the needs-work ones) - the
// richer, cross-topic source - falling back to the current quiz's wrong
// sub-skills when the map has no weak entries to draw from. The player runs
// a visible countdown timer (see /q/[code]/QuizForm + page), and the quiz
// is gated on the owner's entitlement like every other paid feature
// (dormant always-true via isActivePro under de-pro).
//
// No mark scheme is ever returned; a new worksheet row is inserted (counted
// toward the owner's quota via the shared core).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQuiz, TrackedError, type GenerateQuizProfile, type RePracticeTarget } from '@/lib/quiz/generateQuiz';
import { toMasteryBars } from '@/lib/mastery/masteryView';
import { CRAM_QUESTION_COUNT } from '@/lib/quiz/cram';
import type { SkillMap } from '@/lib/mastery/types';
import type { Country } from '@/lib/constants';

const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const MAX_TARGETS = 12;
const SUB_SKILL_MAX = 120;
// The weakest end of the mastery bars to draw a mixed board from.
const MAX_WEAK_BARS = 6;
const MIN_BARS_FOR_FALLBACK = 2;

interface CramRequestBody {
  digitalCode?: string;
  wrongSubSkills?: RePracticeTarget[];
}

interface WorksheetRow {
  student_id: string | null;
  owner_id: string | null;
}

interface ProfileRow {
  id: string;
  name: string;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  owner_id: string | null;
  exam_board: string | null;
  skill_map: SkillMap | null;
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
  let body: CramRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { digitalCode, wrongSubSkills } = body;
  if (!digitalCode || !DIGITAL_CODE_PATTERN.test(digitalCode)) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve the generating context from the worksheet's stored student_id,
  // never from the client (same rule as B10 re-practice).
  const { data: worksheet } = await admin
    .from('worksheets')
    .select('student_id, owner_id')
    .eq('digital_code', digitalCode)
    .single<WorksheetRow>();

  if (!worksheet?.student_id || !worksheet.owner_id) {
    return NextResponse.json({ error: 'This quiz has no linked student for cram practice.' }, { status: 404 });
  }

  const { data: profile } = await admin
    .from('student_profiles')
    .select('id, name, country, curriculum_level, year_level, subjects, owner_id, exam_board, skill_map')
    .eq('id', worksheet.student_id)
    .single<ProfileRow>();

  if (!profile?.id || !profile.owner_id) {
    return NextResponse.json({ error: 'This quiz has no linked student for cram practice.' }, { status: 404 });
  }

  // Build the weak sub-skill board. Primary source: the student's own mastery
  // map (cross-topic needs-work sub-skills). Fall back to the current quiz's
  // wrong sub-skills when the map offers nothing to draw from.
  let targets: RePracticeTarget[] = [];
  const bars = toMasteryBars(profile.skill_map);
  if (bars.length > 0) {
    const weakest = bars
      .slice(-MAX_WEAK_BARS)
      .filter((b) => b.level !== 'mastered')
      .map((b) => ({ subSkill: b.subSkill, label: b.subSkill }))
      .filter((t) => t.subSkill.length > 0 && t.subSkill.length <= SUB_SKILL_MAX);
    if (weakest.length >= MIN_BARS_FOR_FALLBACK) {
      targets = weakest;
    }
  }

  if (targets.length === 0) {
    const wrong = (wrongSubSkills ?? [])
      .map((t) => ({
        subSkill: typeof t?.subSkill === 'string' ? t.subSkill.trim() : '',
        label: typeof t?.label === 'string' ? t.label.trim() : '',
      }))
      .filter((t) => t.subSkill.length > 0 && t.subSkill.length <= SUB_SKILL_MAX)
      .slice(0, MAX_TARGETS);
    if (wrong.length === 0) {
      return NextResponse.json(
        { error: 'No weak sub-skills to cram on yet - complete a few quizzes first.' },
        { status: 409 }
      );
    }
    targets = wrong;
  }

  const { data: owner } = await admin
    .from('users')
    .select('email, plan, plan_expires_at, paper_size, brand_name, brand_accent')
    .eq('id', profile.owner_id)
    .single<UserRow>();

  const quizProfile: GenerateQuizProfile = {
    id: profile.id,
    name: profile.name,
    country: profile.country,
    curriculum_level: profile.curriculum_level,
    year_level: profile.year_level,
    subjects: profile.subjects,
    exam_board: profile.exam_board ?? null,
  };

  let inserted;
  try {
    inserted = await generateQuiz({
      profile: quizProfile,
      ownerId: profile.owner_id,
      owner: {
        email: owner?.email ?? null,
        paper_size: owner?.paper_size ?? 'a4',
        plan: owner?.plan ?? null,
        plan_expires_at: owner?.plan_expires_at ?? null,
        brand_name: owner?.brand_name ?? null,
        brand_accent: owner?.brand_accent ?? null,
      },
      focusSubSkills: targets,
      questionCount: CRAM_QUESTION_COUNT,
      generatedFrom: 'cram',
      sendReadyEmail: false,
    });
  } catch (error) {
    if (error instanceof TrackedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Quiz generation failed - please try again.' }, { status: 500 });
  }

  return NextResponse.json({ quiz: inserted }, { status: 201 });
}
