import { describe, expect, it } from 'vitest';
import { deriveAssignmentStudentStatus } from '@/lib/assignments/status';

const worksheet = (first_opened_at: string | null) => ({ first_opened_at });

describe('deriveAssignmentStudentStatus', () => {
  it('returns assigned when the worksheet has never been opened and nothing submitted', () => {
    expect(deriveAssignmentStudentStatus(worksheet(null), null)).toBe('assigned');
  });

  it('returns in_progress once opened but before submission', () => {
    expect(deriveAssignmentStudentStatus(worksheet('2026-08-28T09:00:00Z'), null)).toBe('in_progress');
  });

  it('returns submitted once a submission exists but is not tutor-reviewed', () => {
    expect(deriveAssignmentStudentStatus(worksheet('2026-08-28T09:00:00Z'), { tutor_marks_json: null })).toBe('submitted');
  });

  it('returns reviewed once the tutor has marked it', () => {
    expect(deriveAssignmentStudentStatus(worksheet('2026-08-28T09:00:00Z'), { tutor_marks_json: { q1: {} } })).toBe('reviewed');
  });

  it('does not regress to in_progress when an unreviewed submission exists', () => {
    expect(deriveAssignmentStudentStatus(worksheet(null), { tutor_marks_json: null })).toBe('submitted');
  });
});