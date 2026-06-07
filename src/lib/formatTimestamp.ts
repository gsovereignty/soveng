// Pure ms-epoch → "YYYY-MM-DD HH:MM" UTC formatter (D-07, D-08)
// Formatter instance created ONCE at module scope (never per-call) — same singleton
// discipline as src/lib/pool.ts. No external date library — Intl only.
//
// "sv-SE" locale naturally produces ISO-8601-style "YYYY-MM-DD HH:MM:SS" output.
// We slice to 16 chars to drop the seconds portion.

const _fmt = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
})

/**
 * Format a ms-epoch timestamp as "YYYY-MM-DD HH:MM" in UTC.
 *
 * Input: Article.publishedAt (ms epoch; already encodes published_at → created_at fallback).
 * Output: e.g. "2026-06-01 14:32" — log-line terminal ISO absolute format (D-07).
 */
export function formatTimestamp(ms: number): string {
  return _fmt.format(new Date(ms)).slice(0, 16)
}
