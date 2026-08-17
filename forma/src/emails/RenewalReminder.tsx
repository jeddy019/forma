import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 7: Renewal reminder - 3 days before expiry (Phase 5).
export interface RenewalReminderEmailProps {
  planName: string;
  amountFormatted: string;
  expiryDateFormatted: string;
  billingUrl: string;
}

export default function RenewalReminderEmail({
  planName,
  amountFormatted,
  expiryDateFormatted,
  billingUrl,
}: RenewalReminderEmailProps) {
  return (
    <EmailLayout previewText={`Your ${planName} plan renews on ${expiryDateFormatted}.`}>
      <Text style={emailStyles.heading}>Your plan renews soon</Text>
      <Text style={emailStyles.body}>
        Your {planName} plan ({amountFormatted}) renews on {expiryDateFormatted}. No action is needed if your card on
        file is up to date.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={billingUrl} style={emailStyles.button}>
          Review billing
        </Button>
      </Section>
    </EmailLayout>
  );
}
