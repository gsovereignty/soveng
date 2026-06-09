import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ArticleBody } from "@/components/ArticleBody"
import { formatTimestamp } from "@/lib/formatTimestamp"
import { npubEncode } from "nostr-tools/nip19"
import type { Article, Profile, NostrStatus } from "@/types/nostr"

interface ReadingPaneStubProps {
  article: Article | null
  profile: Profile | undefined
  selectedNaddr: string
  status: NostrStatus
}

// Derive a 1–2 char monogram for the avatar fallback.
// Uses display name initials when available; falls back to npub/hex prefix.
// Copied from ArticleCard.tsx (ArticleCard is deleted in Phase 7).
function getMonogram(profile: Profile | undefined, pubkey: string): string {
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

export function ReadingPaneStub({ article, profile, selectedNaddr, status }: ReadingPaneStubProps) {
  // (a) No selection — placeholder state (D-07/READ-02)
  if (!selectedNaddr) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="font-mono text-sm text-terminal-muted">
          &gt; select an article to read
        </p>
      </div>
    )
  }

  // (b) Selected but unresolved AND still streaming — cold-load loading state (D-08)
  if (!article && status === 'streaming') {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="crt-glow font-mono text-sm text-terminal-green-dim">
          &gt; resolving article from relays&#x2026;
        </p>
      </div>
    )
  }

  // (c) Selected but unresolved AND stream finished — not-found state (D-09)
  // Keyed off status !== 'streaming' (stream lifecycle, not a timer)
  if (!article && status !== 'streaming') {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="font-mono text-sm text-terminal-muted">
          [404] article not found on connected relays
        </p>
      </div>
    )
  }

  // (d) Article present — render the header stub (D-06, no Markdown body)
  // Phase 7 inserts <ArticleBody> below this header — forward-compatible.
  if (!article) return null

  // Title fallback chain (DISP-01) — copied verbatim from ArticleCard.tsx:35–38
  const displayTitle =
    article.title?.trim() ||
    article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80) ||
    "(untitled)"

  // Author name fallback chain (DISP-02) — copied verbatim from ArticleCard.tsx:42–52
  let displayName: string
  const resolvedName = profile?.displayName?.trim()
  if (resolvedName) {
    displayName = resolvedName
  } else {
    try {
      displayName = npubEncode(article.pubkey).slice(0, 12) + "…"
    } catch {
      displayName = article.pubkey.slice(0, 12) + "…"
    }
  }

  const monogram = getMonogram(profile, article.pubkey)

  return (
    <div className="p-6 font-mono">
      {/* Article title */}
      <div className="crt-glow text-terminal-green font-semibold text-base leading-snug mb-3">
        {displayTitle}
      </div>

      {/* Metadata row: avatar + author name + timestamp — copied from ArticleCard.tsx:70–98 */}
      <div className="flex items-center gap-2 text-xs text-terminal-green-dim">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage
            src={profile?.picture}
            alt={displayName}
            className="grayscale brightness-75 sepia hue-rotate-90 saturate-200"
          />
          <AvatarFallback className="bg-terminal-surface border border-terminal-border text-terminal-green-dim text-[10px]">
            {monogram}
          </AvatarFallback>
        </Avatar>
        <span className="truncate max-w-[12rem]">{displayName}</span>
        <span className="text-terminal-muted select-none">/</span>
        <span className="text-terminal-muted shrink-0">{formatTimestamp(article.publishedAt)}</span>
      </div>

      {/* Full article body — Markdown rendered in the reading pane (sanitized). */}
      <div className="mt-6 border-t border-terminal-border pt-6">
        <ArticleBody content={article.content} />
      </div>
    </div>
  )
}
