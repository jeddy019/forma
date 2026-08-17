export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteUserAccount } from '@/lib/account/deleteAccount';
import { monthsAgoIso, isInactiveAccount } from '@/lib/account/inactivity';

// Legal Requirements: "Inactive accounts and student data deleted after 24
// months." Runs monthly (vercel.json) - a destructive, low-frequency
// maintenance job, unlike this project's other crons.
//
// "Inactive" (per the user, deciding the previously-undefined policy):
// no worksheet generated AND no login in the last 24 months, checked at
// the owner account level, not per student_profile - an owner who has
// generated anything or signed in recently is left alone entirely, even
// if a specific one of their students individually has old data. The
// actual decision (isInactiveAccount) is a pure, separately unit-tested
// function - see src/lib/account/inactivity.ts.
const INACTIVITY_MONTHS = 24;
const USER_BATCH_SIZE = 200;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoffIso = monthsAgoIso(INACTIVITY_MONTHS);
  const results = { checked: 0, deleted: 0, errors: 0 };

  // Keyset (cursor) pagination, not offset/range - this loop deletes rows
  // from the same table it's paging through. Offset pagination would skip
  // rows: deleting 5 rows from an earlier page shifts every later page's
  // positions up by 5, silently skipping whatever now sits at the old
  // boundary. A cursor on created_at is immune to that since it's not
  // positional.
  let cursorCreatedAt: string | null = null;
  while (true) {
    let query = admin
      .from('users')
      .select('id, email, created_at')
      .order('created_at', { ascending: true })
      .limit(USER_BATCH_SIZE);
    if (cursorCreatedAt) query = query.gt('created_at', cursorCreatedAt);

    const { data: batch, error } = await query;
    if (error) {
      console.error('Failed to query users for inactivity check', error);
      return NextResponse.json({ ...results, error: 'Failed to query users' }, { status: 500 });
    }
    if (!batch || batch.length === 0) break;
    cursorCreatedAt = batch[batch.length - 1].created_at;
    results.checked += batch.length;

    // Anyone with a worksheet generated within the window is active -
    // batch-checked once per page, not once per user, to avoid N+1 queries.
    const batchIds = batch.map((u) => u.id);
    const { data: recentWorksheets } = await admin
      .from('worksheets')
      .select('owner_id')
      .in('owner_id', batchIds)
      .gte('created_at', cutoffIso);
    const recentlyGeneratedOwnerIds = new Set((recentWorksheets ?? []).map((w) => w.owner_id));

    for (const owner of batch) {
      if (recentlyGeneratedOwnerIds.has(owner.id)) continue;

      // Only reached for owners with no recent worksheet - the smaller set
      // in practice, since most active owners are already filtered out
      // above. Supabase's admin auth API has no batch "last sign in since"
      // query, so this part is necessarily per-candidate, not per-batch.
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(owner.id);
      if (authError || !authUser?.user) {
        // Missing/unreachable auth record - never delete on an error. A
        // destructive job must fail closed, not open.
        console.error(`Could not verify auth record for ${owner.id} - skipping, not deleting`, authError);
        results.errors++;
        continue;
      }
      const inactive = isInactiveAccount({
        hasRecentWorksheet: false, // already filtered out above when true
        lastSignInAt: authUser.user.last_sign_in_at,
        accountCreatedAt: owner.created_at,
        cutoffIso,
      });
      if (!inactive) continue;

      try {
        const deleteResult = await deleteUserAccount(admin, owner.id);
        if (deleteResult.success) {
          results.deleted++;
          console.log(`Deleted inactive account ${owner.id} (${owner.email})`);
        } else {
          console.error(`Failed to delete inactive account ${owner.id}`, deleteResult.error);
          results.errors++;
        }
      } catch (deleteError) {
        console.error(`Failed to delete inactive account ${owner.id}`, deleteError);
        results.errors++;
      }
    }

    if (batch.length < USER_BATCH_SIZE) break;
  }

  return NextResponse.json(results, { status: 200 });
}
