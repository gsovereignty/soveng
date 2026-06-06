---
phase: 02-nostr-data-layer
plan: "03"
subsystem: data
tags: [nostr, react, typescript, vitest, context, reducer, refetch, retry]

requires:
  - phase: 02-nostr-data-layer
    plan: "02"
    provides: Profile resolution via useProfileFetch, PROFILE_RECEIVED reducer, profiles Map via useNostr()

provides:
  - Regression guard tests: full-reset (seenCoords/articles/profiles cleared, status=streaming, fetchKey+1)
  - Pitfall-3 regression test: previously-seen coordinate accepted again after RESET
  - refetch() confirmed exposed in context value + wired to RESET dispatch
  - Terminal-styled retry affordance on error/empty status in App.tsx
  - error/empty distinction visible in retry UI (D-06)
  - refetch() wired to retry control onClick (D-12)

affects: [03-article-ui]

tech-stack:
  added: []
  patterns:
    - Terminal-styled plain <button> for retry control (no new component file)
    - Ternary status dispatch in AppShell (streaming | error | empty | done branches)

key-files:
  created: []
  modified:
    - src/context/nostrReducer.test.ts (full-reset + Pitfall-3 regression tests added)
    - src/App.tsx (error/empty status branches with terminal-styled retry controls)

key-decisions:
  - "Retry control uses plain <button> with terminal tokens — no new shadcn component (only card.tsx exists in ui/)"
  - "error vs empty branch messages are distinct static literals — no relay-supplied strings in retry UI (T-02-13 accept disposition)"
  - "TDD cycle: tests written first (RED commit), then confirmed against pre-built implementation (immediate GREEN)"

metrics:
  duration: 2min
  completed: 2026-06-06
---

# Phase 02 Plan 03: Nostr Data Layer — Refetch/Retry Slice Summary

**Refetch/retry slice complete: RESET clears all streaming state (seenCoords/articles/profiles), Pitfall-3 regression-tested; terminal-styled error/empty retry affordance wired to refetch() via useNostr().**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-06T06:58:01Z
- **Completed:** 2026-06-06T07:00:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Full-reset regression test: builds state with 3 articles + 1 profile + done status, dispatches RESET, asserts seenCoords.size=0, profiles.size=0, articles=[], status=streaming, fetchKey+1
- Pitfall-3 regression test: previously-seen coordinate is rejected by dedup on first round, then accepted again after RESET — stale-coord starvation closed
- Verified existing wiring: refetch() in context value via useMemo spread, article effect keyed on [fetchKey] with cleanup sub.close("effect cleanup"), profile effect closes on empty pubkeys (early-return path)
- App.tsx error branch: "[ERR] relay connection failed" with terminal-styled retry button calling refetch()
- App.tsx empty branch: "[EMPTY] relays responded but no articles found" with terminal-styled retry button
- 29 total unit tests pass; npm run build exits 0

## Task Commits

1. **Task 1 — RED: full-reset + Pitfall-3 regression tests** - `5234520` (test)
2. **Task 2 — retry affordance on error/empty status** - `2855d90` (feat)

## Files Created/Modified

- `src/context/nostrReducer.test.ts` — MODIFIED: 2 new RESET describe blocks (full-reset, Pitfall-3 regression); total test count 13 (was 6 in RESET suite, now 8)
- `src/App.tsx` — MODIFIED: error/empty status branches with terminal-styled `<button>` retry controls; refetch() destructured from useNostr()

## Decisions Made

- Plain `<button>` with terminal CSS tokens for retry control — only `card.tsx` exists in `src/components/ui/`; no shadcn Button component to reuse; plan explicitly allowed this path
- Static literal messages for error/empty states — relay-supplied strings never rendered as HTML in Phase 2 (T-02-13: accept disposition, Phase 4 concern)
- TDD: new regression tests written as RED commit; implementation was pre-built in Plan 01 so GREEN was immediate (no new implementation code needed for Task 1)

## Deviations from Plan

None — plan executed exactly as written. Task 1 GREEN was immediate because the RESET implementation from Plan 01 already correctly cleared all streaming state including profiles; the tests are regression guards confirming this behavior.

## Known Stubs

- `src/App.tsx` done-status display remains a minimal `<pre>` showing status + article count — intentional Phase 2 placeholder. Phase 3 renders the real article list.

## Threat Flags

None — no new network endpoints or auth paths introduced.

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-02-11 (refetch subscription leak) | fetchKey bump causes article effect cleanup (sub.close) before re-subscribe; profile sub closes when pubkeys empties on RESET | Yes — cleanup path grepped in useArticleFetch.ts + useProfileFetch.ts |
| T-02-12 (stale seenCoords starves second fetch) | RESET returns fresh initialState (empty seenCoords); Pitfall-3 regression test confirms previously-seen coord is re-added after RESET | Yes — test passes |
| T-02-13 (retry re-renders untrusted content) | Retry messages are static literals; no relay-supplied strings in error/empty UI | Yes — accept disposition, Phase 4 concern |

## TDD Gate Compliance

Task 1 followed the RED → GREEN cycle:
- `5234520` (test — RED): 2 new regression tests written for full-reset and Pitfall-3
- GREEN: immediate (implementation pre-built in Plan 01; no new implementation code needed)

No REFACTOR phase needed.

## Self-Check: PASSED

All 2 modified files found on disk. Both task commits verified in git log.
