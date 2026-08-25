import { describe, it, expect } from 'vitest';
import { stripHtmlTags, stripNulCharacters } from '@/lib/ai/sanitize';

describe('stripHtmlTags', () => {
  it('removes HTML tags from user input', () => {
    expect(stripHtmlTags('<div>hello</div> world')).toBe('hello world');
  });
});

describe('stripNulCharacters', () => {
  it('strips NUL characters from strings', () => {
    expect(stripNulCharacters('answer\u0000 with a hole')).toBe('answer with a hole');
  });

  it('leaves clean strings untouched (same reference, no copy)', () => {
    const clean = 'perfectly fine';
    expect(stripNulCharacters(clean)).toBe(clean);
  });

  it('deep-walks nested worksheet-shaped objects and arrays', () => {
    const input = {
      subject: 'Mathematics',
      questions: [
        {
          parts: [{ text: 'Solve $x$', answer: '4\u0000', mark_scheme: { M1: 'ok' } }],
        },
      ],
      alignment_note: null,
      marks: 2,
    };
    const output = stripNulCharacters(input);
    expect(output.questions[0].parts[0].answer).toBe('4');
    expect(output.questions[0].parts[0].mark_scheme.M1).toBe('ok');
    expect(output.alignment_note).toBeNull();
    expect(output.marks).toBe(2);
  });

  it('handles arrays of strings and empty structures', () => {
    expect(stripNulCharacters(['a\u0000b', 'c'])).toEqual(['ab', 'c']);
    expect(stripNulCharacters({})).toEqual({});
    expect(stripNulCharacters([])).toEqual([]);
  });
});
