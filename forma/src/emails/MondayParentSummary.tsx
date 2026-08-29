import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 4: Monday parent summary - score, strongest topic, area to work on.
// Always to the account owner (this is the owner's own weekly digest, not
// student-addressable). Carries List-Unsubscribe (Legal Requirements).
export interface MondayParentSummaryEmailProps {
  studentName: string;
  worksheetsCompleted: number;
  averageScorePercentage: number | null;
  strongestTopic: string | null;
  areaToImprove: string | null;
  dashboardUrl: string;
  brandName?: string;
}

export default function MondayParentSummaryEmail({
  studentName,
  worksheetsCompleted,
  averageScorePercentage,
  strongestTopic,
  areaToImprove,
  dashboardUrl,
  brandName,
}: MondayParentSummaryEmailProps) {
  return (
    <EmailLayout previewText={`${studentName}'s week in review.`} showUnsubscribeFooterLine brandName={brandName}>
      <Text style={emailStyles.heading}>{studentName}&apos;s week in review</Text>
      <Text style={emailStyles.body}>
        {worksheetsCompleted === 0
          ? `${studentName} did not complete any worksheets last week.`
          : `${studentName} completed ${worksheetsCompleted} worksheet${worksheetsCompleted === 1 ? '' : 's'} last week${
              averageScorePercentage !== null ? `, averaging ${averageScorePercentage}%` : ''
            }.`}
      </Text>
      {strongestTopic && (
        <div style={emailStyles.card}>
          <Text style={{ ...emailStyles.body, margin: 0 }}>
            <strong>Strongest topic:</strong> {strongestTopic}
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
      <Section style={{ margin: '24px 0' }}>
        <Button href={dashboardUrl} style={emailStyles.button}>
          View full history
        </Button>
      </Section>
    </EmailLayout>
  );
}
