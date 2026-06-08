---
phase: "05-ml-pipeline-infrastructure"
plan: "05"
subsystem: app-integration
tags: [useClassification, visibleArticles, ml-filter, localStorage, ContentFilterControls, react, wiring]
dependency_graph:
  requires:
    - "05-03 (useClassification hook — map/version/scores/downloadProgress/modelFailed return contract)"
    - "05-04 (ContentFilterControls component — filterEnabled/spamThreshold/filteredCount/downloadProgress/modelFailed props)"
  provides:
    - "App.tsx wired end-to-end: useClassification + visibleArticles + ContentFilterControls"
    - "filterEnabled state (default-on, localStorage-persisted) toggling spam+language gate"
    - "spamThreshold state (default 0.90) driving instant re-thresholding via slider"
    - "visibleArticles memo as the single ML-filter insertion point between sortedArticles and facets"
    - "filteredCount (sortedArticles.length - visibleArticles.length) surfaced to controls"
  affects:
    - "Phase 5 phase complete — integration plan"
tech_stack:
  added: []
  patterns:
    - "visibleArticles as single ML-filter insertion point upstream of facets/dynamicCounts/filteredArticles"
    - "localStorage lazy-initializer with !== 'false' default-on guard (T-05-LSPARSE)"
    - "useEffect localStorage persistence pattern for toggle state (CTRL-04)"
    - "classificationVersion as useMemo dependency to trigger re-evaluation on streaming results"
key_files:
  created: []
  modified:
    - src/App.tsx
key_decisions:
  - "visibleArticles inserted between sortedArticles and facets — facets/dynamicCounts/filteredArticles all derive from post-ML view"
  - "filterEnabled default-on via lazy initializer reading localStorage !== 'false' (CTRL-01, T-05-LSPARSE)"
  - "spamThreshold dep added to visibleArticles memo alongside classificationVersion — ensures slider re-thresholding triggers re-render even if version hasn't incremented"
  - "ContentFilterControls rendered above FilterBar inside the articles branch (not in its own branch)"
  - "filteredCount = sortedArticles.length - visibleArticles.length (full ML-hidden count, not hashtag-filtered)"
requirements-completed: [CTRL-01, CTRL-03, CTRL-04, CTRL-05, LEN-01, MLINF-03, SPAM-04]
duration: "~5min"
completed: "2026-06-08"
---

# Phase 5 Plan 5: App.tsx Integration Summary

**Surgical single-file wiring: useClassification(sortedArticles, spamThreshold) drives a visibleArticles memo inserted between sortedArticles and the three downstream memos, with an on-by-default localStorage-persisted toggle and ContentFilterControls rendered in the articles branch.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-08T06:40:00Z
- **Completed:** 2026-06-08T06:47:33Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `useClassification(sortedArticles, spamThreshold)` called in `AppShell` — pipeline receives the threshold argument enabling instant re-thresholding via `Effect 3` in the hook
- `visibleArticles` useMemo inserted as the single ML-filter insertion point between `sortedArticles` and the three downstream memos; `facets`, `dynamicCounts`, and `filteredArticles` all switched to consume `visibleArticles`
- ML toggle defaults to ON via lazy `localStorage.getItem('soveng:ml-filter-enabled') !== 'false'` initializer; persisted on change via `useEffect`
- `filteredCount = sortedArticles.length - visibleArticles.length` surfaced to `ContentFilterControls`
- `ContentFilterControls` rendered above `FilterBar` inside the articles branch with all seven props wired

## Task Commits

1. **Task 1: Insert visibleArticles memo, ML UI state, and switch downstream memos** - `e1c625d` (feat)

## Files Created/Modified

- `src/App.tsx` — added ML state, useClassification call, visibleArticles memo, downstream memo switch, filteredCount, ContentFilterControls render

## Decisions Made

- `spamThreshold` added to `visibleArticles` dep array alongside `classificationVersion` — guarantees the memo re-evaluates when the threshold slider moves, even when no new results have arrived (classificationVersion may be stale)
- `ContentFilterControls` placed above `FilterBar` so the content gate is visually prominent before the tag facets
- `filteredCount` is the total ML-hidden count (`sortedArticles.length - visibleArticles.length`), not the hashtag-filtered count — aligns with CTRL-03 intent

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new surfaces introduced. `src/App.tsx` is a pure client-side render orchestrator with no network calls, no new auth paths, and no file access patterns. All threat mitigations from the plan's threat model are present in the implementation:

| Threat | Mitigation Implemented |
|--------|----------------------|
| T-05-VISFAIL | `isHidden` allowlist used — only spam/non-english/short hide; all other states show |
| T-05-LSPARSE | `!== 'false'` guard — absent/corrupted key defaults to enabled (default-on) |
| T-05-LENBYPASS | Toggle OFF branch still filters `=== 'short'` — length gate cannot be disabled |

## Known Stubs

None. All props to `ContentFilterControls` are wired from live state:
- `filterEnabled` — real `useState` with localStorage persistence
- `spamThreshold` — real `useState` driving `useClassification`
- `filteredCount` — computed from live memo lengths
- `downloadProgress` and `modelFailed` — from `useClassification` return value

## Verification Results

- `grep -q "useClassification(sortedArticles"` — PASS
- `grep -q "visibleArticles"` — PASS
- `grep -q "buildFacets(visibleArticles)"` — PASS
- `grep -q "computeDynamicCounts(visibleArticles"` — PASS
- `grep -q "filterArticles(visibleArticles"` — PASS
- `grep -q "soveng:ml-filter-enabled"` — PASS
- `grep -q "ContentFilterControls"` — PASS
- `npm run build` — exits 0
- `npm test` — 101/101 tests pass (6 test files, no regressions)

## Self-Check: PASSED

Files exist:
- `src/App.tsx` — modified with useClassification wiring, visibleArticles memo, ContentFilterControls render

Commits exist:
- `e1c625d`: feat(05-05): wire useClassification + visibleArticles into App.tsx
