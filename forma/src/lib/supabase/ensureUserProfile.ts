import type { SupabaseClient } from '@supabase/supabase-js';

// Bridges a real gap: signUp() does not always return an active session (a
// Supabase project with email confirmation enabled returns no session until
// the user clicks the confirmation link), so the users row can't always be
// inserted at signup time - RLS requires auth.uid() = id, and there is no
// authenticated caller yet. role/region are instead carried on
// auth signUp's options.data (user_metadata), and this runs once per
// dashboard visit to create the row the first time an authenticated request
// actually arrives - covering both the immediate-session and
// confirm-later-then-log-in paths with one code path.
// Returns the user's role so callers (dashboard/layout.tsx) don't need a
// second round-trip just to read back what this function already fetched -
// the layout previously ran this existence check and then its own separate
// `.select('role')` query on every single dashboard page load.
export async function ensureUserProfile(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing } = await supabase.from('users').select('id, role').eq('id', userId).maybeSingle();
  if (existing) return existing.role ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : 'tutor';
  const region = typeof user.user_metadata?.region === 'string' ? user.user_metadata.region : 'england';
  const paperSize = region === 'united_states' ? 'letter' : 'a4';

  await supabase.from('users').insert({
    id: userId,
    email: user.email ?? '',
    role,
    region,
    paper_size: paperSize,
  });

  return role;
}
