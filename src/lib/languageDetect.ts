import { francAll } from "franc-min"

export type LanguageResult = "english" | "non-english" | "undetermined"

// Minimum chars of stripped text required for reliable franc detection.
// Below this threshold → 'undetermined' (fail-open, article shown).
// Source: PITFALLS.md Pitfall 4 — short/code-heavy text causes mis-detection.
const MIN_DETECT_CHARS = 200

// Minimum confidence required to trust the franc result.
// Below this → 'undetermined' (fail-open). 0.75 per D-03.
const MIN_CONFIDENCE = 0.75

// Cap input before regex work to bound processing of hostile multi-MB bodies (T-05-RX).
const MAX_INPUT_CHARS = 20_000

/**
 * Detect article language using franc-min. Strips code blocks, hex-only lines,
 * and URLs before detection to avoid mis-flagging code-heavy Nostr articles
 * (PITFALLS.md Pitfall 4). Returns 'undetermined' for short/ambiguous/code-heavy
 * text and treats it as English (fail-open per D-03).
 *
 * Never classifies on the article title alone — always call with the body text.
 */
export function detectLanguage(text: string): LanguageResult {
  // Cap input to guard against adversarial multi-MB bodies (T-05-RX)
  const capped = text.slice(0, MAX_INPUT_CHARS)
  const stripped = stripNonNatural(capped)

  if (stripped.length < MIN_DETECT_CHARS) return "undetermined"

  const results = francAll(stripped, { minLength: 20 })
  if (!results || results.length === 0) return "undetermined"

  const top = results[0]
  // top is [langCode, confidence] — confidence 1.0 = perfect match
  if (!top || top[1] < MIN_CONFIDENCE) return "undetermined"
  return top[0] === "eng" ? "english" : "non-english"
}

/**
 * Count whitespace-delimited words in text. Used by the caller's 500-word LEN-01 gate.
 * Cheap and synchronous — no Markdown parsing or Nostr-specific logic.
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Strip non-natural-language fragments before passing text to franc-min.
 * Removes triple-backtick code blocks, hex-only lines (≥32 chars), and URLs.
 * All regexes are linear-time (no nested quantifiers) per T-05-RX.
 */
function stripNonNatural(text: string): string {
  return (
    text
      // Strip triple-backtick fenced code blocks (including content between fences)
      // Uses [\s\S]*? for minimal match; the ``` delimiters anchor the extent (linear)
      .replace(/```[\s\S]*?```/g, " ")
      // Strip lines that consist only of hex characters (pubkeys, txids, hashes — ≥32 chars)
      // ^ and $ with gm flag — no nested quantifiers, bounded by line length
      .replace(/^[0-9a-f]{32,}\s*$/gim, " ")
      // Strip URLs (https?:// followed by non-whitespace)
      .replace(/https?:\/\/\S+/g, " ")
      .trim()
  )
}
