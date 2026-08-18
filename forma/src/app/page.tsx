import Link from 'next/link';
import { PenLine, FileCheck, TrendingUp } from 'lucide-react';
import { primaryButtonClass, secondaryButtonClass } from '@/lib/ui/formStyles';

// Design System v2: this was previously a bare centred h1 + tagline with no
// nav, no CTA, and nothing communicating what the product actually produces.
// The hero's worksheet mock is built from the PDF spec's own header/question
// styling (badges, mark allocation, working lines) rather than a stock
// image or illustration - the product's own output is the marketing asset,
// per the "the worksheet PDF is the product" principle in CLAUDE.md.
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 max-w-6xl mx-auto w-full">
        <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-playfair)' }}>
          Forma
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-[#5C5849] px-3 py-2 hover:text-[#1A1A18] transition-colors duration-micro ease-premium">
            Log in
          </Link>
          <Link href="/signup" className={primaryButtonClass}>
            Get started free
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-6 md:px-10">
        {/* Hero */}
        <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center py-12 md:py-20">
          <div className="flex flex-col gap-6 animate-fade-up">
            <h1
              className="text-4xl md:text-[48px] leading-[1.1] font-semibold text-[#1A1A18]"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Practice built for your student.
            </h1>
            <p className="text-base md:text-md text-[#5C5849] max-w-md">
              Describe what a student is struggling with. Forma generates a curriculum-aligned worksheet,
              coloured diagrams and all, in minutes, not hours.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/signup" className={primaryButtonClass}>
                Get started free
              </Link>
              <Link href="/login" className={secondaryButtonClass}>
                Log in
              </Link>
            </div>
            <p className="text-xs text-[#9A9080]">3 free worksheets every month. No card required.</p>
          </div>

          <div className="flex justify-center md:justify-end">
            <WorksheetMock />
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto py-12 md:py-16 border-t border-[#E0D9D0]">
          <h2
            className="text-xl md:text-2xl font-semibold text-[#1A1A18] mb-10 text-center"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            One loop. Done properly.
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <Step
              icon={PenLine}
              title="Describe the struggle"
              body="One text box. Naeto is in Year 9 and struggles with fractions, particularly adding different denominators."
            />
            <Step
              icon={FileCheck}
              title="Get the worksheet"
              body="A curriculum-accurate PDF with diagrams and a proper mark scheme, plus a digital version students complete online."
            />
            <Step
              icon={TrendingUp}
              title="Track improvement"
              body="Scores, time taken, and topics mastered - so the next worksheet targets exactly what's still weak."
            />
          </div>
        </section>

        {/* Curriculum strip */}
        <section className="max-w-6xl mx-auto py-12 md:py-16 border-t border-[#E0D9D0] flex flex-col items-center gap-6 text-center">
          <p className="text-xs uppercase tracking-[0.08em] text-[#9A9080]">Curriculum-accurate, wherever your student studies</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['England: KS2, KS3, GCSE, A-Level', 'Canada: Ontario Elementary and Secondary', 'United States: Common Core, AP, SAT, ACT'].map(
              (label) => (
                <span
                  key={label}
                  className="bg-[#E8F2ED] text-[#1A3D2E] text-xs font-medium tracking-[0.02em] rounded-full px-4 py-2"
                >
                  {label}
                </span>
              )
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E0D9D0] px-6 md:px-10 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9A9080]">
          <span>Forma - Practice built for your student.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#5C5849] transition-colors duration-micro ease-premium">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-[#5C5849] transition-colors duration-micro ease-premium">
              Log in
            </Link>
            <Link href="/student/login" className="hover:text-[#5C5849] transition-colors duration-micro ease-premium">
              Student login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ icon: Icon, title, body }: { icon: typeof PenLine; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div className="w-11 h-11 rounded-full bg-[#E8F2ED] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#1A3D2E]" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="text-base font-medium text-[#1A1A18]">{title}</h3>
      <p className="text-sm text-[#5C5849] leading-relaxed max-w-[240px]">{body}</p>
    </div>
  );
}

// A static mock of a real worksheet PDF header + question, built from the
// same tokens as the actual Puppeteer template (see CLAUDE.md's PDF spec) -
// not a screenshot, so it never goes stale, and it renders instantly.
function WorksheetMock() {
  return (
    <div
      className="bg-white border border-[#E0D9D0] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 w-full max-w-sm rotate-1 hover:rotate-0 transition-transform duration-standard ease-premium"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-base font-semibold text-[#1A1A18]" style={{ fontFamily: 'var(--font-playfair)' }}>
          Naeto
        </span>
        <span className="text-[10px] text-[#1A3D2E]" style={{ fontFamily: 'var(--font-playfair)' }}>
          Forma
        </span>
      </div>
      <div className="h-[2px] bg-[#1A3D2E] mb-3" />
      <div className="flex gap-1.5 mb-3">
        {['GCSE', 'Year 10', 'Mathematics'].map((label) => (
          <span
            key={label}
            className="bg-[#E8F2ED] text-[#1A3D2E] rounded-full px-2 py-[3px] text-[9px] font-medium tracking-[0.06em]"
          >
            {label}
          </span>
        ))}
      </div>
      <p className="text-[9px] uppercase tracking-[0.08em] text-[#C8A84B] mb-2">Warm-up</p>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-[#1A3D2E]">Q1</span>
        <span className="text-[10px] text-[#9A9080]">[2]</span>
      </div>
      <p className="text-[11px] text-[#1A1A18] leading-relaxed mb-2">
        Work out the value of x in the equation 3x + 7 = 22. Show your working.
      </p>
      {[0, 1].map((i) => (
        <div key={i} className="h-px bg-[#D0C8BC] mb-2" />
      ))}
      <div className="flex items-baseline justify-between mb-1.5 mt-3">
        <span className="text-[11px] font-semibold text-[#1A3D2E]">Q2</span>
        <span className="text-[10px] text-[#9A9080]">[3]</span>
      </div>
      <div className="flex items-center gap-3">
        <svg width="46" height="36" viewBox="0 0 46 36" role="img" aria-label="right-angled triangle diagram">
          <polygon points="4,32 4,4 42,32" fill="#E8F2ED" stroke="#1A3D2E" strokeWidth="1.5" />
        </svg>
        <p className="text-[11px] text-[#1A1A18] leading-relaxed flex-1">Calculate the length of the hypotenuse.</p>
      </div>
    </div>
  );
}
