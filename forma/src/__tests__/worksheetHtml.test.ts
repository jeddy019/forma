import { describe, it, expect } from 'vitest';
import { renderRichText } from '@/lib/render/richText';
import { renderWorksheetHtml } from '@/lib/render/worksheetHtml';
import type { WorksheetTemplateData } from '@/lib/pdf/worksheet-template';

// The unified HTML renderer replaced the LaTeX microservice path for
// worksheet/mark-scheme PDFs. These tests pin the subject-loophole fixes:
// KaTeX math spans, mhchem chemistry, legacy siunitx shims, fenced code
// blocks (Computer Science), and HTML escaping of AI prose.

const header: WorksheetTemplateData['header'] = {
  studentName: 'Aisha Bello',
  subject: 'Mathematics',
  topic: 'Fractions',
  curriculumBadge: 'GCSE',
  yearOrGradeBadge: 'Year 10',
  alignmentNote: null,
  curriculumLevelForFallback: 'GCSE',
  digitalCode: 'ABC123',
  createdAt: new Date('2026-08-24T09:00:00Z'),
};

describe('renderRichText', () => {
  it('renders inline $...$ math spans through KaTeX', () => {
    const html = renderRichText('Work out $\\dfrac{1}{2} + \\dfrac{1}{3}$');
    expect(html).toContain('katex');
    expect(html).not.toContain('$\\dfrac');
  });

  it('renders \\(...\\) math spans through KaTeX', () => {
    const html = renderRichText('Solve \\(x^2 = 9\\).');
    expect(html).toContain('katex');
  });

  it('escapes prose so raw angle brackets cannot become markup', () => {
    const html = renderRichText('What does <div class="x"> print?');
    expect(html).toContain('&lt;div class=&quot;x&quot;&gt;');
    expect(html).not.toContain('<div class="x">');
  });

  it('converts fenced code into an escaped monospace block (CS subjects)', () => {
    const code = '```python\ndef add(a, b):\n    return a + b\n```';
    const html = renderRichText(`Read this:\n${code}\nWhat is add(2, 3)?`);
    expect(html).toContain('<pre class="code-block"><code>');
    expect(html).toContain('def add(a, b):');
    expect(html).toContain('\n    return a + b');
  });

  it('escapes literal HTML tags inside code fences (HTML/CSS subject)', () => {
    const html = renderRichText('```\n<p>Hello</p>\n```');
    expect(html).toContain('&lt;p&gt;Hello&lt;/p&gt;');
  });

  it('renders mhchemistry \\ce{} via the loaded extension', () => {
    const html = renderRichText('Name \\ce{H2O}.');
    expect(html).toContain('katex');
    expect(html).not.toContain('\\ce{H2O}');
  });

  it('shims legacy siunitx \\si output instead of erroring', () => {
    const html = renderRichText('The speed is $\\si{5}{\\meter\\per\\second}$.');
    expect(html).toContain('katex');
    expect(html.toLowerCase()).not.toContain('undefined');
    expect(html).not.toContain('\\si{5}');
  });

  it('degrades malformed LaTeX to visible text rather than crashing', () => {
    const html = renderRichText('Broken: $\\frac{1$ end.');
    expect(html).toContain('end');
  });
});

describe('renderWorksheetHtml', () => {
  const data: WorksheetTemplateData = {
    header,
    questions: [
      {
        id: 'q1',
        type: 'warm-up',
        parts: [
          {
            part_label: null,
            text: 'Work out $3 + 4$.',
            marks: 2,
            diagram_spec: null,
            working_lines: 4,
          },
          {
            part_label: 'b',
            text: 'Explain your method.',
            marks: 2,
            diagram_spec: { type: 'coordinate_grid', params: '{"xMin":-5,"xMax":5,"yMin":-5,"yMax":5}' },
            working_lines: 3,
          },
        ],
      },
      {
        id: 'q9',
        type: 'challenge',
        parts: [
          { part_label: null, text: 'Challenge part.', marks: 5, diagram_spec: null, working_lines: 6 },
        ],
      },
    ],
  };

  it('includes a cover page, header block and QR block', () => {
    const html = renderWorksheetHtml(data);
    expect(html).toContain('class="cover"');
    expect(html).toContain('Aisha Bello');
    expect(html).toContain('forma.app/s/ABC123');
    expect(html).toContain('<svg');
  });

  it('renders section dividers once at type transitions', () => {
    const html = renderWorksheetHtml(data);
    expect((html.match(/Warm-up/g) ?? []).filter((m: string) => m === 'Warm-up').length).toBeGreaterThanOrEqual(1);
    expect(html).toMatch(/class="label"[^>]*>Challenge</);
  });

  it('shows per-part working lines and per-question totals', () => {
    const html = renderWorksheetHtml(data);
    expect(html).toContain('[4]');
    expect(html).toMatch(/Q1[\s\S]{0,200}?\[4\]/);
  });

  it('switches body font to Fira Code for coding subjects', () => {
    const codingHtml = renderWorksheetHtml({
      ...data,
      header: { ...header, subject: 'Python' },
    });
    expect(codingHtml).toContain("'Fira Code', monospace");
  });

  it('uses the supplied brand for wordmark, marketing line and header', () => {
    const html = renderWorksheetHtml({
      ...data,
      brand: { name: 'Aisha Ade', accent: '#B8963C' },
    });
    expect(html).toContain('Aisha Ade');
    expect(html).toContain('built by Aisha Ade');
    expect(html).toContain('color: #B8963C');
    expect(html).not.toContain('built by Forma');
  });
});
