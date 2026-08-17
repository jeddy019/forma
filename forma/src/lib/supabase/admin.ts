import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client, bypassing RLS - per Security Rules 1, this is the
// only client the /s/[code] route and /api/submit are allowed to use, and
// only for the specific safe-column selects each of them makes. Never
// import this into anything that returns unfiltered rows to an
// unauthenticated caller.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
