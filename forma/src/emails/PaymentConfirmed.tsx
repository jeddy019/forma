import { Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 6: Payment confirmed - Flutterwave webhook (Phase 5 Step 27).
// invoiceAttached defaults true (createInvoice.ts always attempts an
// attachment) but stays optional so this template still renders sensibly
// if invoice creation itself failed (createInvoice returns null on error -
// see activateSubscription.ts) and the email had to go out without one.
export interface PaymentConfirmedEmailProps {
  planName: string;
  amountFormatted: string;
  renewalDateFormatted: string;
  invoiceAttached?: boolean;
}

export default function PaymentConfirmedEmail({
  planName,
  amountFormatted,
  renewalDateFormatted,
  invoiceAttached = true,
}: PaymentConfirmedEmailProps) {
  return (
    <EmailLayout previewText={`Your ${planName} plan payment was confirmed.`}>
      <Text style={emailStyles.heading}>Payment confirmed</Text>
      <Text style={emailStyles.body}>
        Thanks - your {planName} plan payment of {amountFormatted} went through. Your plan renews on{' '}
        {renewalDateFormatted}.
        {invoiceAttached && ' Your invoice is attached to this email.'}
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
