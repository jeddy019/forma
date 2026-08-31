import { getResendClient, emailFrom } from './resend';
import { unsubscribeHeaders } from '@/emails/components/EmailLayout';
import WeeklyDeliveryEmail, { type WeeklyDeliveryEmailProps } from '@/emails/WeeklyDelivery';
import MondayParentSummaryEmail, { type MondayParentSummaryEmailProps } from '@/emails/MondayParentSummary';
import TutorParentReportEmail, { type TutorParentReportEmailProps } from '@/emails/TutorParentReport';
import WeeklyReportEmail, { type WeeklyReportEmailProps } from '@/emails/WeeklyReport';
import PaymentConfirmedEmail, { type PaymentConfirmedEmailProps } from '@/emails/PaymentConfirmed';
import RenewalReminderEmail, { type RenewalReminderEmailProps } from '@/emails/RenewalReminder';
import PaymentFailedEmail, { type PaymentFailedEmailProps } from '@/emails/PaymentFailed';
import ScheduleFailedEmail, { type ScheduleFailedEmailProps } from '@/emails/ScheduleFailed';
import DailyQuizDigestEmail, { type DailyQuizDigestProps } from '@/emails/DailyQuizDigest';
import FamilyDailyReadyEmail, { type FamilyDailyReadyProps } from '@/emails/FamilyDailyReady';
import { familyReadySubject } from './familyReadySubject';

// Thin typed wrappers around resend.emails.send(), one per template in
// src/emails/. Every function returns a boolean rather than throwing -
// email delivery is never allowed to break the caller's own flow (a failed
// welcome email must not fail signup, a failed worksheet-ready email must
// not fail generation). Callers that care about the outcome can log it or
// show a soft notice; nothing here is fatal by design.
//
// Only emails 3, 4, and 5 pass unsubscribeHeaders() (Legal Requirements:
// "Include the List-Unsubscribe header in emails 3, 4, and 5") - the
// recurring/summary category that requirement is aimed at. The one-off
// transactional sends (billing, schedule alerts, digests) each triggered
// by or expected by the recipient do not carry it.

interface EmailAttachment {
  filename: string;
  content: Buffer;
}

async function send(args: {
  to: string;
  subject: string;
  react: React.ReactElement;
  brandName?: string;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  // Checked before touching the Resend client at all - see resend.ts's own
  // comment for why: constructing the SDK with no key throws synchronously,
  // so this check has to happen first, not inside a try/catch around .send().
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not configured - skipping email send (${args.subject})`);
    return false;
  }

  const { error } = await getResendClient().emails.send({
    from: emailFrom(args.brandName),
    to: args.to,
    subject: args.subject,
    react: args.react,
    headers: args.headers,
    attachments: args.attachments,
  });
  if (error) {
    console.error(`Failed to send email (${args.subject})`, error);
    return false;
  }
  return true;
}

export function sendWeeklyDeliveryEmail(to: string, props: WeeklyDeliveryEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `This week's ${props.subject} practice for ${props.studentName}`,
    brandName: props.brandName,
    react: <WeeklyDeliveryEmail {...props} />,
    headers: unsubscribeHeaders(),
  });
}

export function sendMondayParentSummaryEmail(to: string, props: MondayParentSummaryEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `${props.studentName}'s week in review`,
    brandName: props.brandName,
    react: <MondayParentSummaryEmail {...props} />,
    headers: unsubscribeHeaders(),
  });
}

export function sendTutorParentReportEmail(to: string, props: TutorParentReportEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `A progress report for ${props.studentName}`,
    brandName: props.brandName,
    react: <TutorParentReportEmail {...props} />,
    headers: unsubscribeHeaders(),
  });
}

export function sendPaymentConfirmedEmail(
  to: string,
  props: PaymentConfirmedEmailProps,
  invoicePdf?: { filename: string; content: Buffer }
): Promise<boolean> {
  return send({
    to,
    subject: 'Payment confirmed',
    brandName: props.brandName,
    react: <PaymentConfirmedEmail {...props} />,
    attachments: invoicePdf ? [invoicePdf] : undefined,
  });
}

export function sendRenewalReminderEmail(to: string, props: RenewalReminderEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `Your ${props.brandName ?? 'Forma'} plan renews soon`,
    brandName: props.brandName,
    react: <RenewalReminderEmail {...props} />,
  });
}

export function sendPaymentFailedEmail(to: string, props: PaymentFailedEmailProps): Promise<boolean> {
  return send({
    to,
    subject: 'Payment could not be processed',
    brandName: props.brandName,
    react: <PaymentFailedEmail {...props} />,
  });
}

// Phase B W2 (weekly branded proof report): subject deliberately mirrors the
// other weekly emails' "[name]'s ..." shape; the branded PDF rides along as
// an attachment, the own attachment mechanism EMAIL 6 already uses for the
// invoice PDF.
export function sendWeeklyReportEmail(
  to: string,
  props: WeeklyReportEmailProps,
  reportPdf: { filename: string; content: Buffer }
): Promise<boolean> {
  return send({
    to,
    subject: `This week's report for ${props.studentName}`,
    brandName: props.brandName,
    react: <WeeklyReportEmail {...props} />,
    headers: unsubscribeHeaders(),
    attachments: [reportPdf],
  });
}

// Not one of the 8 numbered emails - see ScheduleFailed.tsx's own comment.
export function sendScheduleFailedEmail(to: string, props: ScheduleFailedEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `A scheduled worksheet for ${props.studentName} did not generate`,
    brandName: props.brandName,
    react: <ScheduleFailedEmail {...props} />,
  });
}

// W8 Wave D (automatic daily quiz): the founder's morning digest. Goes to the
// owner (tutor) account only - never to a student - and is founder-facing so
// no List-Unsubscribe (same category as ScheduleFailed above).
export function sendDailyQuizDigestEmail(to: string, props: DailyQuizDigestProps): Promise<boolean> {
  return send({
    to,
    subject: `${props.dateLabel}: daily practice ready for ${props.generated.length} student${props.generated.length === 1 ? '' : 's'}`,
    brandName: props.brandName,
    react: <DailyQuizDigestEmail {...props} />,
  });
}

// W8 Wave E (daily practice to the family, 2026-08-30): ONE parent email per
// family listing every child's practice, replacing the old per-student
// send. Goes to families.parent_email (the only place a parent email lives
// now) with the subject derived from the children's first names via
// familyReadySubject. Recurring parent-facing summary - carries
// List-Unsubscribe like emails 3/4/5 (see FamilyDailyReady.tsx's comment).
export function sendFamilyDailyReadyEmail(to: string, props: FamilyDailyReadyProps): Promise<boolean> {
  return send({
    to,
    subject: familyReadySubject(props.entries),
    brandName: props.brandName,
    react: <FamilyDailyReadyEmail {...props} />,
    headers: unsubscribeHeaders(),
  });
}
