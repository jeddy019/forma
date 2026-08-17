import { describe, expect, it } from 'vitest';
import { computeTopicsCovered } from '@/lib/curriculum/topicsCovered';

describe('computeTopicsCovered', () => {
  it('returns an empty array for no worksheets', () => {
    expect(computeTopicsCovered([])).toEqual([]);
  });

  it('groups worksheets by subject+topic, summing worksheet and question counts', () => {
    const result = computeTopicsCovered([
      { subject: 'Mathematics', topic: 'Fractions', questionCount: 10 },
      { subject: 'Mathematics', topic: 'Fractions', questionCount: 10 },
      { subject: 'Mathematics', topic: 'Algebra', questionCount: 8 },
    ]);
    expect(result).toEqual([
      { subject: 'Mathematics', topic: 'Algebra', worksheetCount: 1, questionCount: 8 },
      { subject: 'Mathematics', topic: 'Fractions', worksheetCount: 2, questionCount: 20 },
    ]);
  });

  it('keeps the same topic name separate across different subjects', () => {
    const result = computeTopicsCovered([
      { subject: 'Mathematics', topic: 'Graphs', questionCount: 10 },
      { subject: 'Physics', topic: 'Graphs', questionCount: 10 },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.subject)).toEqual(['Mathematics', 'Physics']);
  });

  it('sorts by subject then topic, alphabetically', () => {
    const result = computeTopicsCovered([
      { subject: 'Physics', topic: 'Forces', questionCount: 10 },
      { subject: 'Biology', topic: 'Cells', questionCount: 10 },
      { subject: 'Biology', topic: 'Adaptation', questionCount: 10 },
    ]);
    expect(result.map((r) => `${r.subject}:${r.topic}`)).toEqual(['Biology:Adaptation', 'Biology:Cells', 'Physics:Forces']);
  });

  it('handles a worksheet with zero questions without crashing', () => {
    expect(computeTopicsCovered([{ subject: 'Mathematics', topic: 'Fractions', questionCount: 0 }])).toEqual([
      { subject: 'Mathematics', topic: 'Fractions', worksheetCount: 1, questionCount: 0 },
    ]);
  });
});
