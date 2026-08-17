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
}

export default function WeeklyDeliveryEmail({
  studentName,
  subject,
  topic,
  worksheetUrl,
  sentToStudentDirectly,
  manageScheduleUrl,
}: WeeklyDeliveryEmailProps) {
  return (
    <EmailLayout previewText={`This week's ${subject} practice for ${studentName} is ready.`} showUnsubscribeFooterLine>
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
