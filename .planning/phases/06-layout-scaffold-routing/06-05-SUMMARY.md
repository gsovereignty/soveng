---
phase: 06-layout-scaffold-routing
plan: "05"
subsystem: Reading pane polish — scroll-reset + hidden-by-filter notice
tags: [reading-pane, scroll-reset, filter-hidden, clear-filters, read03, read04]
dependency_graph:
  requires: ["06-04"]
  provides: [scroll-reset-key, selectedHiddenByFilter, hiddenByFilter-notice, onClearFilters-prop]
  affects:
    - src/App.tsx
    - src/components/ReadingPaneStub.tsx
tech_stack:
  added: []
  patterns:
    - react-key-scroll-reset
    - derived-boolean-not-state
    - hidden-by-filter-notice
key_files:
  created: []
  modified:
    - src/App.tsx
    - src/components/ReadingPaneStub.tsx
decisions:
  - "key={selectedNaddr} on scroll container div — React remounts on change, scrollTop resets to 0 (P10/READ-03); simplest correct approach, no imperative refs"
  - "selectedHiddenByFilter is a derived const (not useMemo, not new state) — present in sortedArticles but absent from filteredArticles"
  - "onClearFilters reuses setSelectedTags(new Set()) — exact pattern from sidebar [FILTER] empty-list button (single source of clear-filters behavior)"
  - "Hidden-by-filter branch placed before article-present render in ReadingPaneStub — returns early, no state mutation, no hash mutation (Pitfall 3)"
  - "ArticleBody unchanged — rehype-sanitize boundary preserved (Pitfall 8 / T-06-05-01)"
metrics:
  duration: "3 minutes"
  completed: "2026-06-09"
---

# Phase 6 Plan 5: Reading Pane Polish Summary

**One-liner:** Scroll-reset via `key={selectedNaddr}` on the reading pane scroll container (READ-03) and a terminal-styled `[FILTER]` hidden-by-filter notice with a working `> clear filters` restore control (READ-04) — ArticleBody and rehype-sanitize boundary untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scroll-reset the reading pane on article switch (READ-03) | e118ebb | src/App.tsx |
| 2 | Hidden-by-filter notice with restore control (READ-04) | 12ce182 | src/App.tsx, src/components/ReadingPaneStub.tsx |

## What Was Built

**Task 1 — Scroll-reset (READ-03):**
- Added `key={selectedNaddr}` to the reading pane's inner scroll wrapper `<div className="flex-1 overflow-y-auto h-full">` in App.tsx (line 217)
- When `selectedNaddr` changes, React unmounts and remounts the scroll container, resetting `scrollTop` to 0 naturally (P10)
- Empty string (`selectedNaddr = ''`) is a stable key — placeholder state continues to render correctly
- No imperative refs or `useLayoutEffect` — the `key` approach is the simplest correct solution
- Frozen memo chain (7 useMemos) unchanged; no keying on `selectedArticle?.id`

**Task 2 — Hidden-by-filter notice (READ-04):**
- `selectedHiddenByFilter` derived boolean in App.tsx: `!!selectedArticle && !filteredArticles.some(a => articleNaddr(a) === selectedNaddr)` — true when article resolved via `sortedArticles` fallback only (filter excludes it)
- Two new props added to `ReadingPaneStub`: `hiddenByFilter: boolean` and `onClearFilters: () => void`
- `onClearFilters` wired to `() => setSelectedTags(new Set())` — the exact clear pattern already used by the sidebar `[FILTER]` empty-list button at App.tsx:199
- New branch (d) in `ReadingPaneStub` before the article-present render: when `article` is present AND `hiddenByFilter` is true, renders:
  - `[FILTER] this article is hidden by the current filter` (terminal-muted text)
  - `> clear filters` button with `crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface` styling
  - Centered with `flex flex-col items-center justify-center gap-4`
- No `setSelectedNaddr` in ReadingPaneStub — pane never mutates selection (Pitfall 3)
- No hash mutation — user can undo filter to return to article
- `<ArticleBody content={article.content} />` in state (e) (article-present render) unchanged — READ-01 and rehype-sanitize boundary (Pitfall 8) preserved

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

All threats from the plan's threat model are mitigated:
- T-06-05-01 (Stored XSS via Markdown body): ArticleBody.tsx untouched (`git diff --name-only HEAD src/components/ArticleBody.tsx` returns nothing); body still routes through `<ArticleBody content={article.content} />`; no `dangerouslySetInnerHTML`, no `rehype-raw`, no inline `<Markdown>` call added
- T-06-05-02 (Hidden-by-filter pane/list divergence): `[FILTER]` notice explicitly tells the user the article is filtered and offers a restore control — no silent stale content (Pitfall 3)

No new trust boundaries, network endpoints, auth paths, or schema changes introduced.

## Known Stubs

None — both READ-03 and READ-04 are fully implemented. The article-present state renders the full ArticleBody (from 06-04). No placeholder behavior remains in this plan's scope.

## Self-Check

- [x] `key={selectedNaddr}` appears exactly once in src/App.tsx (on the scroll wrapper div)
- [x] `key={selectedArticle` appears zero times in src/App.tsx
- [x] `useMemo` count in src/App.tsx is still 7 (frozen memo chain)
- [x] `selectedHiddenByFilter` derived in src/App.tsx
- [x] `hiddenByFilter` appears in ReadingPaneStub.tsx (prop type + guard + branch = 3 occurrences)
- [x] "this article is hidden by the current filter" appears exactly once in ReadingPaneStub.tsx
- [x] `onClearFilters` wired in App.tsx and ReadingPaneStub.tsx
- [x] `ArticleBody` appears in ReadingPaneStub.tsx (body render preserved)
- [x] `setSelectedNaddr` does NOT appear in ReadingPaneStub.tsx
- [x] ArticleBody.tsx not modified
- [x] Commits e118ebb and 12ce182 exist
- [x] `npx tsc -b --noEmit` clean
- [x] `npx vitest run` passes — 113 tests in 7 files
- [x] `npx vite build` succeeds

## Self-Check: PASSED
