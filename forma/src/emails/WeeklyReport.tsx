import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// Phase B W2 (weekly branded proof report): the founder model's weekly
// parent-facing deliverable - hard data + the founder's words, sent as a
// branded PDF attachment (built by /lib/report/generateWeeklyReport.ts). The
// email body itself stays light: a two-line summary and the attachment is
// the real product. Always to the parent (student_profiles.parent_email),
// never the student. Carries List-Unsubscribe - this is a recurring
// summary, the same category as EMAILs 3, 4, and 5.
export interface WeeklyReportEmailProps {
  studentName: string;
  worksheetsCompleted: number;
  averageScorePercentage: number | null;
  strongestTopic: string | null;
  areaToImprove: string | null;
  dashboardUrl: string;
  brandName?: string;
}

export default function WeeklyReportEmail({
  studentName,
  worksheetsCompleted,
  averageScorePercentage,
  strongestTopic,
  areaToImprove,
  dashboardUrl,
  brandName,
}: WeeklyReportEmailProps) {
  return (
    <EmailLayout previewText={`${studentName}'s weekly practice report is ready.`} showUnsubscribeFooterLine brandName={brandName}>
      <Text style={emailStyles.heading}>{studentName}&apos;s weekly practice report</Text>
      <Text style={emailStyles.body}>
        {worksheetsCompleted === 0
          ? `${studentName} did not complete any practice this week.`
          : `${studentName} completed ${worksheetsCompleted} worksheet${worksheetsCompleted === 1 ? '' : 's'} this week${
              averageScorePercentage !== null ? `, averaging ${averageScorePercentage}%` : ''
            }.`}
      </Text>
      {strongestTopic && (
        <div style={emailStyles.card}>
          <Text style={{ ...emailStyles.body, margin: 0 }}>
            <strong>Strongest area:</strong> {strongestTopic}
          </Text>
        </div>
      )}
      {areaToImprove && (
        <div style={emailStyles.card}>
          <Text style={{ ...emailStyles.body, margin: 0 }}>
            <strong>Area to work on:</strong> {areaToImprove}
          </Text>
        </div>
      )}
      <Text style={emailStyles.body}>The full branded report is attached to this email.</Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={dashboardUrl} style={emailStyles.button}>
          Open full history
        </Button>
      </Section>
    </EmailLayout>
  );
}