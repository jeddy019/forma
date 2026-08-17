import { Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 6: Payment confirmed - Flutterwave webhook (Phase 5 Step 27).
export interface PaymentConfirmedEmailProps {
  planName: string;
  amountFormatted: string;
  renewalDateFormatted: string;
}

export default function PaymentConfirmedEmail({ planName, amountFormatted, renewalDateFormatted }: PaymentConfirmedEmailProps) {
  return (
    <EmailLayout previewText={`Your ${planName} plan payment was confirmed.`}>
      <Text style={emailStyles.heading}>Payment confirmed</Text>
      <Text style={emailStyles.body}>
        Thanks - your {planName} plan payment of {amountFormatted} went through. Your plan renews on{' '}
        {renewalDateFormatted}.
      </Text>
      <Section style={emailStyles.card}>
        <Text style={{ ...emailStyles.muted, margin: 0 }}>
          Plan: {planName}
          <br />
          Amount: {amountFormatted}
          <br />
          Renews: {renewalDateFormatted}
        </Text>
      </Section>
    </EmailLayout>
  );
}
