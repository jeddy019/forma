import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import { EmptyState } from '@/lib/ui/EmptyState';
import { LayoutTemplate } from 'lucide-react';
import TemplateForm from './TemplateForm';
import DeleteTemplateForm from './DeleteTemplateForm';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface TemplateRow {
  id: string;
  name: string;
  subject: string | null;
  difficulty: string | null;
  notes: string | null;
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Permissions Summary: templates are a tutor-pro entitlement, same gate
  // as the marking dashboard and mark scheme PDFs.
  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Templates</h1>
        <p className="text-sm text-[#5C5849]">Templates are available on the Tutor plan.</p>
      </div>
    );
  }

  const {
    data: templates,
    count,
    error,
  } = await supabase
    .from('templates')
    .select('id, name, subject, difficulty, notes', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<TemplateRow[]>();

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Templates</h1>
        <p className="text-sm text-[#5C5849]">Save a topic prompt once, reuse it from the generate page.</p>
      </div>

      <TemplateForm />

      <div className="flex flex-col gap-3">
        {error && <p className="text-sm text-[#C0392B]">Could not load templates - please refresh.</p>}
        {!error && templates?.length === 0 && (
          <EmptyState icon={LayoutTemplate} message="No templates yet - save your first one above." />
        )}
        {templates?.map((template) => (
          <div key={template.id} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#1A1A18]">{template.name}</p>
              <div className="flex gap-1.5 mt-1">
                {template.subject && (
                  <span className="text-xs bg-[#E8F2ED] text-[#1A3D2E] rounded-full px-2.5 py-1">{template.subject}</span>
                )}
                {template.difficulty && (
                  <span className="text-xs bg-[#E8F2ED] text-[#1A3D2E] rounded-full px-2.5 py-1">{template.difficulty}</span>
                )}
              </div>
              {template.notes && <p className="text-xs text-[#5C5849] mt-2 max-w-md">{template.notes}</p>}
            </div>
            <DeleteTemplateForm templateId={template.id} />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
          {page > 1 && (
            <a href={`/dashboard/templates?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
              Previous
            </a>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/dashboard/templates?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
