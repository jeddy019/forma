import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, buildScoreTrend, subSkillHighlights, type ReportSubmission } from '@/lib/report/buildWeeklyReport';
import { reportFilename } from '@/lib/report/generateWeeklyReport';
import { renderWeeklyReportHtml } from '@/lib/pdf/report-template';
import type { SkillMap } from '@/lib/mastery/types';

const now = new Date('2026-09-07T08:00:00Z');
const sinceIso = '2026-08-31T08:00:00.000Z';

function submission(partial: Partial<ReportSubmission> & { scorePercentage: number }) {
  return { topic: 'Fractions', submittedAt: '2026-09-05T10:00:00Z', difficulty: 'standard', ...partial };
}

function skillMapFixture(): SkillMap {
  return {
    fractions: {
      subSkill: 'Fractions',
      history: [{ score: 70, worksheetId: 'w1', topic: 'Fractions', at: '2026-08-20T10:00:00Z' }],
      mastered: false,
      masteredAt: null,
      needsFundamentals: false,
    },
    algebra: {
      subSkill: 'Algebra',
      history: [{ score: 92, worksheetId: 'w2', topic: 'Algebra', at: '2026-08-21T10:00:00Z' }],
      mastered: true,
      masteredAt: '2026-08-21T10:00:00Z',
      needsFundamentals: false,
    },
    ratio: {
      subSkill: 'Ratio',
      history: [{ score: 40, worksheetId: 'w3', topic: 'Ratio', at: '2026-08-22T10:00:00Z' }],
      mastered: false,
      masteredAt: null,
      needsFundamentals: true,
    },
    percentages: {
      subSkill: 'Percentages',
      history: [{ score: 88, worksheetId: 'w4', topic: 'Percentages', at: '2026-08-23T10:00:00Z' }],
      mastered: false,
      masteredAt: null,
      needsFundamentals: false,
    },
  };
}

describe('buildWeeklyReport', () => {
  it('returns empty aggregates when there are no submissions', () => {
    const report = buildWeeklyReport([], sinceIso);
    expect(report.worksheetsCompleted).toBe(0);
    expect(report.averageScorePercentage).toBeNull();
    expect(report.strongestTopic).toBeNull();
    expect(report.areaToImprove).toBeNull();
    expect(report.activity).toEqual([]);
    expect(report.daysPractised).toBe(0);
    expect(report.topicsPractised).toEqual([]);
    expect(report.difficultyPractised).toEqual([]);
    expect(report.subSkills).toEqual({ strengths: [], weaknesses: [] });
    expect(report.attentive).toBeNull();
  });

  it('computes average, strongest and weakest from the scored submissions', () => {
    const report = buildWeeklyReport(
      [
        submission({ scorePercentage: 90, topic: 'Algebra' }),
        submission({ scorePercentage: 50, topic: 'Fractions' }),
        submission({ scorePercentage: 70, topic: 'Ratio' }),
      ],
      sinceIso,
      {},
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
      {},
      now
    );
    expect(report.activity.map((a) => a.topic)).toEqual(['Late', 'Mid', 'Early']);
    expect(report.activity[0].score).toBe(85);
    expect(report.activity[0].dateLabel).toMatch(/^\d{1,2} [A-Z][a-z]{2,3}$/);
  });

  it('labels the period range without the year repeating twice', () => {
    const report = buildWeeklyReport([submission({ scorePercentage: 80 })], sinceIso, {}, now);
    expect(report.periodLabel).toBe('31 Aug - 7 Sept 2026');
  });

  it('counts distinct days practised and topics, difficulty, most-recent-first', () => {
    const report = buildWeeklyReport(
      [
        submission({ scorePercentage: 80, topic: 'Fractions', submittedAt: '2026-09-05T10:00:00Z', difficulty: 'standard' }),
        submission({ scorePercentage: 90, topic: 'Fractions', submittedAt: '2026-09-05T15:00:00Z', difficulty: 'standard' }),
        submission({ scorePercentage: 70, topic: 'Ratio', submittedAt: '2026-09-06T09:00:00Z', difficulty: 'higher' }),
      ],
      sinceIso,
      {},
      now
    );
    expect(report.daysPractised).toBe(2);
    expect(report.topicsPractised).toEqual(['Ratio', 'Fractions']);
    expect(report.difficultyPractised).toEqual(['higher', 'standard']);
  });

  it('pulls sub-skill highlights from the skill map and defaults attentive to null', () => {
    const report = buildWeeklyReport([submission({ scorePercentage: 80 })], sinceIso, { skillMap: skillMapFixture() }, now);
    expect(report.subSkills.strengths).toEqual(['Algebra', 'Percentages']);
    expect(report.subSkills.weaknesses).toEqual(['Ratio', 'Fractions']);
    expect(report.attentive).toBeNull();
  });

  it('carries the founder attentiveness check through when set', () => {
    const report = buildWeeklyReport([submission({ scorePercentage: 80 })], sinceIso, { attentive: true }, now);
    expect(report.attentive).toBe(true);
  });
});

