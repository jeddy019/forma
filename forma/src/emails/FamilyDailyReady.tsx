import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// W8 Wave E (daily practice to the family, decided with the user 2026-08-30):
// the founder-model flip. Previously the morning cron sent an email per
// student to the student's own record (student.email) or the owner; now the
// parent receives ONE daily email per FAMILY listing every child's practice
// for the day - parent_email lives on the families table only, so a parent
// with three children gets one email, not three, and never has to hunt for
// the links. The founder's own digest (DailyQuizDigest, sent to the owner
// account) is unchanged and remains separate.
//
// Parent-facing recurring summary, same deliverability category as emails 3,
// 4, and 5 (a parent is the subcriber; this is a standing daily delivery, not
// a one-off a child triggered) - so it carries the List-Unsubscribe header +
// footer like those, the first automated parent-facing send to do so. See
// EmailLayout's comment on why a mailto: link is a valid mechanism.
export interface FamilyReadyEntry {
  name: string;
  subject: string;
  topic: string;
  url: string;
  // The 4-digit practice code - entry at forma.app/q/[code] works the same
  // as the link, so the parent can share either with the child.
  digitalCode: string;
}

export interface FamilyDailyReadyProps {
  dateLabel: string;
  entries: FamilyReadyEntry[];
  brandName?: string;
}

export default function FamilyDailyReadyEmail({
  dateLabel,
  entries,
  brandName,
}: FamilyDailyReadyProps) {
  return (
    <EmailLayout
      previewText={`${entries.length === 1 ? 'Your child' : 'Your children'}'s practice for today is ready.`}
      brandName={brandName}
      showUnsubscribeFooterLine
    >
      <Text style={emailStyles.heading}>Today&apos;s practice - {dateLabel}</Text>
      <Text style={emailStyles.body}>
        {entries.length === 1
          ? `${entries[0].name.split(' ')[0]}'s practice for today is ready below.`
          : `Practice for today is ready below - one card for each of your children.`}
      </Text>

      {entries.map((entry) => (
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

      <Text style={emailStyles.muted}>
        If a child&apos;s practice is not listed here, they are taking a day off or covering a
        different topic - no action needed.
      </Text>
    </EmailLayout>
  );
}