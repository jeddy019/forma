import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 3: Automated weekly delivery - sent to the student at the scheduled
// time (or the account owner, per the Student Accounts decision - same
// recipient logic as EMAIL 2, decided by the caller). One of the three
// emails required to carry a List-Unsubscribe header (Legal Requirements) -
// pairing schedules are the closest thing this product has to a recurring
// marketing-style send, so it gets the unsubscribe footer line too.
export interface WeeklyDeliveryEmailProps {
  studentName: string;
  subject: string;
  topic: string;
  worksheetUrl: string;
  sentToStudentDirectly: boolean;
  manageScheduleUrl: string;
  brandName?: string;
  // Phase 6 Step 36: the student portal login link - only meaningful (and
  // only ever passed) when sentToStudentDirectly is true, same reasoning
  // as WorksheetReadyEmail's own portalUrl.
  portalUrl?: string;
}

export default function WeeklyDeliveryEmail({
  studentName,
  subject,
  topic,
  worksheetUrl,
  sentToStudentDirectly,
  manageScheduleUrl,
  brandName,
  portalUrl,
}: WeeklyDeliveryEmailProps) {
  return (
    <EmailLayout previewText={`This week's ${subject} practice for ${studentName} is ready.`} showUnsubscribeFooterLine brandName={brandName}>
      <Text style={emailStyles.heading}>This week&apos;s practice is ready</Text>
      <Text style={emailStyles.body}>
        {studentName}&apos;s scheduled {subject} worksheet on {topic} is ready
        {sentToStudentDirectly ? ' for you' : ''} to complete.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={worksheetUrl} style={emailStyles.button}>
          Open the worksheet
        </Button>
      </Section>
      {sentToStudentDirectly && portalUrl && (
        <Text style={emailStyles.muted}>
          Want to see your past worksheets and scores?{' '}
          <a href={portalUrl} style={{ color: '#1A3D2E' }}>
            View your history
          </a>
          .
        </Text>
      )}
      <Text style={emailStyles.muted}>
        Want to change the day, time, or pause for a school holiday? <br />
        <a href={manageScheduleUrl} style={{ color: '#1A3D2E' }}>
          Manage this schedule
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
