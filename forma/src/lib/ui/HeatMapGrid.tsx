'use client';

// Phase B Wave 1 (B6): the tutor's class-wide mastery heat map grid. Rows =
// students, columns = sub-skills (union, most-practised first), cells = one
// colour per mastery level. Reuses the exact level classification from
// masteryView.ts (shared with the student bars) so the two views always agree.
// No chart lib - house style, hand-rolled Tailwind + a horizontally
// scrollable table with a sticky student-name column.
import Link from 'next/link';
import type { HeatMap, MasteryLevel } from '@/lib/mastery/masteryView';

const CELL_STYLES: Record<MasteryLevel, { bg: string; fg: string; label: string }> = {
  mastered: { bg: '#1A3D2E', fg: '#FFFFFF', label: 'Mastered' },
  strong: { bg: '#2D6A4F', fg: '#FFFFFF', label: 'Strong' },
  progressing: { bg: '#C8A84B', fg: '#FFFFFF', label: 'Progressing' },
  weak: { bg: '#C0392B', fg: '#FFFFFF', label: 'Needs work' },
};

const NONE_BG = '#EDE8DF';

function legendSwatch(level: MasteryLevel) {
  const s = CELL_STYLES[level];
  return (
    <span key={level} className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: s.bg }} aria-hidden="true" />
      <span className="text-[11px] text-[#5C5849]">{s.label}</span>
    </span>
  );
}

export default function HeatMapGrid({ heatMap }: { heatMap: HeatMap }) {
  if (heatMap.columns.length === 0) {
    return (
      <p className="text-sm italic text-[#9A9080]">
        No mastery data yet - once your students complete worksheets, their progress appears here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 flex-wrap">
        {(['mastered', 'strong', 'progressing', 'weak'] as MasteryLevel[]).map(legendSwatch)}
      </div>

      <div className="overflow-x-auto border border-[#E0D9D0] rounded-[12px]">
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 text-left text-xs font-medium text-[#5C5849] bg-[#F0EBE3] px-3 py-2 border-b border-r border-[#E0D9D0] min-w-[160px]">
                Student
              </th>
              {heatMap.columns.map((col) => (
                <th
                  key={col}
                  className="text-xs font-medium text-[#5C5849] bg-[#F0EBE3] px-2 py-2 border-b border-[#E0D9D0] whitespace-nowrap max-w-[120px] truncate"
                  title={col}
                >
                  {col}
                </th>
              ))}
              <th className="text-xs font-medium text-[#5C5849] bg-[#F0EBE3] px-2 py-2 border-b border-l border-[#E0D9D0]">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {heatMap.students.map((student) => (
              <tr key={student.id} className="border-b border-[#E0D9D0] last:border-b-0">
                <td className="sticky left-0 z-10 bg-[#F7F4EF] px-3 py-2 border-r border-[#E0D9D0]">
                  <Link
                    href={`/dashboard/mastery/${student.id}`}
                    className="text-sm font-medium text-[#1A3D2E] hover:text-[#152F23] hover:underline"
                  >
                    {student.name}
                  </Link>
                </td>
                {heatMap.columns.map((col) => {
                  const level = student.cols[col];
                  if (!level || level === 'none') {
                    return (
                      <td
                        key={col}
                        className="px-2 py-2 text-center"
                        aria-label={`${student.name} - ${col}: no data`}
                        title={`${col} - not practised yet`}
                      >
                        <span className="inline-block w-4 h-4 rounded-[4px]" style={{ backgroundColor: NONE_BG }} />
                      </td>
                    );
                  }
                  const s = CELL_STYLES[level];
                  return (
                    <td
                      key={col}
                      className="px-2 py-2 text-center"
                      aria-label={`${student.name} - ${col}: ${s.label}`}
                      title={`${col} - ${s.label}`}
                    >
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-[10px] font-semibold text-[#FFFFFF]"
                        style={{ backgroundColor: s.bg }}
                      >
                        {level === 'mastered' ? '✓' : level === 'weak' ? '!' : ''}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center text-sm font-medium text-[#1A1A18] border-l border-[#E0D9D0]">
                  {student.overall != null ? `${student.overall}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
