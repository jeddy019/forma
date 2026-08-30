import type { SupabaseClient } from '@supabase/supabase-js';

// Founder-model family resolution: given one or more student ids, return the
// parent email of the family each student belongs to. The parent_email lives
// ONLY on families (see W4/W5 family billing) - a student's row no longer
// carries one, so every founder-facing workflow that emails a parent (daily
// quiz ready, manual generation, weekly report, parent report) resolves it
// here instead of reading a student column.
//
// RLS note: family_members_own requires BOTH the family and the student to
// be owned by the caller, which is exactly the founder's case (one tutor owns
// every family and student). The admin client also works. Either client's
// Supabase instance satisfies the structural type below.
interface FamilyMemberRow {
  student_id: string;
  family: { parent_email: string | null } | null;
}

export interface ResolveStudentFamilyEmailsResult {
  // student_id -> the family's parent_email when the student is in a family
  // WITH an email set; null when unassigned, or their family has no email.
  emails: Map<string, string>;
  // summary for logging/action drill-downs: how many lacked a resolvable one.
  missing: number;
}

export async function resolveStudentFamilyEmails(
  db: SupabaseClient,
  studentIds: string[]
): Promise<ResolveStudentFamilyEmailsResult> {
  const emails = new Map<string, string>();
  if (studentIds.length === 0) return { emails, missing: 0 };

  // One round trip for the whole batch, whatever inner fan-out the UI group
  // needs - never N+1 family lookups per student.
  const { data } = await db
    .from('family_members')
    .select('student_id, family:families(parent_email)')
    .in('student_id', studentIds);

  for (const row of (data as FamilyMemberRow[] | null) ?? []) {
    const parentEmail = row.family?.parent_email;
    if (parentEmail) {
      emails.set(row.student_id, parentEmail);
    }
  }
  // Every student without a resolved email counts as missing - either their
  // family has no email set, or they are not in a family at all yet.
  return { emails, missing: studentIds.length - emails.size };
}