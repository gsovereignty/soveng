/**
 * safeImageUrl — https-only image URL guard (Pitfall 7 / T-06-04-02).
 *
 * Returns `raw` only when it is a non-empty string that, after trim(), starts
 * with "https://". All other inputs — http://, data:, blob:, relative paths,
 * protocol-relative //host/..., empty string, and undefined — return undefined.
 *
 * Intentional: we NEVER upgrade http:// to https:// — the upgraded URL may not
 * resolve, and silently rewriting author-supplied URLs is not our job.
 * See PITFALLS.md Pitfall 7: "do not attempt to upgrade http:// to https://"
 *
 * Dependency-free — no imports needed.
 */
export function safeImageUrl(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  if (!trimmed.startsWith("https://")) return undefined
  return trimmed
}
