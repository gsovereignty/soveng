---
phase: 02-nostr-data-layer
plan: "02"
subsystem: data
tags: [nostr, nostr-tools, react, typescript, vitest, context, reducer, profiles, batch-subscription]

requires:
  - phase: 02-nostr-data-layer
    plan: "01"
    provides: Article stream, nostrReducer with PROFILE_RECEIVED no-op, NostrContext + useNostr hook

provides:
  - parseProfile pure helper with try/catch JSON guard and display_name priority (nostr.ts)
  - PROFILE_RECEIVED reducer case: newest-wins (strict >), immutable Map update, no-op on older/equal
  - useProfileFetch hook: single batched kind:0 subscription, maxWait:5000, PROFILE_RECEIVED dispatch
  - profiles Map<pubkey, Profile> populated via single subscription, observable via useNostr()

affects: [03-article-ui, 04-profile-resolution]

tech-stack:
  added: []
  patterns:
    - Batched kind:0 subscription — single subscribeMany with authors:[pubkeys] over all rendered pubkeys
    - Newest-wins profile Map: strict > created_at comparison, new Map() on replace
    - pubkeys.join(',') as stable useEffect dep string (avoids array identity issues)
    - useMemo unique pubkey set derived from state.articles in NostrProvider

key-files:
  created:
    - src/hooks/useProfileFetch.ts
  modified:
    - src/lib/nostr.test.ts (parseProfile tests added)
    - src/context/nostrReducer.ts (PROFILE_RECEIVED implemented)
    - src/context/nostrReducer.test.ts (PROFILE_RECEIVED tests added)
    - src/context/NostrContext.tsx (useProfileFetch wired, pubkeys useMemo)

key-decisions:
  - "PROFILE_RECEIVED uses strict > for created_at (Pitfall 4): equal-timestamp events are no-ops; first-arriving wins on tie"
  - "PROFILE_RECEIVED returns new Map() on insert (immutable update); same state ref on ignored events"
  - "useProfileFetch early-returns on empty pubkeys without opening a subscription"
  - "subscribeMany filter passed as single object (not array) — matching nostr-tools Pool.subscribeMany signature"
  - "pubkeys.join(',') as dep string avoids array identity churn across re-renders"

metrics:
  duration: 5min
  completed: 2026-06-06
---

# Phase 02 Plan 02: Nostr Data Layer — Profile Resolution Summary

**Batched kind:0 author-profile subscription via single subscribeMany; profiles upgrade article display in-place through a newest-wins reducer Map; no global loading gate blocks article rendering.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-06T14:53:00Z
- **Completed:** 2026-06-06T14:54:44Z
- **Tasks:** 2 (TDD: RED + GREEN for Task 1; build-verify for Task 2)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `parseProfile` (already in nostr.ts from Plan 01) fully tested: 5 new tests covering valid JSON, malformed JSON no-throw, display_name → displayName → name priority, whitespace fallthrough, all-absent → undefined
- `PROFILE_RECEIVED` reducer case implemented: newest-wins with strict `>`, immutable new Map(), no-op (same state ref) on older or equal-timestamp event — 5 new tests
- `useProfileFetch.ts` hook: single `subscribeMany` with `{ kinds: [Metadata], authors: pubkeys }`, `maxWait:5000`, `PROFILE_RECEIVED` dispatch, empty-pubkeys early-return, stable `pubkeys.join(',')` dep
- `NostrContext.tsx`: `useMemo` unique pubkeys from `state.articles`, `useProfileFetch(pubkeys, dispatch)` wired; `profiles` flows to consumers via `...state` spread in context value
- 27 unit tests pass; `npm run build` exits 0

## Task Commits

1. **Task 1 RED: failing tests for parseProfile + PROFILE_RECEIVED** - `7613f86` (test)
2. **Task 1 GREEN: implement PROFILE_RECEIVED reducer case** - `6f0eb6b` (feat)
3. **Task 2: batched useProfileFetch hook + wire into NostrProvider** - `60e6e0d` (feat)

