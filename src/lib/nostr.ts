import type { Event } from "nostr-tools/core"
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

  const displayName =
    (data.display_name as string | undefined)?.trim() ||
    (data.displayName as string | undefined)?.trim() ||
    (data.name as string | undefined)?.trim() ||
    undefined

  const picture = (data.picture as string | undefined)?.trim() || undefined

  return {
    pubkey: event.pubkey,
    displayName,
    picture,
    createdAt: event.created_at,
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
