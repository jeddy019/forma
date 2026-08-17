import { Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 5: Tutor parent report - AI-drafted (Phase 4 Step 25), the tutor
// approves before it sends. reportBody arrives as plain paragraphs already
// written (by the AI draft, edited by the tutor) - this template only lays
// it out, it does not generate or alter the wording. Carries
// List-Unsubscribe (Legal Requirements).
export interface TutorParentReportEmailProps {
  studentName: string;
  reportParagraphs: string[];
}

export default function TutorParentReportEmail({ studentName, reportParagraphs }: TutorParentReportEmailProps) {
  return (
    <EmailLayout previewText={`A progress report for ${studentName} from your tutor.`} showUnsubscribeFooterLine>
      <Text style={emailStyles.heading}>A note from {studentName}&apos;s tutor</Text>
      {reportParagraphs.map((paragraph, i) => (
        <Text key={i} style={emailStyles.body}>
          {paragraph}
        </Text>
      ))}
    </EmailLayout>
  );
}
