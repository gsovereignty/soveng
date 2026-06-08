---
phase: 04-filtering-inline-reader
plan: "01"
subsystem: filter-ui
tags: [facets, filter, hashtags, shadcn, react-state]
dependency_graph:
  requires:
    - "03-02 (ArticleList + ArticleCard components)"
    - "02-01 (Article type with hashtags[])"
  provides:
    - "buildFacets() and computeDynamicCounts() pure helpers (src/lib/facets.ts)"
    - "FilterBar component (src/components/FilterBar.tsx)"
    - "Filter state wired into App.tsx — selectedTags, matchMode, filteredArticles"
  affects:
    - "src/App.tsx — renders FilterBar and filtered ArticleList"
    - "src/components/ArticleList.tsx — receives filteredArticles instead of all articles"
tech_stack:
  added:
    - "shadcn Checkbox (src/components/ui/checkbox.tsx) — radix-ui unified package"
    - "shadcn ToggleGroup + Toggle (src/components/ui/toggle-group.tsx, toggle.tsx)"
  patterns:
    - "useMemo derivation chain for facets / dynamicCounts / filteredArticles"
    - "New-Set-on-update pattern for Set identity (Pitfall 6)"
    - "ToggleGroup empty-string deselection guard (Pitfall 2)"
    - "TDD RED/GREEN flow for pure helpers"
key_files:
  created:
    - "src/lib/facets.ts"
    - "src/lib/facets.test.ts"
    - "src/components/FilterBar.tsx"
    - "src/components/ui/checkbox.tsx"
    - "src/components/ui/toggle-group.tsx"
    - "src/components/ui/toggle.tsx"
  modified:
    - "src/App.tsx"
decisions:
  - "shadcn CLI placed checkbox/toggle-group files in literal @/ directory in worktree context — moved to src/components/ui/ manually (deviation Rule 3)"
  - "Plain if/else without braces in TS function body causes parse error — used braces (deviation Rule 1)"
  - "CAP=10 for facet show-more toggle (D-07 Claude's discretion)"
  - "ToggleGroup deselection guard: only update when val === 'or' || val === 'all' (Pitfall 2)"
  - "FilterBar header row: filter-by-tag label + AND/OR toggle rendered inline (compact horizontal layout)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-07"
  tasks: 3
  files: 7
---

# Phase 4 Plan 1: Hashtag Facet Filter Vertical Slice Summary

Pure React facet filter delivering count-ranked hashtag checkboxes with live dynamic counts, Match ANY/ALL toggle, and distinct empty-filter state — all wired into App.tsx via local useState + useMemo derivation chain.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Facet logic — buildFacets + computeDynamicCounts (TDD) | 9550d80, ec617d3 | src/lib/facets.ts, src/lib/facets.test.ts |
| 2 | FilterBar component — sticky tags + show-more + AND/OR toggle | 0309f3b | src/components/FilterBar.tsx, checkbox.tsx, toggle-group.tsx |
| 3 | Wire filter state into App.tsx + empty-filter state | bfbb73c | src/App.tsx |

## What Was Built

### src/lib/facets.ts
Two pure named exports over `Article[]`:

- `buildFacets(articles)` — returns `{ tag: string; count: number }[]` sorted by count descending with alphabetical tie-break (D-06). Count is over the full unfiltered article set.
- `computeDynamicCounts(articles, selectedTags, matchMode)` — returns `Map<string, number>` implementing D-08. OR mode: each tag's count = all articles carrying that tag (independent of selection). AND mode: each tag's count = articles carrying the tag AND all other currently-selected tags.

Both functions satisfy the never-misleading-zero invariant for selected tags: in OR mode count is over all articles (>=1 if tag exists), in AND mode a selected tag shows the current filtered result count (>=1 unless all results are excluded, which is the correct signal).

### src/lib/facets.test.ts
11 Vitest tests covering all behaviors: ordering (D-06), alpha tie-break, OR/AND dynamic counts (D-08), AND mode with multiple selections, and never-misleading-zero invariant. All pass.

