// Pure subject builder for the family-ready email, extracted so it can be
// unit-tested in isolation (email subjects can't be checked by an integration
// test without hitting Resend). First names only - a parent reading their own
// inbox should recognise their children instantly, and the family documents
// (invoice, weekly report) use the same first-name convention.
//
// Shape decided with the user 2026-08-30:
//   one child:  "Aisha's worksheet is ready"
//   two:        "Aisha and Titilayo's worksheets are ready"
//   three:      "Aisha, Titilayo and Kofi's worksheets are ready"
export function familyReadySubject(entries: { name: string }[]): string {
  const firstNames = entries
    .map((entry) => entry.name.trim().split(/\s+/)[0])
    .filter(Boolean);

  if (firstNames.length === 0) return 'Practice is ready';
  if (firstNames.length === 1) return `${firstNames[0]}'s worksheet is ready`;
  if (firstNames.length === 2) {
    return `${firstNames[0]} and ${firstNames[1]}'s worksheets are ready`;
  }
  // Families cap at THREE children (add-families.sql trigger), so beyond two
  // is exactly three; the helper is defensive beyond the cap regardless.
  const head = firstNames.slice(0, -1).join(', ');
  return `${head} and ${firstNames[firstNames.length - 1]}'s worksheets are ready`;
}