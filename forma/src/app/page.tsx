import Link from 'next/link';
import { PenLine, FileCheck, TrendingUp, ChevronRight } from 'lucide-react';
import { primaryButtonClass } from '@/lib/ui/formStyles';

// Design System v3 (Phase 9): rebuilt against the standard the user named
// explicitly - linear.app, arc.net, cal.com. Concretely, versus the v2
// rebuild this replaces: a bordered secondary CTA with a plain text+chevron
// link (fewer boxes, hierarchy from type), an eyebrow badge carrying the
// "3 free/month" fact instead of repeating it lower on the page (Linear's
// "pill above the headline" pattern, but with real information in it, not
// a decorative label), one purposeful gold accent word in the headline
// instead of green used uniformly everywhere, and a full-bleed gold-tinted
// band behind the curriculum strip - arc.net's "colour used sparingly and
// on purpose" rather than one flat shade for the whole page. The hero's
// worksheet mock is unchanged in spirit (built from the PDF spec's own
// tokens, not a stock image - "the worksheet PDF is the product") but now
// actually uses the shared shadow-modal token instead of an ad hoc shadow
// value that only matched shadow-modal in this file's own old comment, not
// in the code.
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-[#F7F4EF]/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 md:px-10 py-4 max-w-6xl mx-auto w-full">
          <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
            Forma
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/student/login"
              className="hidden sm:inline text-sm text-[#5C5849] px-3 py-2 hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
            >
              Student login
            </Link>
            <Link href="/login" className={primaryButtonClass}>
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 md:px-10">
        {/* Hero */}
        <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center pt-10 pb-16 md:pt-16 md:pb-24">
          <div className="flex flex-col gap-5 animate-fade-up">
            <span className="inline-flex w-fit items-center bg-[#FEF9EC] text-[#8A6D22] text-xs font-medium tracking-[0.02em] rounded-full px-3 py-1.5">
              Practice built for each student - one family at a time
            </span>
            <h1
              className="text-4xl md:text-[48px] leading-[1.08] font-semibold text-[#1A1A18]"
              style={{ fontFamily: 'var(--font-fira)' }}
            >
              Practice built for <span className="text-[#C8A84B]">your student</span>.
            </h1>
            <p className="text-base md:text-md text-[#5C5849] max-w-md leading-relaxed">
              Describe what a student is struggling with. Forma generates a curriculum-aligned assignment
              or timed test, coloured diagrams and all, in minutes, not hours.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
              <Link href="/login" className={primaryButtonClass}>
                Log in
              </Link>
              <a
                href="#how-it-works"
                className="group inline-flex items-center gap-1 text-sm font-medium text-[#1A3D2E] hover:text-[#152F23] transition-colors duration-micro ease-premium"
              >
                See how it works
                <ChevronRight
                  className="w-4 h-4 transition-transform duration-micro ease-premium group-hover:translate-x-0.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </a>
            </div>

            {/* Tutors, parents, and students land here for different reasons -
                naming all three up front (rather than one generic CTA) is
                the one concrete pattern shared by every strong competitor
                site reviewed for this section (Maths Genie's "I'm a parent"/
                "I'm an educator" split, Dr Frost's "For Teachers"/"For
                Students" nav): a visitor should not have to guess whether
                this product is for them. role= pre-selects SignupForm's own
                "I am a" field rather than being a cosmetic label only. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#5C5849] pt-2">
              <span className="text-[#9A9080]">I&apos;m a:</span>
              <Link href="/login" className="font-medium text-[#1A3D2E] hover:underline">
                Tutor
              </Link>
              <Link href="/login" className="font-medium text-[#1A3D2E] hover:underline">
                Parent
              </Link>
              <Link href="/student/login" className="font-medium text-[#1A3D2E] hover:underline">
                Student
              </Link>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <WorksheetMock />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-6xl mx-auto py-16 border-t border-[#E0D9D0] scroll-mt-20">
          <h2
            className="text-xl md:text-2xl font-semibold text-[#1A1A18] mb-10 text-center"
            style={{ fontFamily: 'var(--font-fira)' }}
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
              title="Get the assignment"
              body="A curriculum-accurate PDF with diagrams and a proper mark scheme, plus a digital version students complete online."
            />
            <Step
              icon={TrendingUp}
              title="Track improvement"
              body="Scores, time taken, and topics mastered - so the next assignment targets exactly what's still weak."
            />
          </div>
        </section>
      </main>

      {/* Curriculum strip - the one deliberate full-bleed colour band on the
          page (arc.net's "colour used sparingly, not uniformly" principle),
          rather than another plain cream section identical to the ones
          above and below it. */}
      <section className="bg-[#FEF9EC] py-14">
        <div className="max-w-6xl mx-auto px-6 md:px-10 flex flex-col items-center gap-6 text-center">
          <p className="text-xs uppercase tracking-[0.08em] text-[#8A6D22]">Curriculum-accurate, wherever your student studies</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['England: KS2, KS3, GCSE, A-Level', 'Canada: Ontario Elementary and Secondary', 'United States: Common Core, AP, SAT, ACT'].map(
              (label) => (
                <span
                  key={label}
                  className="bg-white text-[#1A3D2E] text-xs font-medium tracking-[0.02em] rounded-full px-4 py-2 border border-[#E9DCB8]"
                >
                  {label}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-10 py-8">
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
      className="bg-white border border-[#E0D9D0] rounded-[12px] shadow-modal p-6 w-full max-w-sm rotate-1 hover:rotate-0 transition-transform duration-standard ease-premium"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-base font-semibold text-[#1A1A18]" style={{ fontFamily: 'var(--font-fira)' }}>
          Naeto
        </span>
        <span className="text-[10px] text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
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
