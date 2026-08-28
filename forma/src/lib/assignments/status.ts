// Phase B Wave 5 (B73): Assignment loop - per-student lifecycle status.
// Pure derivation so it's unit-testable; the dashboard pages map each
// worksheet's first_opened_at + latest submission through this one function.
//
//   assigned    -> worksheet exists, not yet opened
//   in_progress -> first opened, nothing submitted yet
//   submitted   -> a submission exists, awaiting tutor review
//   reviewed    -> tutor has marked it (tutor_marks_json present)
//
// Mirrors the marking dashboard's own "reviewed" definition
// (submission.tutor_marks_json !== null) rather than inventing a second one.
export type AssignmentStudentStatus = 'assigned' | 'in_progress' | 'submitted' | 'reviewed';

export interface AssignmentWorksheetView {
  first_opened_at: string | null;
}

export interface AssignmentSubmissionView {
  tutor_marks_json: unknown;
}

export function deriveAssignmentStudentStatus(
  worksheet: AssignmentWorksheetView,
  latestSubmission: AssignmentSubmissionView | null
): AssignmentStudentStatus {
  if (latestSubmission) {
    return latestSubmission.tutor_marks_json !== null ? 'reviewed' : 'submitted';
  }
  return worksheet.first_opened_at ? 'in_progress' : 'assigned';
}