import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 2: Worksheet ready - manual generation. Per the Student Accounts
// decision in CLAUDE.md's Legal Requirements section, this goes to the
// student directly when student_profiles.email is set, otherwise to the
// account owner - the caller (src/lib/email/send.ts) decides the recipient
// address, this template just needs to know who it's greeting.
export interface WorksheetReadyEmailProps {
  studentName: string;
  subject: string;
  topic: string;
  worksheetUrl: string;
  sentToStudentDirectly: boolean;
  // Phase 6 Step 36: the student portal login link - only meaningful (and
  // only ever passed) when sentToStudentDirectly is true, since the
  // portal itself is keyed off the recipient's own verified email, not
  // the account owner's.
  portalUrl?: string;
}

export default function WorksheetReadyEmail({
  studentName,
  subject,
  topic,
  worksheetUrl,
  sentToStudentDirectly,
  portalUrl,
}: WorksheetReadyEmailProps) {
  return (
    <EmailLayout previewText={`${studentName}'s ${subject} worksheet is ready.`}>
      <Text style={emailStyles.heading}>{studentName}&apos;s worksheet is ready</Text>
      <Text style={emailStyles.body}>
        A new {subject} worksheet on {topic} is ready{sentToStudentDirectly ? ' for you' : ` for ${studentName}`} to
        complete.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={worksheetUrl} style={emailStyles.button}>
          Open the worksheet
        </Button>
      </Section>
      <Text style={emailStyles.muted}>This link stays open for 30 days.</Text>
      {sentToStudentDirectly && portalUrl && (
        <Text style={emailStyles.muted}>
          Want to see your past worksheets and scores?{' '}
          <a href={portalUrl} style={{ color: '#1A3D2E' }}>
            View your history
          </a>
          .
        </Text>
      )}
    </EmailLayout>
  );
}
