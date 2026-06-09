import type { Event } from "nostr-tools/core"
import { naddrEncode } from "nostr-tools/nip19"
import type { Article, Profile } from "@/types/nostr"

export function articleCoordinate(event: Event): string {
  const d = event.tags.find(t => t[0] === "d")?.[1] ?? ""
  return `${event.kind}:${event.pubkey}:${d}`
}

export function parseArticle(event: Event): Article {
  const tags = event.tags
  const d = tags.find(t => t[0] === "d")?.[1] ?? ""
  const title = tags.find(t => t[0] === "title")?.[1]?.trim() || undefined
  const summary = tags.find(t => t[0] === "summary")?.[1]?.trim() || undefined
  const image = tags.find(t => t[0] === "image")?.[1]?.trim() || undefined

  const publishedAtRaw = tags.find(t => t[0] === "published_at")?.[1]
  const publishedAt = publishedAtRaw
    ? parseInt(publishedAtRaw, 10) * 1000
    : event.created_at * 1000

  const hashtags = tags
    .filter(t => t[0] === "t" && t[1])
    .map(t => t[1].toLowerCase().trim())
    .filter(Boolean)

  return {
    id: event.id,
    pubkey: event.pubkey,
    coordinate: articleCoordinate(event),
    d,
    title,
    summary,
    image,
    publishedAt,
    createdAt: event.created_at * 1000,
    content: event.content,
    hashtags,
  }
}

export function parseProfile(event: Event): Profile {
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(event.content)
  } catch {
    // Malformed JSON — fall through to empty object; all fields get undefined fallbacks
  }

  // Untrusted relay input: a profile field may be any JSON type (number, array,
  // object). Optional chaining only guards null/undefined — calling .trim() on a
  // non-string non-nullish value throws a TypeError, which would propagate out of
  // the synchronous reducer dispatch and crash the React update. Guard with typeof.
  const asTrimmedString = (v: unknown): string | undefined =>
    typeof v === "string" ? v.trim() || undefined : undefined

  const displayName =
    asTrimmedString(data.display_name) ??
    asTrimmedString(data.displayName) ??
    asTrimmedString(data.name)

  const picture = asTrimmedString(data.picture)

  return {
    pubkey: event.pubkey,
    displayName,
    picture,
    createdAt: event.created_at,
  }
}

/**
 * Pure terminal-status resolution for the article stream.
 *
 * CR-01: status is derived from the LIVE article count, never a stale closure
 * snapshot. CR-03: callable from both onclose and the backstop timer so a hung
 * relay still resolves the stream.
 *
 *  - any articles received      -> "done"
 *  - no articles, every relay errored -> "error"
 *  - no articles otherwise (timeout/empty) -> "empty"
 */
export function resolveArticleStatus(
  articleCount: number,
  allError: boolean
): "done" | "empty" | "error" {
  if (articleCount > 0) return "done"
  if (allError) return "error"
  return "empty"
}

/**
 * Returns the list of `a` tag values from an event that start with "30023:"
 * (i.e. the kind:30023 article coordinates this event references).
 * Returns an empty array when no such tags exist.
 */
export function referencedArticleCoordinates(event: Event): string[] {
  return event.tags
    .filter(t => t[0] === "a" && t[1]?.startsWith("30023:"))
    .map(t => t[1])
}

/**
 * Returns a NEW array of articles sorted by reply count descending.
 * Ties are broken by publishedAt descending (newer first).
 * Articles absent from replyCounts are treated as 0 replies.
 * Does not mutate the input array.
 */
export function sortArticlesByReplies(
  articles: Article[],
  replyCounts: Map<string, number>
): Article[] {
  return [...articles].sort((a, b) => {
    const countA = replyCounts.get(a.coordinate) ?? 0
    const countB = replyCounts.get(b.coordinate) ?? 0
    if (countB !== countA) return countB - countA
    // Tie-break: newer publishedAt first
    return b.publishedAt - a.publishedAt
  })
}

/**
 * Returns a NIP-19 naddr string for a kind:30023 article.
 * Wraps naddrEncode in a try/catch — malformed pubkey or d-tag returns the
 * stable `article.coordinate` string instead of throwing (T-06-01 mitigation).
 * Relay hints are omitted intentionally (privacy + shorter URLs).
 */
export function articleNaddr(article: Article): string {
  try {
    return naddrEncode({ kind: 30023, pubkey: article.pubkey, identifier: article.d })
  } catch {
    return article.coordinate
  }
}

export function classifyRelayClose(reason: string): "clean" | "error" {
  if (
    reason.includes("eose") ||
    reason.includes("closed by caller") ||
    reason.includes("effect cleanup") ||
    reason.includes("backstop timer")
  ) return "clean"
  return "error"
}
