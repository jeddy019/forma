import { describe, expect, it, vi } from 'vitest';
import type { AiTutorContext, AiTutorMessage } from '@/lib/quiz/aiTutor';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return { chat: { completions: { create: mockCreate } } };
  }),
}));

const { buildAiTutorMessages, getAiTutorReply, AI_TUTOR_MODEL } = await import('@/lib/quiz/aiTutor');

function sampleContext(): AiTutorContext {
  return {
    questionText: 'Work out $2x + 3 = 11$',
    marks: 3,
    subject: 'Mathematics',
    curriculum: 'GCSE',
    yearLevel: 'Year 10',
    subSkill: 'linear equations',
    studentAnswer: 'x = 7',
    correctAnswer: 'x = 4',
    markScheme: {
      M1: 'Subtracts 3 from both sides',
      A1: 'x = 4',
      common_error: 'Adding 3 instead of subtracting',
      allow: 'x=4',
      worked_solution: ['$2x = 8$', '$x = 4$'],
    },
  };
}

describe('buildAiTutorMessages (B72 AI tutor chat)', () => {
  it('leads with the system prompt then a context message', () => {
    const messages = buildAiTutorMessages(sampleContext(), []);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    const contextText = messages[1].content;
    expect(contextText).toContain('Work out $2x + 3 = 11$');
    expect(contextText).toContain('x = 7');
    expect(contextText).toContain('x = 4');
    expect(contextText).toContain('GCSE');
    expect(contextText).toContain('Year 10');
    expect(contextText).toContain('Adding 3 instead of subtracting');
    expect(messages).toHaveLength(2);
  });

  it('appends the student chat history after the context message', () => {
    const history: AiTutorMessage[] = [
      { role: 'user', content: 'Why was this wrong?' },
      { role: 'assistant', content: 'You added rather than subtracted.' },
      { role: 'user', content: 'How do I do it correctly?' },
    ];
    const messages = buildAiTutorMessages(sampleContext(), history);
    expect(messages).toHaveLength(5); // system + context + 3 history
    expect(messages[2]).toEqual({ role: 'user', content: 'Why was this wrong?' });
    expect(messages[3]).toEqual({ role: 'assistant', content: 'You added rather than subtracted.' });
    expect(messages[4]).toEqual({ role: 'user', content: 'How do I do it correctly?' });
  });

  it('handles a blank student answer with a friendly placeholder', () => {
    const context = { ...sampleContext(), studentAnswer: '   ' };
    const messages = buildAiTutorMessages(context, []);
    expect(messages[1].content).toContain('(blank - no answer given)');
  });
});

describe('getAiTutorReply', () => {
  it('uses the cost-optimised luna model (not the flagship default)', () => {
    expect(AI_TUTOR_MODEL).toBe('gpt-5.6-luna');
  });

  it('returns the reply text from a successful chat completion', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'You added 3 instead of subtracting it.' } }],
    });
    const reply = await getAiTutorReply(sampleContext(), [], new AbortController().signal);
    expect(reply).toBe('You added 3 instead of subtracting it.');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe('gpt-5.6-luna');
  });

  it('throws a clear error when the model declines', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { refusal: 'declined' } }] });
    await expect(getAiTutorReply(sampleContext(), [], new AbortController().signal)).rejects.toThrow('AI tutor declined');
  });

  it('throws a clear error when the response has no text content', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    await expect(getAiTutorReply(sampleContext(), [], new AbortController().signal)).rejects.toThrow('had no text content');
  });
});