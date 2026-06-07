import type { Article, Profile, NostrStatus } from "@/types/nostr"
import { ArticleCard } from "@/components/ArticleCard"
import { cn } from "@/lib/utils"

interface ArticleListProps {
  articles: Article[]
  profiles: Map<string, Profile>
  status: NostrStatus
}

export function ArticleList({ articles, profiles, status }: ArticleListProps) {
  return (
    <div className={cn("w-full max-w-2xl flex flex-col")}>
      {/* Slim streaming status line (D-02) — updates live while streaming, resolves when done */}
      <header className="mb-4">
        {status === "streaming" ? (
          <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
            &gt; streaming&#x2026; {articles.length}/21 received
          </p>
        ) : (
          <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
            &gt; ready &#x2014; {articles.length} articles loaded
          </p>
        )}
      </header>

      {/* Article list — arrival order, no re-sort (D-03) */}
      <div className="flex flex-col gap-2">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            profile={profiles.get(article.pubkey)}
          />
        ))}
      </div>
    </div>
  )
}
