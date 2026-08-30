import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// W8 Wave D (automatic daily quiz): the founder's morning digest. One email
// listing every student's auto-generated daily quiz with its link - the
// founder forwards the daily quiz to each student (CLAUDE.md: "the founder
// forwards the morning digest, the student practises after school"). A
// skipped/failed student is shown in the muted footer so nothing about a
// student ever vanishes silently.
//
// Founder-facing, not one of the 8 numbered emails (like ScheduleFailed):
// no List-Unsubscribe, it is transactional-to-self rather than a recurring
// summary to a subscriber.
export interface DailyQuizDigestEntry {
  name: string;
  subject: string;
  topic: string;
  url: string;
  // The 4-digit practice code - entry at forma.app/q/[code] works the same
  // as the link, so the founder can forward either.
  digitalCode: string;
}

export interface DailyQuizDigestProps {
  dateLabel: string;
  generated: DailyQuizDigestEntry[];
  skippedCount: number;
  failedCount: number;
  brandName?: string;
}

export default function DailyQuizDigestEmail({
  dateLabel,
  generated,
  skippedCount,
  failedCount,
  brandName,
}: DailyQuizDigestProps) {
  return (
    <EmailLayout previewText={`Today's practice for ${generated.length} student${generated.length === 1 ? '' : 's'} is ready.`} brandName={brandName}>
      <Text style={emailStyles.heading}>Today&apos;s practice - {dateLabel}</Text>
      {generated.length === 0 ? (
        <Text style={emailStyles.body}>No daily practice was generated this morning.</Text>
      ) : (
        <Text style={emailStyles.body}>Each student&apos;s daily quiz is ready. Send it on when they are back from school.</Text>
      )}

      {generated.map((entry) => (
        <div style={emailStyles.card} key={entry.url}>
          <Text style={{ ...emailStyles.body, margin: 0, fontWeight: 600 }}>{entry.name}</Text>
          <Text style={{ ...emailStyles.muted, margin: '4px 0 12px 0' }}>
            {entry.subject} - {entry.topic} - code {entry.digitalCode}
          </Text>
          <Section>
            <Button href={entry.url} style={{ ...emailStyles.button, padding: '8px 16px' }}>
              Open practice
            </Button>
          </Section>
        </div>
      ))}

      {(skippedCount > 0 || failedCount > 0) && (
        <Text style={emailStyles.muted}>
          {skippedCount > 0 && `${skippedCount} student${skippedCount === 1 ? '' : 's'} skipped (holiday or no practice history yet). `}
          {failedCount > 0 && `${failedCount} failed to generate - check the dashboard.`}
        </Text>
      )}
    </EmailLayout>
  );
}