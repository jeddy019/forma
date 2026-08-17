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
}

export default function WorksheetReadyEmail({
  studentName,
  subject,
  topic,
  worksheetUrl,
  sentToStudentDirectly,
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
    </EmailLayout>
  );
}
