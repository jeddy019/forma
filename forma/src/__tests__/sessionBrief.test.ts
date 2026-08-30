import { describe, expect, it } from 'vitest';
import { sessionBriefWindow } from '@/lib/brief/buildSessionBrief';
import { sessionBriefFilename } from '@/lib/brief/generateSessionBrief';
import { renderSessionBriefHtml } from '@/lib/pdf/session-brief-template';
import { buildWeeklyReport } from '@/lib/report/buildWeeklyReport';

const now = new Date('2026-09-07T08:00:00Z');

describe('sessionBriefWindow', () => {
  it('anchors on the last session note date when one exists', () => {
    const window = sessionBriefWindow('2026-08-24T10:00:00.000Z', now);
    expect(window.anchoredOnNote).toBe(true);
    expect(window.sinceIso).toBe('2026-08-24T10:00:00.000Z');
    expect(window.windowLabel).toBe('Practice since 24 August');
  });

  it('falls back to the last 7 days when no note exists', () => {
    const window = sessionBriefWindow(null, now);
    expect(window.anchoredOnNote).toBe(false);
    expect(window.sinceIso).toBe('2026-08-31T08:00:00.000Z');
    expect(window.windowLabel).toBe('Practice this week');
  });
});

describe('sessionBriefFilename', () => {
  it('builds a first-name filename matching the Performance Rule 11 shape', () => {
    expect(sessionBriefFilename('Aisha Ade', now)).toBe('Aisha-SessionBrief-07Sep2026.pdf');
  });

  it('falls back to Student for a blank name', () => {
    expect(sessionBriefFilename('   ', now)).toBe('Student-SessionBrief-07Sep2026.pdf');
  });
});

describe('renderSessionBriefHtml', () => {
  const brief = buildWeeklyReport(
    [
      { scorePercentage: 80, topic: 'Surds', submittedAt: '2026-09-05T10:00:00Z' },
      { scorePercentage: 62, topic: 'Trigonometry', submittedAt: '2026-09-03T12:00:00Z' },
    ],
    '2026-08-31T08:00:00.000Z',
    {},
    now
  );

  const base = {
    studentName: 'Aisha Ade',
    contextLine: 'GCSE - Year 10',
    windowLabel: 'Practice since 24 August',
    brief,
    lastNote: { content: 'Continue with surds - watch the simplifying.', createdAt: '2026-08-24T10:00:00.000Z' },
    brand: { name: 'Jedidiah', accent: '#1A3D2E' },
  };

  it('renders the brand wordmark, student name, context line, window and a score', () => {
    const { html } = renderSessionBriefHtml(base);
    expect(html).toContain('Jedidiah');
    expect(html).toContain('Aisha Ade');
    expect(html).toContain('GCSE - Year 10');
    expect(html).toContain('Practice since 24 August');
    expect(html).toContain('80%');
  });

  it('renders the verbatim last session note with its date', () => {
    const { html } = renderSessionBriefHtml(base);
    expect(html).toContain('Continue with surds - watch the simplifying.');
    expect(html).toContain('Recorded 24 August');
  });

  it('escapes note free text so it cannot inject HTML into the PDF', () => {
    const { html } = renderSessionBriefHtml({
      ...base,
      lastNote: { content: '<script>alert(1)</script> blame "no" \'quotes\'', createdAt: '2026-08-24T10:00:00.000Z' },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows a gentle hint instead of a note block when no note exists', () => {
    const { html } = renderSessionBriefHtml({ ...base, lastNote: null });
    expect(html).toContain('No session note recorded yet.');
    expect(html).not.toContain('<div class="note-block">');
  });
});