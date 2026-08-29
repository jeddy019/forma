import { Button, Link, Section, Text } from '@react-email/components';
import EmailLayout, { emailStyles } from './components/EmailLayout';

// EMAIL 1: Welcome - sent immediately on signup. No "name" column exists on
// users (email + role + plan only), so this greets by role rather than a
// name that doesn't exist anywhere in the schema.
export interface WelcomeEmailProps {
  role: 'tutor' | 'parent';
  appUrl: string;
  brandName?: string;
}

export default function WelcomeEmail({ role, appUrl, brandName }: WelcomeEmailProps) {
  const roleLabel = role === 'tutor' ? 'tutor' : 'parent';
  return (
    <EmailLayout previewText="Welcome to Forma - practice built for your student." brandName={brandName}>
      <Text style={emailStyles.heading}>Welcome to Forma</Text>
      <Text style={emailStyles.body}>
        You are set up as a {roleLabel} on Forma. Add a student profile, describe what they are struggling with, and
        Forma builds a curriculum-aligned worksheet with coloured diagrams and a proper mark scheme in under a
        minute.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={`${appUrl}/dashboard/students`} style={emailStyles.button}>
          Add your first student
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Free accounts include 3 worksheets a month. Questions? Just reply to this email.
      </Text>
      <Text style={emailStyles.muted}>
        <Link href={`${appUrl}/privacy`} style={{ color: '#5C5849' }}>
          Privacy notice
        </Link>
      </Text>
    </EmailLayout>
  );
}
