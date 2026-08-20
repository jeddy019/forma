'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { COUNTRIES, SUBJECTS, type Country, type Subject } from '@/lib/constants';

// Security Rule 4: reject student name over 100 characters, server side.
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 200;
// Deliberately simple (not RFC 5322) - this only needs to catch obvious
// typos before Resend's own delivery attempt does, not be a full validator.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateStudentResult {
  error?: string;
}

export async function createStudentAction(
  _prevState: CreateStudentResult,
  formData: FormData
): Promise<CreateStudentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to add a student.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const country = String(formData.get('country') ?? '');
  const curriculumLevel = String(formData.get('curriculumLevel') ?? '').trim();
  const yearLevel = String(formData.get('yearLevel') ?? '').trim();
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

  const { error: insertError } = await supabase.from('student_profiles').insert({
    owner_id: user.id,
    name,
    country,
    curriculum_level: curriculumLevel,
    year_level: yearLevel,
    subjects: validSubjects,
    email: email || null,
    parent_email: parentEmail || null,
    weaknesses: weaknesses || null,
  });

  if (insertError) {
    console.error('Failed to create student profile', insertError);
    return { error: 'Could not save this student profile - please try again.' };
  }

  revalidatePath('/dashboard/students');
  return {};
}
