import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function MockAnthropic() {
    return { messages: { create: mockCreate } };
  }),
}));

const { markExtendedPart } = await import('@/lib/marking/tier2');

function mockTextResponse(body: { marks_awarded: number; reasoning: string; confidence: string }) {
  return { content: [{ type: 'text', text: JSON.stringify(body) }] };
}

const baseInput = {
  questionText: 'Explain why the reaction is exothermic.',
  marks: 3,
  markScheme: { M1: 'method', A1: 'accuracy', common_error: 'confuses endo/exothermic', allow: 'equivalent wording' },
  studentAnswer: 'Because energy is released to the surroundings.',
};

describe('markExtendedPart', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns the parsed result with needs_review false for high confidence', async () => {
    mockCreate.mockResolvedValue(mockTextResponse({ marks_awarded: 2, reasoning: 'Met M1 and A1.', confidence: 'high' }));
    const result = await markExtendedPart(baseInput, new AbortController().signal);
    expect(result).toEqual({ marks_awarded: 2, reasoning: 'Met M1 and A1.', confidence: 'high', needs_review: false });
  });

  it('sets needs_review true for low confidence', async () => {
    mockCreate.mockResolvedValue(mockTextResponse({ marks_awarded: 0, reasoning: 'Ambiguous answer.', confidence: 'low' }));
    const result = await markExtendedPart(baseInput, new AbortController().signal);
    expect(result.needs_review).toBe(true);
  });

  it('leaves needs_review false for medium confidence', async () => {
    mockCreate.mockResolvedValue(mockTextResponse({ marks_awarded: 1, reasoning: 'Partial credit.', confidence: 'medium' }));
    const result = await markExtendedPart(baseInput, new AbortController().signal);
    expect(result.needs_review).toBe(false);
  });

  it('clamps marks_awarded above the maximum', async () => {
    mockCreate.mockResolvedValue(mockTextResponse({ marks_awarded: 99, reasoning: 'x', confidence: 'medium' }));
    const result = await markExtendedPart(baseInput, new AbortController().signal);
    expect(result.marks_awarded).toBe(3);
  });

  it('clamps a negative marks_awarded to zero', async () => {
    mockCreate.mockResolvedValue(mockTextResponse({ marks_awarded: -5, reasoning: 'x', confidence: 'medium' }));
    const result = await markExtendedPart(baseInput, new AbortController().signal);
    expect(result.marks_awarded).toBe(0);
  });

  it('throws when the response has no text content', async () => {
    mockCreate.mockResolvedValue({ content: [] });
    await expect(markExtendedPart(baseInput, new AbortController().signal)).rejects.toThrow('no text content');
  });
});
