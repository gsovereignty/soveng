---
phase: quick-260607-vqt
plan: 01
subsystem: nostr-data-layer
tags: [nostr, reply-counts, sorting, uncapped-fetch, reducer]
dependency_graph:
  requires: []
  provides:
    - reply-count state (replyCounts Map, seenReplyIds Set in reducer)
    - sortArticlesByReplies pure helper
    - referencedArticleCoordinates pure helper
    - useReplyFetch hook
    - uncapped article stream
  affects:
    - src/context/nostrReducer.ts
    - src/lib/nostr.ts
    - src/hooks/useArticleFetch.ts
    - src/hooks/useReplyFetch.ts
    - src/context/NostrContext.tsx
    - src/App.tsx
    - src/components/ArticleList.tsx
tech_stack:
  added: []
  patterns:
    - batched #a tag subscription (mirrors useProfileFetch D-09)
    - seenReplyIds dedup Set (mirrors seenCoords pattern)
    - reply-sort applied before faceting/filtering (pure pipeline)
key_files:
  created:
    - src/hooks/useReplyFetch.ts
  modified:
    - src/context/nostrReducer.ts
    - src/context/nostrReducer.test.ts
    - src/lib/nostr.ts
    - src/lib/nostr.test.ts
    - src/hooks/useArticleFetch.ts
    - src/context/NostrContext.tsx
    - src/App.tsx
    - src/components/ArticleList.tsx
decisions:
  - "21-cap intentionally removed per user override of CLAUDE.md constraint"
  - "Reply counts use seenReplyIds Set to prevent relay re-delivery inflation (T-vqt-01)"
  - "sortArticlesByReplies applied before buildFacets so facet order reflects engagement rank"
  - "useReplyFetch uses single batched #a subscription with maxWait:5000 (T-vqt-03)"
metrics:
  duration: "~6min"
  completed: "2026-06-07T15:02:46Z"
  tasks_completed: 3
  files_changed: 9
---

# Phase quick-260607-vqt Plan 01: Don't Stop at 21 — Sort by Replies Summary

**One-liner:** Removed the 21-article hard cap and added engagement-ranked sorting via a batched NIP-01 #a reply-count subscription with seenReplyIds dedup.

## What Was Built

### Task 1: Remove 21-cap and add reply-count state + sort helpers (TDD)
**Commit:** `f5da679`

- `src/lib/nostr.ts`: Added `referencedArticleCoordinates(event)` — returns `a` tag values starting with `"30023:"`. Added `sortArticlesByReplies(articles, replyCounts)` — returns a new array sorted by reply count descending, tie-broken by `publishedAt` descending.
- `src/context/nostrReducer.ts`: Added `replyCounts: Map<string, number>` and `seenReplyIds: Set<string>` to `NostrState` and `initialState`. Added `REPLY_RECEIVED` action that deduplicates by event id, filters to known article coordinates, and increments matched counts. Removed the `if (state.articles.length >= 21) return state` freeze guard from `ARTICLE_RECEIVED`.
- Tests: 21 new tests covering `sortArticlesByReplies`, `referencedArticleCoordinates`, `REPLY_RECEIVED` dedup, multi-coordinate increment, unknown coordinate no-op, and `RESET` clearing reply state. Tests verified RED before implementation.

### Task 2: Add useReplyFetch hook and wire uncapped streaming + reply state
**Commit:** `006ff05`

- `src/hooks/useReplyFetch.ts` (new): Opens one batched `#a` subscription for all article coordinates. Dispatches `REPLY_RECEIVED` per referencing event. Uses `maxWait: 5000` for slow-relay tolerance. Effect dependency is `coordinates.join(",")` to avoid array identity churn. Returns cleanup that closes subscription.
- `src/hooks/useArticleFetch.ts`: Removed Effect 2 (the freeze-at-21 watcher that called `subRef.current.close("freeze-at-21")` and dispatched `"done"`). Removed `subRef` since it was only needed by Effect 2. The existing `onclose` handler and 9-second backstop timer still provide the terminal status path.
- `src/context/NostrContext.tsx`: Derives `coordinates` memo from `state.articles` (same `articles` identity dependency as `pubkeys`). Calls `useReplyFetch(coordinates, dispatch)` after `useProfileFetch`. `replyCounts` flows to consumers via `...state` spread in the context value.

### Task 3: Apply reply-sort in App and fix the hardcoded /21 streaming line
**Commit:** `0bfd4b2`

- `src/App.tsx`: Destructures `replyCounts` from `useNostr()`. Adds `sortedArticles` memo via `sortArticlesByReplies(articles, replyCounts)`. Passes `sortedArticles` (not raw `articles`) to `buildFacets`, `computeDynamicCounts`, and `filterArticles` so the entire pipeline operates on the engagement-ranked list.
- `src/components/ArticleList.tsx`: Streaming status line changed from `"> streaming... {n}/21 received"` to `"> streaming... {n} received"`.

## Test Results

```
Test Files  4 passed (4)
     Tests  71 passed (71)
```

71 tests pass including 21 new tests for the reply-count subsystem.

## Verification

- `npx tsc -b --noEmit` — no type errors
- `npx vitest run` — 71 tests, all pass
- Reducer has no `articles.length >= 21` line
- `sortArticlesByReplies` and `referencedArticleCoordinates` exported and tested
- `replyCounts` and `seenReplyIds` present in state and cleared on RESET
- `useArticleFetch` has no freeze-at-21 Effect 2
- Streaming status line shows `{n} received` with no `/21` denominator

## Deviations from Plan

None — plan executed exactly as written.

Note: The removal of the 21-cap deliberately overrides the CLAUDE.md constraint "Article count: Fixed at 21 most recent". This is an intentional user-requested override documented in the plan objective.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-vqt-01: REPLY_RECEIVED count inflation via relay re-delivery | `seenReplyIds` Set deduplicates by `event.id` in reducer |
| T-vqt-03: Hung reply relay | `maxWait: 5000` on reply subscription + cleanup close; counts degrade gracefully |
| T-vqt-04: Uncapped stream hanging UI | Existing `onclose` handler + 9s backstop in `useArticleFetch` still force terminal status |

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

All files confirmed to exist. All commits verified present. No 21-cap line in reducer. REPLY_RECEIVED action implemented. Streaming line shows no `/21` denominator.
