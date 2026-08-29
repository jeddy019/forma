'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { COUNTRIES, SUBJECTS, EXAM_BOARDS_BY_COUNTRY, type Country, type Subject } from '@/lib/constants';

// Security Rule 4: reject student name over 100 characters, server side.
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 200;
// Deliberately simple (not RFC 5322) - this only needs to catch obvious
// typos before Resend's own delivery attempt does, not be a full validator.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface StudentFormResult {
  error?: string;
  success?: boolean;
}

interface ParsedStudentForm {
  error?: string;
  values?: {
    name: string;
    country: string;
    curriculumLevel: string;
    yearLevel: string;
    examBoard: string;
    email: string;
    parentEmail: string;
    weaknesses: string;
    subjects: string[];
  };
}

// Shared by create and update so both enforce identical rules. The error
// strings match what the create form already surfaced - same limits, same
// wording, one source of truth for the fields the two forms have in common.
function parseStudentForm(formData: FormData): ParsedStudentForm {
  const name = String(formData.get('name') ?? '').trim();
  const country = String(formData.get('country') ?? '');
  const curriculumLevel = String(formData.get('curriculumLevel') ?? '').trim();
  const yearLevel = String(formData.get('yearLevel') ?? '').trim();
  const examBoard = String(formData.get('examBoard') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const parentEmail = String(formData.get('parentEmail') ?? '').trim();
  const weaknesses = String(formData.get('weaknesses') ?? '').trim();
  const subjects = formData.getAll('subjects').map(String);

  if (!name) {
    return { error: 'Student name is required.' };
  }
  if (name.length > NAME_MAX_LENGTH) {
    return { error: `Student name must be ${NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (!COUNTRIES.includes(country as Country)) {
    return { error: 'Please select a valid country.' };
  }
  if (!curriculumLevel) {
    return { error: 'Please select a curriculum level.' };
  }
  if (!yearLevel) {
    return { error: 'Please enter a year or grade.' };
  }
  // B67 exam board: optional, but if a board is supplied it must be one that
  // actually belongs to the selected country (SAT on an England student is
  // nonsense). The empty string (no board) is always allowed.
  if (examBoard && !(EXAM_BOARDS_BY_COUNTRY[country as Country] as readonly string[]).includes(examBoard)) {
    return { error: 'Please select a valid exam board for this country.' };
  }
  // Optional - see CLAUDE.md's Student Accounts and Data Processor Status.
  if (email && (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email))) {
    return { error: 'Please enter a valid email address, or leave it blank.' };
  }
  // Also optional - only shown/meaningful for tutor accounts (see
  // add-parent-email.sql's own comment on why this is a separate field
  // from the student's own optional email above).
  if (parentEmail && (parentEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(parentEmail))) {
    return { error: 'Please enter a valid parent email address, or leave it blank.' };
  }

  const validSubjects = subjects.filter((subject): subject is Subject =>
    (SUBJECTS as readonly string[]).includes(subject)
  );

  return {
    values: { name, country, curriculumLevel, yearLevel, examBoard, email, parentEmail, weaknesses, subjects: validSubjects },
  };
}

export async function createStudentAction(
  _prevState: StudentFormResult,
  formData: FormData
): Promise<StudentFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to add a student.' };
  }

  const parsed = parseStudentForm(formData);
  if (parsed.error || !parsed.values) {
    return { error: parsed.error };
  }
  const { name, country, curriculumLevel, yearLevel, examBoard, email, parentEmail, weaknesses, subjects } =
    parsed.values;

  const { error: insertError } = await supabase.from('student_profiles').insert({
    owner_id: user.id,
    name,
    country,
    curriculum_level: curriculumLevel,
    year_level: yearLevel,
    exam_board: examBoard || null,
    subjects: subjects,
    email: email || null,
    parent_email: parentEmail || null,
    weaknesses: weaknesses || null,
  });

  if (insertError) {
    console.error('Failed to create student profile', insertError);
    return { error: 'Could not save this student profile - please try again.' };
  }

  revalidatePath('/dashboard/students');
  return { success: true };
}

export async function updateStudentAction(
  studentId: string,
  _prevState: StudentFormResult,
  formData: FormData
): Promise<StudentFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to edit a student.' };
  }

  // RLS (profiles_own: auth.uid() = owner_id) means this select returns no
  // row for a studentId belonging to someone else, so "not found" quietly
  // covers "isn't yours" without distinguishing them - same as the page.
  const { data: existing } = await supabase
    .from('student_profiles')
    .select('id')
    .eq('id', studentId)
    .eq('owner_id', user.id)
    .single();

  if (!existing) {
    return { error: 'Student not found.' };
  }

  const parsed = parseStudentForm(formData);
  if (parsed.error || !parsed.values) {
    return { error: parsed.error };
  }
  const { name, country, curriculumLevel, yearLevel, examBoard, email, parentEmail, weaknesses, subjects } =
    parsed.values;

  const { error: updateError } = await supabase
    .from('student_profiles')
    .update({
      name,
      country,
      curriculum_level: curriculumLevel,
      year_level: yearLevel,
      exam_board: examBoard || null,
      subjects: subjects,
      email: email || null,
      parent_email: parentEmail || null,
      weaknesses: weaknesses || null,
    })
    .eq('id', studentId);

  if (updateError) {
    console.error('Failed to update student profile', updateError);
    return { error: 'Could not save this student profile - please try again.' };
  }

  revalidatePath('/dashboard/students');
  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}