describe('buildScoreTrend', () => {
  it('buckets four weeks with averages, oldest first, null for empty weeks', () => {
    const trend = buildScoreTrend(
      [
        { scorePercentage: 80, submittedAt: '2026-08-12T09:00:00Z' },
        { scorePercentage: 60, submittedAt: '2026-08-20T09:00:00Z' },
        { scorePercentage: 70, submittedAt: '2026-08-25T09:00:00Z' },
        { scorePercentage: 90, submittedAt: '2026-09-05T09:00:00Z' },
      ],
      sinceIso,
      now
    );
    expect(trend).toHaveLength(4);
    expect(trend.map((point) => point.averageScore)).toEqual([80, 60, 70, 90]);
    expect(trend[0].label).toBe('10 Aug');
  });

  it('shows null for a week with no submissions', () => {
    const trend = buildScoreTrend([{ scorePercentage: 90, submittedAt: '2026-09-05T09:00:00Z' }], sinceIso, now);
    expect(trend.map((point) => point.averageScore)).toEqual([null, null, null, 90]);
  });
});

describe('subSkillHighlights', () => {
  it('returns empty lists for an empty map', () => {
    expect(subSkillHighlights(null)).toEqual({ strengths: [], weaknesses: [] });
    expect(subSkillHighlights({})).toEqual({ strengths: [], weaknesses: [] });
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
    report: buildWeeklyReport(
      [submission({ scorePercentage: 80, topic: 'Fractions', difficulty: 'standard' })],
      sinceIso,
      { skillMap: skillMapFixture(), attentive: true },
      now
    ),
    brand: { name: 'Jedidiah', accent: '#1A3D2E' },
  };

  it('renders the brand wordmark, student name, note and a score', () => {
    const { html } = renderWeeklyReportHtml(data);
    expect(html).toContain('Jedidiah');
    expect(html).toContain('Aisha Ade');
    expect(html).toContain('Great week on fractions.');
    expect(html).toContain('80%');
  });

  it('renders the enriched proof sections: trend, difficulty, topics, sub-skills, attentive', () => {
    const { html } = renderWeeklyReportHtml(data);
    expect(html).toContain('Score trend');
    expect(html).toContain('Practised at');
    expect(html).toContain('>Standard<');
    expect(html).toContain('Fractions');
    expect(html).toContain('Sub-skill mastery');
    expect(html).toContain('Strengths');
    expect(html).toContain('To work on');
    expect(html).toContain('Algebra');
    expect(html).toContain('Attentive across this week');
  });

  it('omits the attentive line and mastery section when unmarked or empty', () => {
    const { html } = renderWeeklyReportHtml({
      ...data,
      report: buildWeeklyReport([submission({ scorePercentage: 80 })], sinceIso, {}, now),
    });
    expect(html).not.toContain('Attentive across this week');
    expect(html).not.toContain('needs monitoring');
    expect(html).not.toContain('Sub-skill mastery');
  });

  it('escapes free text so a note cannot inject HTML into the PDF', () => {
    const { html } = renderWeeklyReportHtml({ ...data, tutorNote: '<script>alert(1)</script> blame "no" \'quotes\'' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});