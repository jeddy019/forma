import { getResendClient, EMAIL_FROM } from './resend';
import { unsubscribeHeaders } from '@/emails/components/EmailLayout';
import WelcomeEmail, { type WelcomeEmailProps } from '@/emails/Welcome';
import WorksheetReadyEmail, { type WorksheetReadyEmailProps } from '@/emails/WorksheetReady';
import WeeklyDeliveryEmail, { type WeeklyDeliveryEmailProps } from '@/emails/WeeklyDelivery';
import MondayParentSummaryEmail, { type MondayParentSummaryEmailProps } from '@/emails/MondayParentSummary';
import TutorParentReportEmail, { type TutorParentReportEmailProps } from '@/emails/TutorParentReport';
import PaymentConfirmedEmail, { type PaymentConfirmedEmailProps } from '@/emails/PaymentConfirmed';
import RenewalReminderEmail, { type RenewalReminderEmailProps } from '@/emails/RenewalReminder';
import PaymentFailedEmail, { type PaymentFailedEmailProps } from '@/emails/PaymentFailed';
import ScheduleFailedEmail, { type ScheduleFailedEmailProps } from '@/emails/ScheduleFailed';

// Thin typed wrappers around resend.emails.send(), one per template in
// src/emails/. Every function returns a boolean rather than throwing -
// email delivery is never allowed to break the caller's own flow (a failed
// welcome email must not fail signup, a failed worksheet-ready email must
// not fail generation). Callers that care about the outcome can log it or
// show a soft notice; nothing here is fatal by design.
//
// Only emails 3, 4, and 5 pass unsubscribeHeaders() (Legal Requirements:
// "Include the List-Unsubscribe header in emails 3, 4, and 5") - 1, 2, 6, 7,
// 8 are one-off transactional sends the recipient directly triggered or
// expects (welcome, a worksheet they just requested, billing), not the
// recurring/summary category that requirement is aimed at.

async function send(args: { to: string; subject: string; react: React.ReactElement; headers?: Record<string, string> }): Promise<boolean> {
  // Checked before touching the Resend client at all - see resend.ts's own
  // comment for why: constructing the SDK with no key throws synchronously,
  // so this check has to happen first, not inside a try/catch around .send().
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not configured - skipping email send (${args.subject})`);
    return false;
  }

  const { error } = await getResendClient().emails.send({
    from: EMAIL_FROM,
    to: args.to,
    subject: args.subject,
    react: args.react,
    headers: args.headers,
  });
  if (error) {
    console.error(`Failed to send email (${args.subject})`, error);
    return false;
  }
  return true;
}

export function sendWelcomeEmail(to: string, props: WelcomeEmailProps): Promise<boolean> {
  return send({ to, subject: 'Welcome to Forma', react: <WelcomeEmail {...props} /> });
}

export function sendWorksheetReadyEmail(to: string, props: WorksheetReadyEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `${props.studentName}'s ${props.subject} worksheet is ready`,
    react: <WorksheetReadyEmail {...props} />,
  });
}

export function sendWeeklyDeliveryEmail(to: string, props: WeeklyDeliveryEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `This week's ${props.subject} practice for ${props.studentName}`,
    react: <WeeklyDeliveryEmail {...props} />,
    headers: unsubscribeHeaders(),
  });
}

export function sendMondayParentSummaryEmail(to: string, props: MondayParentSummaryEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `${props.studentName}'s week in review`,
    react: <MondayParentSummaryEmail {...props} />,
    headers: unsubscribeHeaders(),
  });
}

export function sendTutorParentReportEmail(to: string, props: TutorParentReportEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `A progress report for ${props.studentName}`,
    react: <TutorParentReportEmail {...props} />,
    headers: unsubscribeHeaders(),
  });
}

export function sendPaymentConfirmedEmail(to: string, props: PaymentConfirmedEmailProps): Promise<boolean> {
  return send({ to, subject: 'Payment confirmed', react: <PaymentConfirmedEmail {...props} /> });
}

export function sendRenewalReminderEmail(to: string, props: RenewalReminderEmailProps): Promise<boolean> {
  return send({ to, subject: 'Your Forma plan renews soon', react: <RenewalReminderEmail {...props} /> });
}

export function sendPaymentFailedEmail(to: string, props: PaymentFailedEmailProps): Promise<boolean> {
  return send({ to, subject: 'Payment could not be processed', react: <PaymentFailedEmail {...props} /> });
}

// Not one of the 8 numbered emails - see ScheduleFailed.tsx's own comment.
export function sendScheduleFailedEmail(to: string, props: ScheduleFailedEmailProps): Promise<boolean> {
  return send({
    to,
    subject: `A scheduled worksheet for ${props.studentName} did not generate`,
    react: <ScheduleFailedEmail {...props} />,
  });
}
