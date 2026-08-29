import { Body, Container, Font, Head, Hr, Html, Link, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

// Shared wrapper for all 8 templates in src/emails/ - one definition of the
// Forma email chrome (wordmark, colours, footer) so the 8 templates can't
// silently drift from each other or from the Design System in CLAUDE.md.
//
// Email clients strip <link> tags and most external stylesheets, so the
// Design System's actual web fonts (Playfair Display, Inter) can't be
// relied on the way the PDF's <link> tags can - React Email's <Font>
// component declares the intent and a serif/sans-serif system fallback
// stack carries the brand's shape (a serif heading, a plain sans body) even
// in clients that never load the web font at all.
const HEADING_FONT_FAMILY = 'Playfair Display';
// React Email's <Font fallbackFontFamily> only accepts a fixed set of web-
// safe keywords (not an arbitrary CSS font-stack string) - the fuller stack
// used in inline `style={{ fontFamily: ... }}` below is a plain CSS string
// and isn't constrained the same way.
const HEADING_FALLBACK: ('Georgia' | 'Times New Roman' | 'serif')[] = ['Georgia', 'Times New Roman', 'serif'];
const HEADING_FALLBACK_CSS = 'Georgia, "Times New Roman", serif';
const BODY_FONT_FAMILY = 'Inter';
const BODY_FALLBACK: ('Helvetica' | 'Arial' | 'sans-serif')[] = ['Helvetica', 'Arial', 'sans-serif'];
const BODY_FALLBACK_CSS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export interface EmailLayoutProps {
  previewText: string;
  children: ReactNode;
  // W1 identity layer: the account owner's own brand name (resolved from
  // users.brand_name via resolveBranding, threaded by the caller through
  // each template's props). Defaults to 'Forma' when the account has no
  // custom brand set. The wordmark replaces "Forma" everywhere a parent or
  // student reads it - emails are the founder's own voice, not the
  // platform's (FOUNDER'S PERSONAL MODEL anti-swallow invariant).
  brandName?: string;
  // RFC 8058 List-Unsubscribe. Only emails 3, 4, and 5 pass this (Legal
  // Requirements: "Include the List-Unsubscribe header in emails 3, 4, and
  // 5") - a mailto: link, not a one-click HTTP endpoint, since there is no
  // per-recipient subscription-preference table in the schema to back a
  // stateful unsubscribe flow. A mailto: link is a valid, compliant
  // mechanism on its own (CAN-SPAM/CASL/GDPR all require *a* working
  // unsubscribe path, not specifically a one-click HTTP one) - revisit if a
  // real preference centre is ever built.
  showUnsubscribeFooterLine?: boolean;
}

export function unsubscribeHeaders(): Record<string, string> {
  return {
    'List-Unsubscribe': '<mailto:unsubscribe@forma.app?subject=unsubscribe>',
  };
}

// Shared inline styles for the 8 templates - email HTML has no external
// stylesheet, so every style is inline; centralising these here is the
// email equivalent of formStyles.ts for the web app.
export const emailStyles = {
  heading: {
    fontFamily: `${HEADING_FONT_FAMILY}, ${HEADING_FALLBACK_CSS}`,
    fontSize: '24px',
    fontWeight: 600,
    color: '#1A1A18',
    margin: '0 0 16px 0',
  },
  body: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#1A1A18',
    margin: '0 0 16px 0',
  },
  muted: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#5C5849',
    margin: '0 0 16px 0',
  },
  card: {
    backgroundColor: '#F0EBE3',
    border: '0.5px solid #E0D9D0',
    borderRadius: '10px',
    padding: '16px',
    margin: '0 0 16px 0',
  },
  button: {
    backgroundColor: '#1A3D2E',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '10px',
    padding: '12px 24px',
    textDecoration: 'none',
    display: 'inline-block',
  },
} as const;

export default function EmailLayout({
  previewText,
  children,
  brandName = 'Forma',
  showUnsubscribeFooterLine,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily={HEADING_FONT_FAMILY}
          fallbackFontFamily={HEADING_FALLBACK}
          webFont={{
            url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font fontFamily={BODY_FONT_FAMILY} fallbackFontFamily={BODY_FALLBACK} fontWeight={400} fontStyle="normal" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#F7F4EF', margin: 0, padding: '32px 0' }}>
        <Container
          style={{
            // Page background token, not the card token - some templates
            // (MondayParentSummary, PaymentConfirmed) nest emailStyles.card
            // (#F0EBE3) inside this Container, and that only reads as a
            // raised card if the Container itself is the page tone, not
            // the same card tone.
            backgroundColor: '#F7F4EF',
            maxWidth: '480px',
            borderRadius: '12px',
            border: '0.5px solid #E0D9D0',
            padding: '32px',
          }}
        >
          <Text
            style={{
              fontFamily: `${HEADING_FONT_FAMILY}, ${HEADING_FALLBACK_CSS}`,
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A3D2E',
              margin: '0 0 24px 0',
            }}
          >
            {brandName}
          </Text>

          <Section style={{ fontFamily: `${BODY_FONT_FAMILY}, ${BODY_FALLBACK_CSS}` }}>{children}</Section>

          <Hr style={{ borderColor: '#E0D9D0', margin: '32px 0 16px 0' }} />
          <Text style={{ fontFamily: `${BODY_FONT_FAMILY}, ${BODY_FALLBACK_CSS}`, fontSize: '11px', color: '#9A9080', margin: 0 }}>
            {brandName} - Practice built for your student.
            {showUnsubscribeFooterLine && (
              <>
                {' '}
                <Link href="mailto:unsubscribe@forma.app?subject=unsubscribe" style={{ color: '#9A9080', textDecoration: 'underline' }}>
                  Unsubscribe
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
