import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // supabase.auth.getUser() is a network round-trip to the Supabase auth
  // server (required here over getSession() because middleware needs the
  // revalidated session, not just the local unverified JWT) - it must not
  // run on routes that don't need auth. The matcher below still catches
  // every non-static request, so without this early return every visit to
  // "/", "/login", "/signup", "/student/login", and every /s/[code] digital
  // worksheet (the route students open on their phones) paid that round-trip
  // for no reason. Confirmed live: only /dashboard/* actually branches on
  // `user` below.
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard');
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization files.
     * This keeps auth session refresh cheap on public routes like / and /s/[code].
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
