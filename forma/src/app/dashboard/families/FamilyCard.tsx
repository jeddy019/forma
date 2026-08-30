'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { KeyRound, Pencil, Trash2, Users } from 'lucide-react';
import {
  addFamilyMemberAction,
  deleteFamilyAction,
  removeFamilyMemberAction,
  updateFamilyAction,
  provisionParentPortalLoginAction,
  resetParentPortalLoginAction,
  type FamilyActionResult,
  type ParentPortalCredentialResult,
} from './actions';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui/formStyles';
import PortalCredentialBox from '@/lib/ui/PortalCredentialBox';
import { EmptyState } from '@/lib/ui/EmptyState';
import { familyMonthlyPriceLabel } from '@/lib/payments/familyPricing';

// W4 family plan: one family card on the Families page. Data-display card
// (plain cardClass - the "Add a family" form owns the page's gold rail).
// Shows the parent contact, the children in the family, the monthly tier
// derived from the child count, and the manage controls: add/remove
// children (capped at 3), edit the name/email, delete the family.
//
// W8 Wave B slice 2: the card also carries the parent-portal provisioning
// control (issue/reset the parent's /parent/login credentials, shown once
// through the shared PortalCredentialBox) - the parent portal is the family
// customer's view-only proof surface, so its credentials live here, next to
// the family they belong to.
export default function FamilyCard({
  familyId,
  name,
  parentEmail,
  members,
  unassignedStudents,
  portalAccount,
}: {
  familyId: string;
  name: string;
  parentEmail: string | null;
  members: { studentId: string; name: string }[];
  unassignedStudents: { id: string; name: string }[];
  portalAccount: { username: string; password_reset_at: string | null } | null;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [portalCreds, setPortalCreds] = useState<{ username: string; password: string } | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const [editState, editAction, editPending] = useActionState<FamilyActionResult, FormData>(
    (_prevState, formData) => updateFamilyAction(familyId, _prevState, formData),
    {}
  );

  const priceLabel = familyMonthlyPriceLabel(members.length);
  const atCap = members.length >= 3;
  const remaining = members.length >= 3 ? 0 : 3 - members.length;
  const availableStudents = unassignedStudents;

  async function run(action: () => Promise<FamilyActionResult>) {
    setMessage(null);
    const result = await action();
    if (result.error) setMessage({ kind: 'error', text: result.error });
    else setMessage({ kind: 'ok', text: 'Saved.' });
  }

  async function handleAdd() {
    if (!selectedStudentId) {
      setMessage({ kind: 'error', text: 'Choose a student to add.' });
      return;
    }
    setAdding(true);
    await run(() => addFamilyMemberAction(familyId, selectedStudentId));
    setAdding(false);
    setSelectedStudentId('');
  }

  async function handleRemove(studentId: string) {
    setRemovingId(studentId);
    await run(() => removeFamilyMemberAction(familyId, studentId));
    setRemovingId(null);
  }

  async function handleDelete() {
    setDeleting(true);
    await run(() => deleteFamilyAction(familyId));
    setDeleting(false);
  }

  async function handlePortal(action: 'issue' | 'reset') {
    setPortalBusy(true);
    setPortalError(null);
    const result: ParentPortalCredentialResult =
      action === 'issue' ? await provisionParentPortalLoginAction(familyId) : await resetParentPortalLoginAction(familyId);
    setPortalBusy(false);
    if (result.error) {
      setPortalError(result.error);
      return;
    }
    setPortalCreds({ username: result.username as string, password: result.password as string });
  }

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#1A1A18]">{name}</h3>
            {priceLabel && (
              <span className="text-xs bg-[#FEF9EC] text-[#1A1A18] border border-[#C8A84B] rounded-full px-2.5 py-1">
                {priceLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-[#9A9080] mt-1">
            {parentEmail ? parentEmail : 'No parent email set yet'}
          </p>
          <p className="text-xs text-[#9A9080] mt-0.5">
            {members.length} of 3 children
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-[#5C5849] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 text-sm text-[#9A9080] hover:text-[#C0392B] transition-colors duration-micro ease-premium disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {editing && (
        <form action={editAction} className="flex flex-col gap-3 border-t border-[#E0D9D0] pt-3">
          <div>
            <label className={labelClass} htmlFor={`family-edit-name-${familyId}`}>
              Family name
            </label>
            <input id={`family-edit-name-${familyId}`} name="name" type="text" maxLength={100} defaultValue={name} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`family-edit-email-${familyId}`}>
              Parent email
            </label>
            <input
              id={`family-edit-email-${familyId}`}
              name="parentEmail"
              type="email"
              maxLength={200}
              defaultValue={parentEmail ?? ''}
              className={inputClass}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={editPending} className={secondaryButtonClass}>
              {editPending ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-[#9A9080] hover:text-[#1A1A18] transition-colors duration-micro ease-premium">
              Cancel
            </button>
          </div>
          {editState.error && <p className="text-sm text-[#C0392B]">{editState.error}</p>}
        </form>
      )}

      <div className="border-t border-[#E0D9D0] pt-3 flex flex-col gap-2">
        <p className="text-sm font-medium text-[#1A1A18]">Children in this family</p>
        {members.length === 0 && <EmptyState icon={Users} message="No children yet - add them below." />}
        {members.map((member) => (
          <div key={member.studentId} className="flex items-center justify-between gap-3">
            <Link
              href={`/dashboard/students/${member.studentId}`}
              className="text-sm text-[#1A1A18] hover:text-[#1A3D2E] transition-colors duration-micro ease-premium"
            >
              {member.name}
            </Link>
            <button
              type="button"
              onClick={() => handleRemove(member.studentId)}
              disabled={removingId === member.studentId}
              className="text-xs text-[#9A9080] hover:text-[#C0392B] transition-colors duration-micro ease-premium disabled:opacity-60 shrink-0"
            >
              {removingId === member.studentId ? 'Removing...' : 'Remove'}
            </button>
          </div>
        ))}
      </div>

      {atCap ? (
        <p className="text-xs text-[#9A9080] italic">This family is full - the family tiers stop at 3 children.</p>
      ) : availableStudents.length === 0 ? (
        <p className="text-xs text-[#9A9080] italic">No more students available - every student is already in a family.</p>
      ) : (
        <div className="border-t border-[#E0D9D0] pt-3 flex flex-col gap-2">
          <label className={labelClass} htmlFor={`family-add-${familyId}`}>
            Add a child {remaining > 0 ? `(${remaining} spot${remaining === 1 ? '' : 's'} left)` : ''}
          </label>
          <div className="flex gap-3">
            <select
              id={`family-add-${familyId}`}
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className={inputClass}
            >
              <option value="">Choose a student...</option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAdd} disabled={adding} className={`${primaryButtonClass} shrink-0`}>
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-[#1A3D2E]' : 'text-[#C0392B]'}`}>{message.text}</p>
      )}

      <div className="border-t border-[#E0D9D0] pt-3 flex flex-col gap-2">
        <p className="text-sm font-medium text-[#1A1A18] flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-[#1A3D2E]" strokeWidth={1.75} aria-hidden="true" />
          Parent portal login
        </p>

        {portalCreds ? (
          <PortalCredentialBox
            username={portalCreds.username}
            password={portalCreds.password}
            loginPath="/parent/login"
            recipient="the family"
            onReset={() => handlePortal('reset')}
            onDone={() => setPortalCreds(null)}
            busy={portalBusy}
          />
        ) : (
          <>
            <p className="text-xs text-[#9A9080]">
              {portalAccount
                ? `Login issued (username ${portalAccount.username}). Resetting mints a new password - the old one stops working immediately.`
                : 'Issue a username and password so the parent can check progress, history, and statements at any time (no email needed).'}
            </p>
            {portalAccount ? (
              <button
                type="button"
                onClick={() => handlePortal('reset')}
                disabled={portalBusy}
                className="self-start text-sm text-[#1A3D2E] hover:text-[#152F23] transition-colors duration-micro ease-premium disabled:opacity-60"
              >
                {portalBusy ? 'Working...' : 'Reset password'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handlePortal('issue')}
                disabled={portalBusy}
                className={`${secondaryButtonClass} self-start`}
              >
                {portalBusy ? 'Working...' : 'Issue login'}
              </button>
            )}
          </>
        )}

        {portalError && <p className="text-sm text-[#C0392B]">{portalError}</p>}
      </div>
    </div>
  );
}