### src/components/FilterBar.tsx
Fully controlled presentational component. Renders:
- Sticky top bar (`sticky top-0 z-20 bg-terminal-bg border-b border-terminal-border`) — D-01, D-02
- `> filter by tag` terminal-prompt header
- shadcn `Checkbox` rows with live count labels from `dynamicCounts.get(tag)` — D-08
- Show-more toggle past `CAP = 10` via plain `useState showAll` (D-07)
- shadcn `ToggleGroup type="single"` for Match ANY / Match ALL (D-09)
- ToggleGroup `onValueChange` guards empty string: only calls `onMatchModeChange` when `val === 'or' || val === 'all'` — Pitfall 2 guard

### src/App.tsx
Filter state wired into `AppShell`:
- `useState<Set<string>>(new Set())` for `selectedTags`; `useState<'OR'|'AND'>('OR')` for `matchMode`
- `useMemo` chain: `facets` / `dynamicCounts` / `filteredArticles`
- `onTagToggle` always creates `new Set(prev)` before mutating — Set identity guard (Pitfall 6)
- `isFilterEmpty` derived boolean: `selectedTags.size > 0 && filteredArticles.length === 0`
- `FilterBar` rendered at top of articles-exist arm; `ArticleList` receives `filteredArticles`
- `[FILTER]` empty state with `> clear filters` button — distinct from `[ERR]` / `[EMPTY]` (D-11)
- Relay error/empty branches unchanged (NostrStatus untouched, D-11 constraint)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI placed components in wrong directory in worktree context**
- **Found during:** Task 2
- **Issue:** `npx shadcn add checkbox toggle-group` in the worktree resolved `@/` as a literal directory path `@/components/ui/` relative to the worktree CWD, creating files at `<worktree-root>/@/components/ui/` instead of `<worktree-root>/src/components/ui/`.
- **Fix:** Moved checkbox.tsx, toggle-group.tsx, toggle.tsx from `@/components/ui/` to `src/components/ui/` and removed the spurious `@/` directory.
- **Files modified:** src/components/ui/checkbox.tsx, src/components/ui/toggle-group.tsx, src/components/ui/toggle.tsx
- **Commit:** 0309f3b

**2. [Rule 1 - Bug] TypeScript parse error: if/else without braces in function body**
- **Found during:** Task 3 (TypeScript verification)
- **Issue:** `if (next.has(tag)) next.delete(tag) else next.add(tag)` caused TS1005 parse error.
- **Fix:** Added braces: `if (next.has(tag)) { next.delete(tag) } else { next.add(tag) }`
- **Files modified:** src/App.tsx
- **Commit:** bfbb73c

## TDD Gate Compliance

Task 1 followed RED/GREEN TDD cycle:
- RED commit: `9550d80 test(04-01): add failing tests for buildFacets + computeDynamicCounts`
- GREEN commit: `ec617d3 feat(04-01): implement buildFacets and computeDynamicCounts`
- REFACTOR: not needed (clean implementation in first pass)

## Known Stubs

None — all data is live-wired. FilterBar receives actual `dynamicCounts` from `computeDynamicCounts`, `facets` from `buildFacets`, and `filteredArticles` flows to `ArticleList`. No hardcoded values or placeholder text in the filter path.

## Threat Flags

No new security-relevant surface beyond what is documented in the plan threat model. Tag labels are rendered as React text children (JSX), never `dangerouslySetInnerHTML`. Filter state is ephemeral UI-only with no persistence or network surface.

## Verification Results

- `npx vitest run src/lib/facets.test.ts` — 11/11 pass
- `npx tsc -b --noEmit` — 0 errors
- `npm run build` — production build 301.97 kB JS, 62.21 kB CSS, exits 0

## Self-Check

- [x] src/lib/facets.ts exists
- [x] src/lib/facets.test.ts exists
- [x] src/components/FilterBar.tsx exists
- [x] src/components/ui/checkbox.tsx exists
- [x] src/components/ui/toggle-group.tsx exists
- [x] src/App.tsx modified
- [x] Commit 9550d80 (RED test) exists
- [x] Commit ec617d3 (GREEN impl) exists
- [x] Commit 0309f3b (FilterBar) exists
- [x] Commit bfbb73c (App.tsx) exists
