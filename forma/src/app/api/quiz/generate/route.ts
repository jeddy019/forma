export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuiz, TrackedError, type GenerateQuizProfile } from '@/lib/quiz/generateQuiz';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { selectFundamentalsTarget } from '@/lib/mastery/selectFundamentalsTarget';
import { clearFundamentalsFlag } from '@/lib/mastery/clearFundamentalsFlag';
import type { SkillMap } from '@/lib/mastery/types';
import type { Country } from '@/lib/constants';

const TOPIC_MAX_LENGTH = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface GenerateQuizRequestBody {
  studentId?: string;
  topicPrompt?: string;
}

interface OwnerRow {
  email: string | null;
  plan: string | null;
  plan_expires_at: string | null;
  paper_size: string | null;
  brand_name: string | null;
  brand_accent: string | null;
}

interface StudentProfileRow {
  id: string;
  name: string;
  email: string | null;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  skill_map: SkillMap | null;
  exam_board: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: GenerateQuizRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { studentId, topicPrompt } = body;
  if (!studentId || !UUID_PATTERN.test(studentId)) {
    return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
  }
  if (!topicPrompt || typeof topicPrompt !== 'string' || topicPrompt.trim().length === 0) {
    return NextResponse.json({ error: 'topicPrompt is required.' }, { status: 400 });
  }
  if (topicPrompt.length > TOPIC_MAX_LENGTH) {
    return NextResponse.json({ error: `topicPrompt must be ${TOPIC_MAX_LENGTH} characters or fewer.` }, { status: 400 });
  }
  const sanitizedTopic = stripHtmlTags(topicPrompt).trim();

  const { data: ownerRow } = await supabase.from('users').select('email, plan, plan_expires_at, paper_size, brand_name, brand_accent').eq('id', user.id).single<OwnerRow>();

  const { data: student, error: studentError } = await supabase
    .from('student_profiles')
    .select('id, name, email, country, curriculum_level, year_level, subjects, skill_map, exam_board')
    .eq('id', studentId)
    .single<StudentProfileRow>();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
  }

  const { data: latestNote } = await supabase
    .from('session_notes')
    .select('content')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ content: string }>();

  const fundamentalsTarget = selectFundamentalsTarget(student.skill_map ?? {});

  const profile: GenerateQuizProfile = {
    id: student.id,
    name: student.name,
    email: student.email,
    country: student.country,
    curriculum_level: student.curriculum_level,
    year_level: student.year_level,
    subjects: student.subjects,
    exam_board: student.exam_board ?? null,
  };

  let inserted;
  try {
    inserted = await generateQuiz({
      profile,
      ownerId: user.id,
      owner: {
        email: ownerRow?.email ?? null,
        paper_size: ownerRow?.paper_size ?? 'a4',
        plan: ownerRow?.plan ?? null,
        plan_expires_at: ownerRow?.plan_expires_at ?? null,
        brand_name: ownerRow?.brand_name ?? null,
        brand_accent: ownerRow?.brand_accent ?? null,
      },
      topicPrompt: sanitizedTopic,
      fundamentalsTarget,
      sessionNotes: latestNote?.content ?? 'none',
      generatedFrom: 'quiz',
    });
  } catch (error) {
    if (error instanceof TrackedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Quiz generation failed - please try again.' }, { status: 500 });
  }

  if (fundamentalsTarget) {
    try {
      await supabase
        .from('student_profiles')
        .update({ skill_map: clearFundamentalsFlag(student.skill_map ?? {}, fundamentalsTarget.subSkill) })
        .eq('id', studentId);
    } catch (error) {
      console.error('Failed to clear fundamentals flag', error);
    }
  }

  return NextResponse.json({ quiz: inserted }, { status: 201 });
}
