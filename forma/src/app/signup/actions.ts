'use server';

import { sendWelcomeEmail } from '@/lib/email/send';

// Split out of page.tsx because RESEND_API_KEY (Security Rules 5) is
// server-only and signup/page.tsx is a 'use client' component - it can call
// this server action directly, the same pattern as createStudentAction.
export async function sendWelcomeEmailAction(email: string, role: 'tutor' | 'parent'): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  // Never lets a failed send block or fail signup - see send.tsx's own note.
  await sendWelcomeEmail(email, { role, appUrl });
}
