import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '@/lib/utils/concurrency';

describe('mapWithConcurrency', () => {
  it('maps every item and preserves order', async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40]);
  });

  it('never runs more than `limit` tasks at once', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      [1, 2, 3, 4, 5, 6],
      3,
      async (n) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return n;
      }
    );
    expect(peak).toBe(3);
  });

  it('handles an empty input', async () => {
    const result = await mapWithConcurrency([], 3, async (n) => n);
    expect(result).toEqual([]);
  });

  it('clamps limit to at least 1', async () => {
    const result = await mapWithConcurrency([1, 2, 3], 0, async (n) => n);
    expect(result).toEqual([1, 2, 3]);
  });

  it('propagates rejections from the worker', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });
});
