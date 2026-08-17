export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Exchanges a Supabase Auth PKCE code for a real session - needed for any
// email-link flow. Tutor/parent auth (src/app/login, src/app/signup) uses
// signInWithPassword/signUp directly and never reaches this route; the
// only current consumer is the student portal's magic-link login (Phase 6
// Step 36, src/app/student/login), which is why the failure path below
// redirects there specifically rather than somewhere generic - not
// pretending this is used more broadly than it actually is yet.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') ?? '/student';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${appUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${appUrl}/student/login?error=link_invalid`);
}