## Files Created/Modified

- `src/hooks/useProfileFetch.ts` — NEW: batched kind:0 subscription hook (single subscribeMany, all authors)
- `src/lib/nostr.test.ts` — MODIFIED: 5 parseProfile tests added (valid JSON, malformed no-throw, name priority, whitespace, all-absent)
- `src/context/nostrReducer.ts` — MODIFIED: PROFILE_RECEIVED implemented (newest-wins, immutable Map)
- `src/context/nostrReducer.test.ts` — MODIFIED: 5 PROFILE_RECEIVED tests added
- `src/context/NostrContext.tsx` — MODIFIED: useProfileFetch import + wiring, pubkeys useMemo

## Decisions Made

- Strict `>` for created_at comparison (Pitfall 4): equal-timestamp events are no-ops; first-arriving wins on tie — consistent with RESEARCH guidance
- `new Map(state.profiles)` copy on insert keeps reducer immutable; same `state` ref returned when event is ignored (enables React bailout)
- `subscribeMany` takes a single Filter object, not an array — confirmed by matching sibling hook `useArticleFetch.ts` signature
- `pubkeys.join(',')` as useEffect dep string: arrays change identity every render; join produces a stable primitive

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed subscribeMany filter wrapping**
- **Found during:** Task 2 — `npm run build` TypeScript error
- **Issue:** Plan example implied `[{ kinds, authors }]` (array). The actual nostr-tools `Pool.subscribeMany` signature takes a single `Filter` object (not an array), as confirmed by the sibling `useArticleFetch.ts` hook
- **Fix:** Changed `[{ kinds: [Metadata], authors: pubkeys }]` to `{ kinds: [Metadata], authors: pubkeys }`
- **Files modified:** `src/hooks/useProfileFetch.ts`
- **Commit:** `60e6e0d`

## Issues Encountered

None beyond the subscribeMany array-wrapping type error auto-fixed above.

## Known Stubs

None — all profile resolution logic is functional. `Profile.displayName` is intentionally `undefined` when no name fields are present; Phase 3 supplies the npub fallback as documented in the plan threat model.

## Threat Flags

None — no new network endpoints or auth paths introduced beyond what the plan's threat model covers.

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-02-06 (malformed kind:0 JSON) | parseProfile wraps JSON.parse in try/catch, defaults to `{}`; returns valid Profile with undefined fields | Yes — test asserts no-throw with `"{not json"` |
| T-02-07 (profile-event flood) | Single batched subscribeMany (D-09) bounded to ≤21 pubkeys; maxWait:5000 closes sub | Yes — single subscribeMany grepped; no per-author loop |
| T-02-08 (prototype pollution) | Explicit field access on cast `Record<string, unknown>`; no spread into prototype target | Yes — parseProfile reads display_name/displayName/name/picture only |

## TDD Gate Compliance

Task 1 followed the full RED → GREEN cycle:
- `7613f86` (test — RED): 5 PROFILE_RECEIVED tests fail + 5 parseProfile tests pass (parseProfile was pre-built in Plan 01)
- `6f0eb6b` (feat — GREEN): PROFILE_RECEIVED implemented; all 27 tests pass

No REFACTOR phase needed — implementation was clean on first attempt (after subscribeMany type fix).

## Next Phase Readiness

- Phase 3 (article UI) can access `profiles` via `useNostr()` — `Map<pubkey, Profile>` populated after articles arrive
- `profile.displayName` may be undefined — Phase 3 supplies `npubEncode(pubkey).slice(0,12)+'...'` fallback
- `profile.picture` is stored verbatim — Phase 3 image rendering must guard non-https URIs (T-02-09 flagged)
- `profiles` Map updates as events stream in; React re-renders upgrade article cards in place (D-08)

## Self-Check: PASSED

All 5 files verified on disk. All 3 task commits verified in git log.

---
*Phase: 02-nostr-data-layer*
*Completed: 2026-06-06*
