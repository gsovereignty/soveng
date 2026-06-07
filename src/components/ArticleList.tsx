import { useState, useEffect, useMemo } from "react"
import type { Article, Profile, NostrStatus } from "@/types/nostr"
import { ArticleCard } from "@/components/ArticleCard"
import { Accordion } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

interface ArticleListProps {
  articles: Article[]
  profiles: Map<string, Profile>
  status: NostrStatus
}

export function ArticleList({ articles, profiles, status }: ArticleListProps) {
  // D-03: single open accordion — controlled value
  const [openId, setOpenId] = useState<string>('')

  // D-10: when filter changes and the open article is excluded from articles,
  // collapse it so nothing is orphaned open
  const articleIds = useMemo(() => new Set(articles.map(a => a.id)), [articles])
  useEffect(() => {
    if (openId && !articleIds.has(openId)) {
      setOpenId('')
    }
  }, [articleIds, openId])

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

      {/* Article accordion — single open (D-03), controlled state with D-10 clear effect */}
      <Accordion
        type="single"
        collapsible
        value={openId}
        onValueChange={setOpenId}
        className="flex flex-col gap-2"
      >
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            profile={profiles.get(article.pubkey)}
          />
        ))}
      </Accordion>
    </div>
  )
}
