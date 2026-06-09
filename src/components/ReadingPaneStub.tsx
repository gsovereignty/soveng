import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ArticleBody } from "@/components/ArticleBody"
import { formatTimestamp } from "@/lib/formatTimestamp"
import type { Article, Profile, NostrStatus } from "@/types/nostr"
import { getMonogram, resolveDisplayName } from "@/lib/displayName"

interface ReadingPaneStubProps {
  article: Article | null
  profile: Profile | undefined
  selectedNaddr: string
  status: NostrStatus
  hiddenByFilter: boolean
  onClearFilters: () => void
  onBack: () => void
}

export function ReadingPaneStub({ article, profile, selectedNaddr, status, hiddenByFilter, onClearFilters, onBack }: ReadingPaneStubProps) {
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

  // (d) Article present but hidden by the active filter — show notice + restore control (READ-04 / Pitfall 3).
  // Do NOT auto-clear selection or mutate the hash — user may undo the filter to return to the article.
  if (article && hiddenByFilter) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 font-mono text-sm">
        <p className="text-terminal-muted">
          [FILTER] this article is hidden by the current filter
        </p>
        <button
          onClick={onClearFilters}
          className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
        >
          &gt; clear filters
        </button>
      </div>
    )
  }

  // (e) Article present — render body (READ-01/D-06).
  // rehype-sanitize boundary is inside ArticleBody — do not modify ArticleBody (Pitfall 8).
  if (!article) return null

  // Title fallback chain (DISP-01) — verbatim from ArticleCard.tsx:35–38
  const displayTitle =
    article.title?.trim() ||
    article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80) ||
    "(untitled)"

  // Author name + monogram via shared displayName helpers (hoisted from ArticleCard)
  const displayName = resolveDisplayName(article, profile)
  const monogram = getMonogram(profile, article.pubkey)

  return (
    <div className="p-6 font-mono">
      {/* MOBILE-02: back control — visible only below md; clears selection without unmounting the list
          (list stays mounted via CSS-visibility swap in App.tsx, so scroll position is preserved).
          Hidden at md+ where the desktop 2-pane split makes it unnecessary. */}
      <button
        onClick={onBack}
        className="md:hidden crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-3 py-1 mb-4 hover:bg-terminal-surface transition-colors cursor-pointer"
      >
        &#x2039; back
      </button>

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
