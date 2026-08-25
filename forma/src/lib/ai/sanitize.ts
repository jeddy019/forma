export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// Postgres text/JSONB rejects NUL characters outright ("unsupported Unicode
// escape sequence", SQLSTATE 22P05) and a live generation once crashed the
// worksheet INSERT because the model emitted one inside an answer string.
// LLM output is the only untrusted-ish source of these, so this runs on the
// parsed AI JSON before it touches validation or the database. Deep-walks
// arrays/objects; only NUL is stripped since it is the sole control
// character Postgres text cannot store.
export function stripNulCharacters<T>(value: T): T {
  if (typeof value === 'string') {
    return (value.includes('\u0000') ? value.replace(/\u0000/g, '') : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripNulCharacters(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = stripNulCharacters(entry);
    }
    return out as T;
  }
  return value;
}
