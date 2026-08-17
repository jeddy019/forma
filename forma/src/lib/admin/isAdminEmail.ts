// Phase 7 Step 42's question bank is explicitly NOT a tutor/parent
// feature: "Questions are written or reviewed by qualified educators (the
// founder and overseas teacher contacts)" (Kumon Methodology) - a small,
// static, trusted list, not a role in the product's normal permission
// system (tutor/parent/student). question_bank's own RLS is "enabled with
// zero policies... only the service-role client ever touches this table"
// (schema.sql) - there is no way for even a real tutor's own account to
// read/write it, by design. Access here is gated by a static env allowlist
// (ADMIN_EMAILS) rather than a new users.role value or DB column, matching
// CRON_SECRET's own "env-gated, not part of the customer permission model"
// pattern elsewhere in this project.
//
// Pure and testable - takes the raw env value as a parameter rather than
// reading process.env itself, same reasoning as isActivePro taking `now`
// as a parameter instead of calling `new Date()` internally.
export function isAdminEmail(email: string | null | undefined, adminEmailsEnv: string | undefined): boolean {
  if (!email) return false;
  const allowlist = (adminEmailsEnv ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}
