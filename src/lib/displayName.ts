/**
 * Shared display-name helpers hoisted from ArticleCard.tsx.
 *
 * These pure functions are used by both SidebarRow and ReadingPaneStub to avoid
 * duplicating the getMonogram / displayName logic.
 *
 * nostr-tools import: subpath only per CLAUDE.md.
 */
import { npubEncode } from "nostr-tools/nip19"
import type { Article, Profile } from "@/types/nostr"

/**
 * Derive a 1–2 char monogram for the avatar fallback.
 * Uses display name initials when available; falls back to npub/hex prefix.
 * Copied verbatim from ArticleCard.tsx (behavior-preserving hoist).
 */
export function getMonogram(profile: Profile | undefined, pubkey: string): string {
  const name = profile?.displayName?.trim()
  if (name) {
    const words = name.split(/\s+/).filter(Boolean)
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  // No display name yet — use start of truncated npub
  try {
    return npubEncode(pubkey).slice(5, 7).toUpperCase()
  } catch {
    return pubkey.slice(0, 2).toUpperCase()
  }
}

/**
 * Resolve a display name for an article's author.
 * Priority: profile.displayName → truncated npub (try/catch) → hex prefix.
 * Wraps npubEncode in try/catch per T-03-04 / T-06-06 mitigation.
 * Copied verbatim from ArticleCard.tsx (behavior-preserving hoist).
 */
export function resolveDisplayName(article: Article, profile: Profile | undefined): string {
  const resolvedName = profile?.displayName?.trim()
  if (resolvedName) {
    return resolvedName
  }
  try {
    return npubEncode(article.pubkey).slice(0, 12) + "…"
  } catch {
    return article.pubkey.slice(0, 12) + "…"
  }
}
