import { Button, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 8: Payment failed with retry link (Phase 5).
export interface PaymentFailedEmailProps {
  planName: string;
  retryUrl: string;
  brandName?: string;
}

export default function PaymentFailedEmail({ planName, retryUrl, brandName }: PaymentFailedEmailProps) {
  return (
    <EmailLayout previewText={`Your ${planName} plan payment could not be processed.`} brandName={brandName}>
      <Text style={emailStyles.heading}>Payment could not be processed</Text>
      <Text style={emailStyles.body}>
        We could not process your {planName} plan payment. Please check your card details and try again to keep your
        plan active.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={retryUrl} style={emailStyles.button}>
          Update payment details
        </Button>
      </Section>
    </EmailLayout>
  );
}
