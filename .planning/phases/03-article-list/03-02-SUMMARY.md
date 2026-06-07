---
phase: 03-article-list
plan: 02
subsystem: ui
tags: [react, shadcn, nostr-tools, tailwind, streaming, boot-sequence]

# Dependency graph
requires:
  - phase: 03-01
    provides: ArticleCard (article, profile props), formatTimestamp, shadcn Avatar
  - phase: 02-data-layer
    provides: useNostr() hook with articles/profiles/status, NostrContext, NostrStatus type
provides:
  - src/components/ArticleList.tsx — streaming status line + arrival-order ArticleCard map
  - src/App.tsx (modified) — boot-then-stream branch logic wiring ArticleList into has-articles path
affects:
  - Phase 4 (hashtag sidebar + click-to-expand build on top of ArticleList/ArticleCard)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Boot-then-stream: BootSequence shown only while streaming && articles.length === 0; else ArticleList
    - Live status line: conditional render of streaming-count vs done-count above card list
    - Profile upgrade-in-place: profiles.get(article.pubkey) passed directly (possibly undefined); no loading gate
    - Arrival-order rendering: articles mapped in given order, no .sort() call

key-files:
  created:
    - src/components/ArticleList.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "Boot-then-stream (D-01): BootSequence guarded by articles.length === 0 — first article triggers list view"
  - "Streaming status line (D-02): conditional > streaming… N/21 received vs > ready — N articles loaded"
  - "No loadingProfiles gate — cards render immediately with monogram fallback, upgrade in place when kind:0 arrives"
  - "Error/empty retry branches preserved exactly from Phase 2 (DISP-05 no-regression)"

requirements-completed: [DISP-01, DISP-02, DISP-03, DISP-05]

# Metrics
duration: ~1min
completed: 2026-06-07
---

# Phase 03 Plan 02: ArticleList + App Wiring Summary

**ArticleList component + App.tsx boot-then-stream wiring: real Nostr articles render end-to-end with live streaming status, arrival-order cards, and preserved error/empty/retry states**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-06-07T08:47:09Z
- **Completed:** 2026-06-07T08:48:50Z
- **Tasks:** 2
- **Files modified:** 1 created, 1 modified

## Accomplishments

- `ArticleList` component: slim streaming status line above card list (D-02); maps articles in arrival order to `<ArticleCard>` components (D-03); passes `profiles.get(article.pubkey)` for upgrade-in-place (no loading gate)
- `App.tsx` wired: boot-then-stream branch logic (D-01) — `BootSequence` only while `streaming && articles.length === 0`; else renders `ArticleList`; debug `<pre>` removed
- Phase 2 error/empty/retry states preserved exactly — DISP-05 distinct states confirmed by grep
- `npm run build` exits 0; all 39 Vitest tests still pass; all key-link greps verified

## Task Commits

Each task was committed atomically:

1. **Task 1: ArticleList component** - `b4f1973` (feat)
2. **Task 2: App.tsx wiring** - `077abf1` (feat)

## Files Created/Modified

- `src/components/ArticleList.tsx` — streaming/done status line + arrival-order `ArticleCard` map with `profiles.get()` lookup
- `src/App.tsx` — added `ArticleList` import; destructured `profiles` from `useNostr()`; replaced debug `<pre>` with boot-then-stream branch logic

## Decisions Made

- Boot-then-stream guard `status === "streaming" && articles.length === 0` exactly matches D-01 spec: first `ARTICLE_RECEIVED` swaps from boot to live list
- No `loadingProfiles` gate per Phase 2 D-08/D-09 lock: `profiles.get()` returns `undefined` before kind:0 resolves; `ArticleCard` handles this with monogram fallback
- Error and empty branches kept verbatim — copy, classes, and retry button logic untouched (DISP-05)
- Status line uses HTML entity `&#x2026;` (ellipsis) and `&#x2014;` (em dash) for streaming and done lines respectively

## Deviations from Plan

None — plan executed exactly as written. Both task actions were straightforward; no blocking issues, no architectural deviations.

## Threat Surface Scan

No new security-relevant surface introduced:

- T-03-05 (XSS): mitigated — `ArticleList` passes typed props only; all untrusted string rendering delegated to `ArticleCard` (Plan 01, React text children)
- T-03-06 (malformed count): `articles.length` is a number from the frozen Phase 2 array, rendered as a numeric React child
- T-03-07 (regression drop of error/empty state): mitigated — `retry connection` and `retry fetch` strings confirmed present via grep; CRT wrapper confirmed present

## Known Stubs

None — `ArticleList` has no hardcoded placeholder data. The status line strings are functional runtime values (`articles.length` is live). All `ArticleCard` fallbacks are functional (title chain, monogram, truncated-npub).

## Self-Check

Files exist:
- `src/components/ArticleList.tsx` — created
- `src/App.tsx` — modified

Commits exist:
- `b4f1973` — feat(03-02): build ArticleList with streaming status line and card mapping
- `077abf1` — feat(03-02): wire ArticleList into App.tsx with boot-then-stream branch logic

Build: `npm run build` exits 0.
Tests: 39/39 passing.
Key-link greps: `<ArticleList` in App.tsx, `<ArticleCard` in ArticleList.tsx, `profiles.get(` in ArticleList.tsx — all confirmed.

## Self-Check: PASSED

---
*Phase: 03-article-list*
*Completed: 2026-06-07*
