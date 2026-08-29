'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { FAMILY_MAX_CHILDREN, FAMILY_CURRENCY, familyMonthlyPrice } from '@/lib/payments/familyPricing';
import { currentInvoicePeriod, hasInvoiceForPeriod } from '@/lib/invoices/familyBilling';

// Founder model W4 (family plan): server actions for the tutor-only Families
// page. Every action runs an RLS ownership select first - the authenticated
// client + the families_own / family_members_own policies return nothing for
// a family or student that isn't this tutor's own, so each "not found" below
// quietly folds together "doesn't exist" and "isn't yours".

// Security Rule 4 (same limits the student form enforces).
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FamilyActionResult {
  error?: string;
  success?: boolean;
}

// Families are a tutor-only construct (parents never see them - they only
// ever receive the end result, the branded invoice, in W5).
async function requireTutor(): Promise<{ error?: string; userId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { data: ownerRow } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (ownerRow?.role !== 'tutor') {
    return { error: 'Families are available on the Tutor plan.' };
  }
  return { userId: user.id };
}

interface ParsedFamilyForm {
  error?: string;
  values?: { name: string; parentEmail: string };
}

function parseFamilyForm(formData: FormData): ParsedFamilyForm {
  const name = String(formData.get('name') ?? '').trim();
  const parentEmail = String(formData.get('parentEmail') ?? '').trim();

  if (!name) {
    return { error: 'Family name is required.' };
  }
  if (name.length > NAME_MAX_LENGTH) {
    return { error: `Family name must be ${NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (parentEmail && (parentEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(parentEmail))) {
    return { error: 'Please enter a valid parent email, or leave it blank.' };
  }
  return { values: { name, parentEmail } };
}

export async function createFamilyAction(
  _prevState: FamilyActionResult,
  formData: FormData
): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }

  const parsed = parseFamilyForm(formData);
  if (parsed.error || !parsed.values) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase.from('families').insert({
    owner_id: auth.userId,
    name: parsed.values.name,
    parent_email: parsed.values.parentEmail || null,
  });
  if (insertError) {
    console.error('Failed to create family', insertError);
    return { error: 'Could not create this family - please try again.' };
  }

  revalidatePath('/dashboard/families');
  return { success: true };
}

export async function updateFamilyAction(
  familyId: string,
  _prevState: FamilyActionResult,
  formData: FormData
): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(familyId)) {
    return { error: 'Invalid family.' };
  }

  const supabase = await createClient();
  const { data: family } = await supabase.from('families').select('id').eq('id', familyId).maybeSingle();
  if (!family) {
    return { error: 'Family not found.' };
  }

  const parsed = parseFamilyForm(formData);
  if (parsed.error || !parsed.values) {
    return { error: parsed.error };
  }

  const { error: updateError } = await supabase
    .from('families')
    .update({ name: parsed.values.name, parent_email: parsed.values.parentEmail || null })
    .eq('id', familyId);
  if (updateError) {
    console.error('Failed to update family', updateError);
    return { error: 'Could not update this family - please try again.' };
  }

  revalidatePath('/dashboard/families');
  return { success: true };
}

export async function addFamilyMemberAction(familyId: string, studentId: string): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(familyId) || !UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid family or student.' };
  }

  const supabase = await createClient();

  // Both sides must be this tutor's own (the family AND the student) - the
  // RLS policies return nothing otherwise.
  const { data: family } = await supabase.from('families').select('id').eq('id', familyId).maybeSingle();
  const { data: student } = await supabase.from('student_profiles').select('id').eq('id', studentId).maybeSingle();
  if (!family || !student) {
    return { error: 'Family or student not found.' };
  }

  // A student belongs to at most one family.
  const { data: existingLink } = await supabase
    .from('family_members')
    .select('student_id')
    .eq('student_id', studentId)
    .maybeSingle();
  if (existingLink) {
    return { error: 'This student is already in a family.' };
  }

  // The 3-children cap (the DB trigger backs this up - this check exists
  // so the error surfaces as a clear message, not a constraint violation).
  const { data: members } = await supabase
    .from('family_members')
    .select('student_id')
    .eq('family_id', familyId);
  if ((members ?? []).length >= FAMILY_MAX_CHILDREN) {
    return { error: `This family already has ${FAMILY_MAX_CHILDREN} children - the family tiers stop at ${FAMILY_MAX_CHILDREN}.` };
  }

  const { error: insertError } = await supabase.from('family_members').insert({ family_id: familyId, student_id: studentId });
  if (insertError) {
    console.error('Failed to add family member', insertError);
    return { error: 'Could not add this student to the family - please try again.' };
  }

  revalidatePath('/dashboard/families');
  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}

export async function removeFamilyMemberAction(familyId: string, studentId: string): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(familyId) || !UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid family or student.' };
  }

  const supabase = await createClient();
  // RLS (family_members_own) only deletes a row whose family AND student are
  // both the caller's.
  const { error: deleteError } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('student_id', studentId);
  if (deleteError) {
    console.error('Failed to remove family member', deleteError);
    return { error: 'Could not remove this student - please try again.' };
  }

  revalidatePath('/dashboard/families');
  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}

export async function deleteFamilyAction(familyId: string): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(familyId)) {
    return { error: 'Invalid family.' };
  }

  const supabase = await createClient();
  const { data: family } = await supabase.from('families').select('id').eq('id', familyId).maybeSingle();
  if (!family) {
    return { error: 'Family not found.' };
  }

  // family_members rows cascade with the family row.
  const { error: deleteError } = await supabase.from('families').delete().eq('id', familyId);
  if (deleteError) {
    console.error('Failed to delete family', deleteError);
    return { error: 'Could not delete this family - please try again.' };
  }

  revalidatePath('/dashboard/families');
  return { success: true };
}

// W5 invoice-led billing. A family bill is issued for the CURRENT calendar
// month only (see familyBilling.ts's comment on why), with the tier price
// snapshotted from familyPricing.ts at generation time. Nothing student-
// facing ever reads this table - this is the founder's own billing surface.
export async function generateFamilyInvoiceAction(familyId: string): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(familyId)) {
    return { error: 'Invalid family.' };
  }

  const supabase = await createClient();
  const { data: family } = await supabase.from('families').select('id').eq('id', familyId).maybeSingle();
  if (!family) {
    return { error: 'Family not found.' };
  }

  // Price is derived from the CURRENT child count (1-3) - a family with no
  // children has no tier, so there is nothing to invoice.
  const { data: members } = await supabase.from('family_members').select('student_id').eq('family_id', familyId);
  const price = familyMonthlyPrice((members ?? []).length);
  if (price === null) {
    return { error: 'Add 1-3 children to the family before generating an invoice.' };
  }

  const period = currentInvoicePeriod(new Date());

  const { data: existing } = await supabase
    .from('family_invoices')
    .select('period_start')
    .eq('family_id', familyId);
  if (hasInvoiceForPeriod(existing ?? [], period)) {
    return { error: 'An invoice for this month already exists.' };
  }

  const { data: numberResult, error: numberError } = await supabase.rpc('generate_invoice_number');
  if (numberError || !numberResult) {
    console.error('Failed to generate family invoice number', numberError);
    return { error: 'Could not number this invoice - please try again.' };
  }

  // family_invoices_own FOR ALL policy admits the insert (the caller owns the
  // family); RLS is the only thing standing between this and foreign rows.
  const { error: insertError } = await supabase.from('family_invoices').insert({
    family_id: familyId,
    invoice_number: numberResult,
    amount: price,
    currency: FAMILY_CURRENCY,
    status: 'pending',
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
  });
  if (insertError) {
    console.error('Failed to insert family invoice', insertError);
    return { error: 'Could not generate the invoice - please try again.' };
  }

  revalidatePath('/dashboard/families');
  return { success: true };
}

// The founder's soft signal only - a PAID invoice never gates anything for
// the student or the parent (the no-student-paywall invariant), it just
// records that the parent paid the founder directly.
export async function markFamilyInvoicePaidAction(invoiceId: string, note: string): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(invoiceId)) {
    return { error: 'Invalid invoice.' };
  }
  const noteTrimmed = note.trim();
  if (noteTrimmed.length > 200) {
    return { error: 'Payment reference must be 200 characters or fewer.' };
  }

  const supabase = await createClient();
  // family_invoices_own scopes this select to this tutor's own families.
  const { data: invoice } = await supabase
    .from('family_invoices')
    .select('id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!invoice) {
    return { error: 'Invoice not found.' };
  }

  const { error: updateError } = await supabase
    .from('family_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payment_note: noteTrimmed || null })
    .eq('id', invoiceId);
  if (updateError) {
    console.error('Failed to mark invoice paid', updateError);
    return { error: 'Could not mark this invoice as paid - please try again.' };
  }

  revalidatePath('/dashboard/families');
  return { success: true };
}

export async function markFamilyInvoicePendingAction(invoiceId: string): Promise<FamilyActionResult> {
  const auth = await requireTutor();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(invoiceId)) {
    return { error: 'Invalid invoice.' };
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from('family_invoices')
    .select('id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!invoice) {
    return { error: 'Invoice not found.' };
  }

  // Reverting clears both the paid marker and the payment note - an unpaid
  // bill records no payment details by definition.
  const { error: updateError } = await supabase
    .from('family_invoices')
    .update({ status: 'pending', paid_at: null, payment_note: null })
    .eq('id', invoiceId);
  if (updateError) {
    console.error('Failed to mark invoice pending', updateError);
    return { error: 'Could not reverse this invoice - please try again.' };
  }

  revalidatePath('/dashboard/families');
  return { success: true };
}