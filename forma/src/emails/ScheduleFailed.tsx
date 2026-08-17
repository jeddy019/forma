import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// Not one of the 8 numbered templates in CLAUDE.md's Email Templates list -
// this is the owner notification Technical Challenge 7 (CRON FAILURE
// ISOLATION) requires ("retry once after 10 minutes. Email owner on second
// failure. Never silently skip.") but no template exists for. Built using
// the same shared EmailLayout rather than inventing a separate look, since
// this is still a real email a real owner reads, not just a log line.
export interface ScheduleFailedEmailProps {
  studentName: string;
  subject: string;
  scheduleUrl: string;
}

export default function ScheduleFailedEmail({ studentName, subject, scheduleUrl }: ScheduleFailedEmailProps) {
  return (
    <EmailLayout previewText={`This week's ${subject} worksheet for ${studentName} could not be generated.`}>
      <Text style={emailStyles.heading}>A scheduled worksheet did not generate</Text>
      <Text style={emailStyles.body}>
        Forma tried twice to generate {studentName}&apos;s scheduled {subject} worksheet and could not complete it.
        Nothing was sent to {studentName}. Your other schedules are not affected.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={scheduleUrl} style={emailStyles.button}>
          Review this schedule
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        This schedule will try again automatically at its next scheduled time. If this keeps happening, try
        generating a worksheet manually to see the full error.
      </Text>
    </EmailLayout>
  );
}
