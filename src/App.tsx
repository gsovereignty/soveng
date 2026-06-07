import { useState, useMemo } from "react"
import { BootSequence } from "@/components/BootSequence"
import { ArticleList } from "@/components/ArticleList"
import { FilterBar } from "@/components/FilterBar"
import { NostrProvider } from "@/context/NostrContext"
import { useNostr } from "@/context/NostrContext"
import { buildFacets, computeDynamicCounts, filterArticles } from "@/lib/facets"

// AppShell reads context — must live inside NostrProvider
function AppShell() {
  const { status, articles, profiles, refetch } = useNostr()

  // Local UI filter state — NOT in NostrContext (D-10, Pattern 5)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR') // D-09: default OR

  // Derived: static facet list for display order (D-06)
  const facets = useMemo(() => buildFacets(articles), [articles])

  // Derived: dynamic counts per tag (D-08)
  const dynamicCounts = useMemo(
    () => computeDynamicCounts(articles, selectedTags, matchMode),
    [articles, selectedTags, matchMode]
  )

  // Derived: filtered article list (D-10 — filter is source of truth)
  // Uses the shared filterArticles helper so the OR/AND semantics stay in sync
  // with computeDynamicCounts (single source of truth — see facets.ts).
  const filteredArticles = useMemo(
    () => filterArticles(articles, selectedTags, matchMode),
    [articles, selectedTags, matchMode]
  )

  // Derived: empty-filter state (D-11) — NOT a NostrStatus variant
  const isFilterEmpty = selectedTags.size > 0 && filteredArticles.length === 0

  // Tag toggle handler — always creates a new Set (Pitfall 6: Set identity guard)
  function onTagToggle(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) { next.delete(tag) } else { next.add(tag) }
      return next
    })
  }

  return (
    <div className="crt-scanlines crt-flicker min-h-screen bg-terminal-bg flex flex-col items-center justify-center p-8">
      <header className="w-full max-w-2xl mb-6">
        <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
          soveng // nostr long-form reader
        </p>
      </header>
      <main className="w-full max-w-2xl">
        {/* Phase 3: progressive boot-then-stream (D-01) */}
        {status === "streaming" && articles.length === 0 ? (
          <BootSequence />
        ) : status === "error" ? (
          <div className="font-mono text-sm">
            <p className="text-terminal-amber mb-4">
              [ERR] relay connection failed — all relays returned errors
            </p>
            <button
              onClick={refetch}
              className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
            >
              &gt; retry connection
            </button>
          </div>
        ) : status === "empty" ? (
          <div className="font-mono text-sm">
            <p className="text-terminal-muted mb-4">
              [EMPTY] relays responded but no articles found
            </p>
            <button
              onClick={refetch}
              className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
            >
              &gt; retry fetch
            </button>
          </div>
        ) : (
          /* articles.length > 0 — streaming with articles, or done */
          <>
            <FilterBar
              facets={facets}
              dynamicCounts={dynamicCounts}
              selectedTags={selectedTags}
              matchMode={matchMode}
              onTagToggle={onTagToggle}
              onMatchModeChange={setMatchMode}
            />
            {isFilterEmpty ? (
              <div className="font-mono text-sm">
                <p className="text-terminal-muted mb-4">
                  [FILTER] no articles match the selected tags
                </p>
                <button
                  onClick={() => setSelectedTags(new Set())}
                  className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
                >
                  &gt; clear filters
                </button>
              </div>
            ) : (
              <ArticleList articles={filteredArticles} profiles={profiles} status={status} />
            )}
          </>
        )}
      </main>
      <footer className="w-full max-w-2xl mt-6">
        <p className="text-terminal-muted text-xs">
          powered by nostr · built with react + vite · zero backend
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <NostrProvider>
      <AppShell />
    </NostrProvider>
  )
}
