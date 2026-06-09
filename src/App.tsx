import { useState, useMemo, useEffect } from "react"
import { BootSequence } from "@/components/BootSequence"
import { ArticleList } from "@/components/ArticleList"
import { FilterBar } from "@/components/FilterBar"
import { ContentFilterControls } from "@/components/ContentFilterControls"
import { ReadingPaneStub } from "@/components/ReadingPaneStub"
import { NostrProvider } from "@/context/NostrContext"
import { useNostr } from "@/context/NostrContext"
import { buildFacets, computeDynamicCounts, filterArticles } from "@/lib/facets"
import { sortArticlesByReplies, articleNaddr } from "@/lib/nostr"
import { cn } from "@/lib/utils"
import { useClassification } from "@/hooks/useClassification"
import { isHidden } from "@/types/nostr"
import { DEFAULT_SPAM_THRESHOLD } from "@/hooks/useClassification"
import type { Article } from "@/types/nostr"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"

// AppShell reads context — must live inside NostrProvider
function AppShell() {
  const { status, articles, profiles, replyCounts, refetch } = useNostr()

  // Local UI filter state — NOT in NostrContext (D-10, Pattern 5)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR') // D-09: default OR

  // Deep-link selection state (LINK-01..03) — initialized synchronously from URL hash
  // P12: slice(1) strips the leading '#'; P13: read on mount via lazy initializer
  const [selectedNaddr, setSelectedNaddr] = useState<string>(
    () => window.location.hash.slice(1) || ''
  )

  // StrictMode-safe hashchange listener (P16) — mirrors useClassification.ts:166–172 exactly
  useEffect(() => {
    const onHashChange = () => setSelectedNaddr(window.location.hash.slice(1) || '')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  // Derived: the currently selected article — the ONLY append to the frozen memo chain (P11).
  // Searches filteredArticles first so filter-hidden articles don't ghost in the reading pane.
  // Falls back to sortedArticles for cold-load (P2) and filter-hidden-selection (P3) cases —
  // the sortedArticles dep makes this reactive: re-evaluates on every ARTICLE_RECEIVED (P2).
  const selectedArticle = useMemo(() => {
    if (!selectedNaddr) return null
    const inFiltered = filteredArticles.find(a => articleNaddr(a) === selectedNaddr)
    if (inFiltered) return inFiltered
    return sortedArticles.find(a => articleNaddr(a) === selectedNaddr) ?? null
  }, [selectedNaddr, filteredArticles, sortedArticles])

  // Derived: whether the selected article exists but is NOT in the filtered list (READ-04 / Pitfall 3).
  // True only when the article resolved via the sortedArticles fallback (i.e. filter excludes it).
  // This is a derived const, not new state — recomputes inline on each render from memo outputs.
  // Note: clearing hashtag tags below restores the article to filteredArticles (in-pane affordance
  // for hashtag-hidden articles); ML-filtered articles can also hide the article — user uses the
  // ML toggle in the sidebar header for that path.
  const selectedHiddenByFilter = !!selectedArticle && !filteredArticles.some(a => articleNaddr(a) === selectedNaddr)

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

  // Selection handler (LINK-01) — drives both local state and the URL hash.
  // The hashchange listener keeps state in sync on browser back/forward.
  function onSelectArticle(article: Article) {
    const naddr = articleNaddr(article)
    setSelectedNaddr(naddr)
    window.location.hash = naddr
  }

  return (
    <div className="crt-scanlines crt-flicker h-screen bg-terminal-bg flex flex-col overflow-hidden">
      {/* Phase 3: progressive boot-then-stream (D-01) */}
      {status === "streaming" && articles.length === 0 ? (
        <BootSequence />
      ) : status === "error" ? (
        <div className="font-mono text-sm p-8">
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
        <div className="font-mono text-sm p-8">
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
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          {/* Left panel: sidebar — pinned controls header + scrolling article list */}
          <ResizablePanel defaultSize="35%" minSize="25%" maxSize="50%">
            {/* MOBILE-01/P14: inner wrapper controls visibility — both panes always mounted
                so list scroll position is preserved on back navigation (Pitfall 14).
                Below md: hidden when an article is selected (reader takes full screen).
                At md+: always visible regardless of selection. */}
            <div className={cn("flex flex-col h-full", selectedNaddr ? "hidden md:flex" : "flex")}>
              {/* Pinned sidebar header: filter controls (D-04) */}
              <div className="shrink-0 px-4 pt-4">
                <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase mb-3">
                  soveng // nostr long-form reader
                </p>
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
              </div>
              {/* Scrolling article list region (P4 — overflow-y-auto on inner div, not ResizablePanel) */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
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
                  <ArticleList articles={filteredArticles} profiles={profiles} status={status} onSelectArticle={onSelectArticle} selectedNaddr={selectedNaddr} />
                )}
              </div>
            </div>
          </ResizablePanel>

          {/* MOBILE-03/P5: drag handle is desktop-only — hidden below md breakpoint */}
          <ResizableHandle withHandle className="hidden md:flex" />

          {/* Right panel: reading pane — ReadingPaneStub drives all states (Plan 03) */}
          <ResizablePanel>
            {/* MOBILE-01/P14: complementary visibility to sidebar — reading pane is visible
                on mobile only when an article is selected; always visible at md+.
                P10/READ-03: key resets scrollTop to 0 when article changes (React remounts on key change) */}
            <div key={selectedNaddr} className={cn("flex-1 overflow-y-auto h-full", selectedNaddr ? "block md:block" : "hidden md:block")}>
              <ReadingPaneStub
                article={selectedArticle ?? null}
                profile={selectedArticle ? profiles.get(selectedArticle.pubkey) : undefined}
                selectedNaddr={selectedNaddr}
                status={status}
                hiddenByFilter={selectedHiddenByFilter}
                onClearFilters={() => setSelectedTags(new Set())}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
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
