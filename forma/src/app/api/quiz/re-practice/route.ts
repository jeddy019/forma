export const runtime = 'nodejs';
export const maxDuration = 60;

// Phase B Wave 1 (B10): wrong-answer re-practice. A public route invoked from
// the quiz review phase ("Re-practice wrong answers") - the student who just
// took a quiz may well be anonymous, so unlike /api/quiz/generate this does
// NOT require a session. Security stays intact because:
//   - The target sub-skills are the student's OWN wrong sub-skills, which they
//     already know (the review phase shows which answers were "Not quite").
//   - The generation context (student profile + tutor owner) is resolved
//     SERVER-SIDE from the worksheet's stored student_id - never from a
//     client-supplied student id, the same "never trust client-asserted
//     identity" principle as /api/submit.
//   - Only the newly generated quiz's code is returned; a new worksheet is
//     inserted (counted toward the owner's free tier via the shared core).
//   - No mark scheme is ever returned.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQuiz, TrackedError, type GenerateQuizProfile, type RePracticeTarget } from '@/lib/quiz/generateQuiz';
import type { Country } from '@/lib/constants';

const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const MAX_TARGETS = 12;
const SUB_SKILL_MAX = 120;

interface RePracticeRequestBody {
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
  email: string | null;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  owner_id: string | null;
}

interface UserRow {
  email: string | null;
  plan: string | null;
  plan_expires_at: string | null;
  paper_size: string | null;
}

export async function POST(request: NextRequest) {
  let body: RePracticeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { digitalCode, wrongSubSkills } = body;
  if (!digitalCode || !DIGITAL_CODE_PATTERN.test(digitalCode)) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 400 });
  }
  if (!Array.isArray(wrongSubSkills) || wrongSubSkills.length === 0 || wrongSubSkills.length > MAX_TARGETS) {
    return NextResponse.json({ error: 'No wrong answers to re-practice.' }, { status: 400 });
  }
  const targets: RePracticeTarget[] = wrongSubSkills
    .map((t) => ({
      subSkill: typeof t?.subSkill === 'string' ? t.subSkill.trim() : '',
      label: typeof t?.label === 'string' ? t.label.trim() : '',
    }))
    .filter((t) => t.subSkill.length > 0 && t.subSkill.length <= SUB_SKILL_MAX);

  if (targets.length === 0) {
    return NextResponse.json({ error: 'No wrong answers to re-practice.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve the generating context from the worksheet's stored student_id -
  // never from the client. This fixes the localisation seam too: the student's
  // real country/curriculum/year live on their profile, which an anonymous
  // re-practiser couldn't supply honestly on their own.
  const { data: worksheet } = await admin
    .from('worksheets')
    .select('student_id, owner_id')
    .eq('digital_code', digitalCode)
    .single<WorksheetRow>();

  if (!worksheet?.student_id || !worksheet.owner_id) {
    return NextResponse.json({ error: 'This worksheet has no linked student to re-practice for.' }, { status: 404 });
  }

  const { data: profile } = await admin
    .from('student_profiles')
    .select('id, name, email, country, curriculum_level, year_level, subjects, owner_id')
    .eq('id', worksheet.student_id)
    .single<ProfileRow>();

  if (!profile?.id || !profile.owner_id) {
    return NextResponse.json({ error: 'This worksheet has no linked student to re-practice for.' }, { status: 404 });
  }

  const { data: owner } = await admin
    .from('users')
    .select('email, plan, plan_expires_at, paper_size')
    .eq('id', profile.owner_id)
    .single<UserRow>();

  const quizProfile: GenerateQuizProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    country: profile.country,
    curriculum_level: profile.curriculum_level,
    year_level: profile.year_level,
    subjects: profile.subjects,
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
      },
      focusSubSkills: targets,
      generatedFrom: 're-practice',
    });
  } catch (error) {
    if (error instanceof TrackedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Quiz generation failed - please try again.' }, { status: 500 });
  }

  return NextResponse.json({ quiz: inserted }, { status: 201 });
}
