import { Resend } from 'resend';

// RESEND_API_KEY is server-only (Security Rules 5) - this module must never
// be imported from a 'use client' file.
export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = 'Forma <worksheets@forma.app>';
