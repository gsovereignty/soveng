import type { Article, Profile, NostrStatus } from "@/types/nostr"
import { SidebarRow } from "@/components/SidebarRow"
import { articleNaddr } from "@/lib/nostr"

interface ArticleListProps {
  articles: Article[]
  profiles: Map<string, Profile>
  status: NostrStatus
  onSelectArticle?: (article: Article) => void
  selectedNaddr: string
}

export function ArticleList({ articles, profiles, status, onSelectArticle, selectedNaddr }: ArticleListProps) {
  return (
    <div className="w-full flex flex-col">
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

      {/* Enriched inbox rows — no Accordion (READ-05) */}
      <div className="flex flex-col gap-2">
        {articles.map((article) => (
          <SidebarRow
            key={article.id}
            article={article}
            profile={profiles.get(article.pubkey)}
            selected={articleNaddr(article) === selectedNaddr}
            onSelect={(a) => onSelectArticle?.(a)}
          />
        ))}
      </div>
    </div>
  )
}
