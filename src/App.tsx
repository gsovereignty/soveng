import { useState, useMemo, useEffect } from "react"
import { BootSequence } from "@/components/BootSequence"
import { ArticleList } from "@/components/ArticleList"
import { FilterBar } from "@/components/FilterBar"
import { ContentFilterControls } from "@/components/ContentFilterControls"
import { NostrProvider } from "@/context/NostrContext"
import { useNostr } from "@/context/NostrContext"
import { buildFacets, computeDynamicCounts, filterArticles } from "@/lib/facets"
import { sortArticlesByReplies } from "@/lib/nostr"
import { useClassification } from "@/hooks/useClassification"
import { isHidden } from "@/types/nostr"
import { DEFAULT_SPAM_THRESHOLD } from "@/hooks/useClassification"

// AppShell reads context — must live inside NostrProvider
function AppShell() {
  const { status, articles, profiles, replyCounts, refetch } = useNostr()

  // Local UI filter state — NOT in NostrContext (D-10, Pattern 5)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR') // D-09: default OR

  // ML filter local state — no Zustand (D-11 pattern from Phase 2)
  // CTRL-01: default ON — any value other than literal 'false' is enabled (T-05-LSPARSE)
  const [filterEnabled, setFilterEnabled] = useState<boolean>(() => {
    return localStorage.getItem('soveng:ml-filter-enabled') !== 'false'
  })
  // D-02: default threshold 0.90 — conservative domain-shift guard
  const [spamThreshold, setSpamThreshold] = useState(DEFAULT_SPAM_THRESHOLD)

  // CTRL-04: persist toggle to localStorage on change
  useEffect(() => {
    localStorage.setItem('soveng:ml-filter-enabled', String(filterEnabled))
  }, [filterEnabled])

  // Derived: reply-sorted articles — applied BEFORE faceting and filtering so the
  // entire pipeline operates on the engagement-ranked list
  const sortedArticles = useMemo(
    () => sortArticlesByReplies(articles, replyCounts),
    [articles, replyCounts]
  )

  // Phase 5: ML classification — returns map, version, scores, downloadProgress, modelFailed
  // Hook accepts spamThreshold so the slider drives instant re-thresholding without re-inference (D-02)
  const { map: classificationMap, version: classificationVersion, downloadProgress, modelFailed } =
    useClassification(sortedArticles, spamThreshold)

  // Derived: ML-filtered article list — the single insertion point for all content
  // filtering. Facets and downstream memos switch from sortedArticles to visibleArticles.
  // fail-open: undefined/pending/ham/error → show; spam/non-english/short → hide (SPAM-04)
  // D-06/LEN-01: 'short' articles are always hidden regardless of the toggle (T-05-LENBYPASS)
  // classificationVersion as dep — increments on every map mutation so memo re-evaluates (MLINF-03)
  const visibleArticles = useMemo(() => {
    if (!filterEnabled) {
      // Toggle OFF: only apply always-on length gate (D-06 — editorial rule, not ML)
      return sortedArticles.filter(a => classificationMap.get(a.id) !== 'short')
    }
    // Toggle ON: apply full isHidden allowlist (spam + non-english + short)
    return sortedArticles.filter(a => !isHidden(classificationMap.get(a.id)))
  }, [sortedArticles, classificationVersion, filterEnabled, spamThreshold])

  // Derived: static facet list for display order (D-06) — derives from visibleArticles
  const facets = useMemo(() => buildFacets(visibleArticles), [visibleArticles])

  // Derived: dynamic counts per tag (D-08) — derives from visibleArticles
  const dynamicCounts = useMemo(
    () => computeDynamicCounts(visibleArticles, selectedTags, matchMode),
    [visibleArticles, selectedTags, matchMode]
  )

  // Derived: filtered article list (D-10 — filter is source of truth) — derives from visibleArticles
  // Uses the shared filterArticles helper so the OR/AND semantics stay in sync
  // with computeDynamicCounts (single source of truth — see facets.ts).
  // filterArticles preserves input order so reply-sort is inherited.
  const filteredArticles = useMemo(
    () => filterArticles(visibleArticles, selectedTags, matchMode),
    [visibleArticles, selectedTags, matchMode]
  )

  // Derived: empty-filter state (D-11) — NOT a NostrStatus variant
  const isFilterEmpty = selectedTags.size > 0 && filteredArticles.length === 0

  // CTRL-03: hidden article count surfaced to ContentFilterControls
  const filteredCount = sortedArticles.length - visibleArticles.length

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
            <ContentFilterControls
              filterEnabled={filterEnabled}
              onFilterEnabledChange={setFilterEnabled}
              spamThreshold={spamThreshold}
              onSpamThresholdChange={setSpamThreshold}
              filteredCount={filteredCount}
              downloadProgress={downloadProgress}
              modelFailed={modelFailed}
            />
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
