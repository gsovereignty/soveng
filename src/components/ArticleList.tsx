import type { Article, Profile, NostrStatus } from "@/types/nostr"
import { ArticleCard } from "@/components/ArticleCard"
import { Accordion } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

interface ArticleListProps {
  articles: Article[]
  profiles: Map<string, Profile>
  status: NostrStatus
  onSelectArticle?: (article: Article) => void
}

export function ArticleList({ articles, profiles, status, onSelectArticle }: ArticleListProps) {
  // Master-detail: rows are selection-only. The accordion is held permanently
  // collapsed (value="") so the body renders in the reading pane, not inline here.
  return (
    <div className={cn("w-full max-w-2xl flex flex-col")}>
      {/* Slim streaming status line (D-02) — updates live while streaming, resolves when done */}
      <header className="mb-4">
        {status === "streaming" ? (
          <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
            &gt; streaming&#x2026; {articles.length} received
          </p>
        ) : (
          <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
            &gt; ready &#x2014; {articles.length} articles loaded
          </p>
        )}
      </header>

      {/* Selection-only list — accordion forced collapsed (value=""); chevron hidden
          since expansion is disabled (the body now renders in the reading pane). */}
      <Accordion
        type="single"
        collapsible
        value=""
        className="flex flex-col gap-2 [&_[data-slot=accordion-trigger]_svg]:hidden"
      >
        {articles.map((article) => (
          // Outer div captures click for reading-pane selection (LINK-01).
          <div
            key={article.id}
            onClick={() => onSelectArticle?.(article)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectArticle?.(article) }}
            className="cursor-pointer"
          >
            <ArticleCard
              article={article}
              profile={profiles.get(article.pubkey)}
            />
          </div>
        ))}
      </Accordion>
    </div>
  )
}
