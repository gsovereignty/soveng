import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Article, Profile } from "@/types/nostr"
import { formatTimestamp } from "@/lib/formatTimestamp"
import { npubEncode } from "nostr-tools/nip19"

// Derive a 1–2 char monogram for the avatar fallback.
// Uses display name initials when available; falls back to npub/hex prefix.
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

interface ArticleCardProps {
  article: Article
  profile: Profile | undefined // undefined while kind:0 not yet resolved
}

export function ArticleCard({ article, profile }: ArticleCardProps) {
  // --- Title fallback (DISP-01) ---
  // article.d is NOT user-friendly; never use it as fallback.
  const displayTitle =
    article.title?.trim() ||
    article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80) ||
    "(untitled)"

  // --- Author name fallback chain (DISP-02) ---
  // display_name from kind:0 → truncated npub (with try/catch per T-03-04)
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
    <Card
      className={cn(
        "border-terminal-border bg-terminal-surface w-full",
      )}
    >
      <CardContent className="p-4 font-mono text-sm">
        {/* Title row (DISP-01) — all untrusted text rendered as React text children */}
        <div className="crt-glow text-terminal-green font-semibold leading-snug mb-2">
          {displayTitle}
        </div>

        {/* Metadata row: avatar + author name + timestamp (DISP-02, DISP-03) */}
        <div className="flex items-center gap-2 text-xs text-terminal-green-dim">
          {/* Avatar (D-04/D-05/D-06) — AvatarFallback handles broken/missing pictures */}
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage
              src={profile?.picture}
              alt={displayName}
              className="grayscale brightness-75 sepia hue-rotate-90 saturate-200"
            />
            <AvatarFallback
              className={cn(
                "bg-terminal-surface border border-terminal-border",
                "text-terminal-green-dim text-[10px]",
              )}
            >
              {monogram}
            </AvatarFallback>
          </Avatar>

          {/* Author display name (or truncated-npub fallback) */}
          <span className="truncate max-w-[12rem]">{displayName}</span>

          {/* Separator */}
          <span className="text-terminal-muted select-none">/</span>

          {/* Timestamp (DISP-03) — formatTimestamp takes ms epoch */}
          <span className="text-terminal-muted shrink-0">
            {formatTimestamp(article.publishedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
