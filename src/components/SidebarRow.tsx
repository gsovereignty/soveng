import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Article, Profile } from "@/types/nostr"
import { formatTimestamp } from "@/lib/formatTimestamp"
import { safeImageUrl } from "@/lib/image"
import { getMonogram, resolveDisplayName } from "@/lib/displayName"
import { articleNaddr } from "@/lib/nostr"

interface SidebarRowProps {
  article: Article
  profile: Profile | undefined
  selected: boolean
  onSelect: (article: Article) => void
}

/**
 * SidebarRow — enriched inbox-style row for the article list sidebar (ENRICH-01).
 *
 * Renders: title, avatar + author name + timestamp metadata row, summary snippet,
 * and a thumbnail when a safe https:// image is present.
 *
 * Image hardening (ROW-01 / Pitfall 6/7):
 * - safeImageUrl gates the thumbnail src — only https:// URLs are rendered
 * - referrerPolicy="no-referrer" suppresses the Referer header (T-06-04-01)
 * - loading="lazy" defers off-screen requests (T-06-04-01)
 * - onError hides the element on 404 (T-06-04-03)
 *
 * Selected highlight (ROW-02): aria-current="true" + visually distinct border + tint.
 * No Accordion primitives — plain clickable row (READ-05).
 */
export function SidebarRow({ article, profile, selected, onSelect }: SidebarRowProps) {
  // --- Title fallback (DISP-01) — verbatim from ArticleCard.tsx:35-38 ---
  const displayTitle =
    article.title?.trim() ||
    article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80) ||
    "(untitled)"

  const displayName = resolveDisplayName(article, profile)
  const monogram = getMonogram(profile, article.pubkey)

  // --- Summary snippet ---
  let summaryText: string | undefined
  if (article.summary?.trim()) {
    summaryText = article.summary.trim()
  } else if (article.content) {
    // Minimal strip: collapse whitespace, strip leading Markdown noise, take first 140 chars
    const stripped = article.content
      .replace(/^#+\s+.*/gm, "")         // headings
      .replace(/!\[.*?\]\(.*?\)/g, "")   // images
      .replace(/\[.*?\]\(.*?\)/g, "$1")  // links → keep text
      .replace(/[`*_~]/g, "")            // inline code/bold/italic markers
      .replace(/\s+/g, " ")              // collapse whitespace
      .trim()
    if (stripped.length > 0) {
      summaryText = stripped.slice(0, 140)
    }
  }

  // --- Thumbnail (ROW-01 / Pitfall 6/7) ---
  // safeImageUrl returns undefined for anything that is not a valid https:// URL
  const thumb = safeImageUrl(article.image)

  // --- Selected highlight (ROW-02) ---
  // Use a distinctly brighter border + elevated surface tint + crt-glow when selected
  const naddr = articleNaddr(article)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      data-naddr={naddr}
      onClick={() => onSelect(article)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(article)
        }
      }}
      className={cn(
        "w-full flex flex-row gap-3 p-3 cursor-pointer font-mono",
        "border transition-colors",
        selected
          ? "bg-terminal-surface border-terminal-green crt-glow"
          : "bg-terminal-surface border-terminal-border hover:border-terminal-green-dim"
      )}
    >
      {/* Main content column */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Title */}
        <div
          className={cn(
            "text-sm font-semibold leading-snug truncate",
            selected ? "crt-glow text-terminal-green" : "text-terminal-green"
          )}
        >
          {displayTitle}
        </div>

        {/* Metadata row: avatar + author name + timestamp */}
        <div className="flex items-center gap-2 text-xs text-terminal-green-dim">
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

          <span className="truncate max-w-[12rem]">{displayName}</span>
          <span className="text-terminal-muted select-none">/</span>
          <span className="text-terminal-muted shrink-0">{formatTimestamp(article.publishedAt)}</span>
        </div>

        {/* Summary snippet — only rendered when usable content exists (ENRICH-01) */}
        {summaryText && (
          <p className="text-terminal-green-dim text-xs line-clamp-2 leading-snug">
            {summaryText}
          </p>
        )}
      </div>

      {/* Thumbnail — only rendered when a safe https:// image URL is present (ROW-01) */}
      {thumb && (
        <img
          src={thumb}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          width={48}
          height={48}
          className="w-12 h-12 object-cover shrink-0 border border-terminal-border"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
      )}
    </div>
  )
}
