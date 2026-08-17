import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
}

// Legal Requirements: "Data deletion on request from settings page" and the
// 24-month inactive-account policy (Phase 6's delete-inactive-accounts
// cron) both need exactly this same cascade - extracted here so the two
// callers (a user-initiated settings action, and an automated cron)
// can't drift apart on what "delete an account" actually means. Deletes
// in FK-dependency order (not every table cascades automatically - see
// the Database Schema section) rather than relying on cascade behaviour
// that isn't uniformly configured across every table.
export async function deleteUserAccount(admin: AdminClient, userId: string): Promise<DeleteAccountResult> {
  const { data: students } = await admin.from('student_profiles').select('id').eq('owner_id', userId);
  for (const student of students ?? []) {
    await admin.from('submissions').delete().eq('student_id', student.id);
    await admin.from('worksheets').delete().eq('student_id', student.id);
    await admin.from('schedules').delete().eq('student_id', student.id);
    await admin.from('session_notes').delete().eq('student_id', student.id);
  }
  await admin.from('student_profiles').delete().eq('owner_id', userId);
  await admin.from('session_notes').delete().eq('tutor_id', userId);
  await admin.from('templates').delete().eq('tutor_id', userId);
  await admin.from('usage_log').delete().eq('user_id', userId);

  const { error: deleteUserRowError } = await admin.from('users').delete().eq('id', userId);
  if (deleteUserRowError) {
    console.error('Failed to delete user row', deleteUserRowError);
    return { success: false, error: `Failed to delete user row: ${deleteUserRowError.message}` };
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    console.error('Failed to delete auth user', deleteAuthError);
    return { success: false, error: `User data deleted, but auth user removal failed: ${deleteAuthError.message}` };
  }

  return { success: true };
}
