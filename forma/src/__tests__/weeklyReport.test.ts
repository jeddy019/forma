import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, type ReportSubmission } from '@/lib/report/buildWeeklyReport';
import { reportFilename } from '@/lib/report/generateWeeklyReport';
import { renderWeeklyReportHtml } from '@/lib/pdf/report-template';

const now = new Date('2026-09-07T08:00:00Z');
const sinceIso = '2026-08-31T08:00:00.000Z';

function submission(partial: Partial<ReportSubmission> & { scorePercentage: number }) {
  return { topic: 'Fractions', submittedAt: '2026-09-05T10:00:00Z', ...partial };
}

describe('buildWeeklyReport', () => {
  it('returns empty aggregates when there are no submissions', () => {
    const report = buildWeeklyReport([], sinceIso, now);
    expect(report.worksheetsCompleted).toBe(0);
    expect(report.averageScorePercentage).toBeNull();
    expect(report.strongestTopic).toBeNull();
    expect(report.areaToImprove).toBeNull();
    expect(report.activity).toEqual([]);
  });

  it('computes average, strongest and weakest from the scored submissions', () => {
    const report = buildWeeklyReport(
      [
        submission({ scorePercentage: 90, topic: 'Algebra' }),
        submission({ scorePercentage: 50, topic: 'Fractions' }),
        submission({ scorePercentage: 70, topic: 'Ratio' }),
      ],
      sinceIso,
      now
    );
    expect(report.averageScorePercentage).toBe(70);
    expect(report.strongestTopic).toBe('Algebra');
    expect(report.areaToImprove).toBe('Fractions');
  });

  it('sorts the practice log most-recent-first with short date labels', () => {
    const report = buildWeeklyReport(
      [
        submission({ scorePercentage: 60, topic: 'Early', submittedAt: '2026-09-01T09:00:00Z' }),
        submission({ scorePercentage: 85, topic: 'Late', submittedAt: '2026-09-06T18:00:00Z' }),
        submission({ scorePercentage: 70, topic: 'Mid', submittedAt: '2026-09-03T12:00:00Z' }),
      ],
      sinceIso,
      now
    );
    expect(report.activity.map((a) => a.topic)).toEqual(['Late', 'Mid', 'Early']);
    expect(report.activity[0].score).toBe(85);
    expect(report.activity[0].dateLabel).toMatch(/^\d{1,2} [A-Z][a-z]{2,3}$/);
  });

  it('labels the period range without the year repeating twice', () => {
    const report = buildWeeklyReport([submission({ scorePercentage: 80 })], sinceIso, now);
    expect(report.periodLabel).toBe('31 Aug - 7 Sept 2026');
  });
});

describe('reportFilename', () => {
  it('builds a first-name filename matching the Performance Rule 11 shape', () => {
    expect(reportFilename('Aisha Ade', now)).toBe('Aisha-WeeklyReport-07Sep2026.pdf');
  });

  it('falls back to Student for a blank name', () => {
    expect(reportFilename('   ', now)).toBe('Student-WeeklyReport-07Sep2026.pdf');
  });
});

describe('renderWeeklyReportHtml', () => {
  const data = {
    studentName: 'Aisha Ade',
    tutorNote: 'Great week on fractions.',
    report: buildWeeklyReport([submission({ scorePercentage: 80 })], sinceIso, now),
    brand: { name: 'Jedidiah', accent: '#1A3D2E' },
  };

  it('renders the brand wordmark, student name, note and a score', () => {
    const { html } = renderWeeklyReportHtml(data);
    expect(html).toContain('Jedidiah');
    expect(html).toContain('Aisha Ade');
    expect(html).toContain('Great week on fractions.');
    expect(html).toContain('80%');
  });

  it('escapes free text so a note cannot inject HTML into the PDF', () => {
    const { html } = renderWeeklyReportHtml({ ...data, tutorNote: '<script>alert(1)</script> blame "no" \'quotes\'' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});