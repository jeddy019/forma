import type { GeneratedWorksheet } from '@/lib/ai/schema';

const MATH_ENGINE_URL = process.env.MATH_ENGINE_URL ?? 'http://localhost:8000';
const MATH_ENGINE_SECRET = process.env.MATH_ENGINE_SECRET ?? '';
const ENGINE_TIMEOUT_MS = 10_000;

interface EngineRequest {
  curriculum: string;
  locale: string;
  difficulty: string;
  year_level: string;
  topic: string;
  question_count: number;
  seed?: number;
}

export async function callMathEngine(params: EngineRequest): Promise<GeneratedWorksheet | null> {
  if (!MATH_ENGINE_SECRET) {
    console.error('[math-engine] MATH_ENGINE_SECRET not configured');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

  try {
    const res = await fetch(`${MATH_ENGINE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MATH_ENGINE_SECRET}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[math-engine] ${res.status}: ${await res.text().catch(() => 'unknown')}`);
      return null;
    }

    return (await res.json()) as GeneratedWorksheet;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[math-engine] Request timed out');
    } else {
      console.error('[math-engine] Connection failed', error);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function matchMathEngineTopic(topic: string): Promise<{ matched_keys: string[]; is_deterministic: boolean }> {
  if (!MATH_ENGINE_SECRET) {
    return { matched_keys: [], is_deterministic: false };
  }

  try {
    const res = await fetch(`${MATH_ENGINE_URL}/match?topic=${encodeURIComponent(topic)}`, {
      headers: { Authorization: `Bearer ${MATH_ENGINE_SECRET}` },
      signal: AbortSignal.timeout(2_000),
    });

    if (!res.ok) return { matched_keys: [], is_deterministic: false };
    return (await res.json()) as { matched_keys: string[]; is_deterministic: boolean };
  } catch {
    return { matched_keys: [], is_deterministic: false };
  }
}
