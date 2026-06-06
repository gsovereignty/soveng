---
phase: 02-nostr-data-layer
plan: "01"
subsystem: data
tags: [nostr, nostr-tools, react, typescript, vitest, context, reducer, websocket]

requires:
  - phase: 01-scaffold-deploy
    provides: Vite+React+shadcn scaffold with BootSequence component and terminal theme tokens

provides:
  - nostr-tools@2.23.5 installed (subpath imports only)
  - vitest configured with @/* alias; npm test script added
  - Article, Profile, NostrStatus, RelayOutcome types in src/types/nostr.ts
  - Module-level SimplePool singleton + RELAYS constant in src/lib/pool.ts
  - Pure helpers in src/lib/nostr.ts: articleCoordinate, parseArticle, parseProfile, classifyRelayClose
  - nostrReducer with freeze-at-21, dedup-by-coordinate, SET_STATUS, RESET (clears seenCoords, bumps fetchKey)
  - NostrProvider + useNostr hook in src/context/NostrContext.tsx
  - Streaming useArticleFetch hook with maxWait, backstop timer, freeze watcher, per-relay onclose zip
  - App.tsx wraps NostrProvider; AppShell reads useNostr(); BootSequence shown during streaming status

affects: [03-article-ui, 04-profile-resolution, 05-hashtag-facets]

tech-stack:
  added:
    - nostr-tools@2.23.5 (SimplePool, kinds, core types — subpath imports)
    - vitest@4.1.8 (dev dep, pure-function unit tests)
  patterns:
    - Module-level pool singleton (StrictMode-safe, never in React state)
    - TDD red/green for pure helpers and reducer
    - useReducer + React context pattern (no Zustand)
    - useEffect with cleanup — always return cleanup fn; keyed on fetchKey for refetch
    - Freeze guard before dedup guard in reducer (ARTICLE_RECEIVED ordering)
    - onclose zip: RELAYS.forEach((url, i) => outcomes.set(url, classifyRelayClose(reasons[i])))

key-files:
  created:
    - src/types/nostr.ts
    - src/lib/pool.ts
    - src/lib/nostr.ts
    - src/lib/nostr.test.ts
    - src/context/nostrReducer.ts
    - src/context/nostrReducer.test.ts
    - src/context/NostrContext.tsx
    - src/hooks/useArticleFetch.ts
    - vitest.config.ts
  modified:
    - package.json (nostr-tools dep, vitest dev dep, test script)
    - src/App.tsx (NostrProvider wrap, AppShell with useNostr, BootSequence for streaming)

key-decisions:
  - "nostr-tools subpath imports only (nostr-tools/pool, /kinds, /core) — root barrel forbidden per CLAUDE.md"
  - "SimplePool created at module scope in lib/pool.ts — never inside React state or useEffect (StrictMode-safe)"
  - "Freeze guard (articles.length >= 21) precedes dedup guard (seenCoords.has) in ARTICLE_RECEIVED"
  - "onclose zips RELAYS with reasons by index, not by position assumption (Pitfall 2 guard)"
  - "Empty d-tag events skipped in onevent before dispatch (Open Question 3 — prevents degenerate coordinate collisions)"
  - "RESET increments fetchKey from current state, returns fresh initialState otherwise (Pitfall 3 — seenCoords clears)"
  - "AppShell pattern: child component inside NostrProvider so useNostr() can be called below provider boundary"

patterns-established:
  - "Pattern: Module-level pool singleton — lib/pool.ts exports const pool = new SimplePool() at module scope"
  - "Pattern: Subpath imports — nostr-tools/pool, nostr-tools/kinds, nostr-tools/core; never root barrel"
  - "Pattern: TDD relay-free fixtures — hand-built Event objects with dummy id/sig strings"
  - "Pattern: Reducer freeze before dedup — size guard is the outer check on ARTICLE_RECEIVED"
  - "Pattern: fetchKey as re-run key — useEffect([fetchKey]) re-opens subscription on RESET"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-06]

duration: 5min
completed: 2026-06-06
---

# Phase 02 Plan 01: Nostr Data Layer — Article Stream Summary

**SimplePool streaming data layer: kind:30023 articles flow from 4 relays into a React reducer with coordinate dedup, hard-freeze at 21, per-relay outcome tracking, and a timeout backstop; exposed via useNostr() context.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-06T06:41:19Z
- **Completed:** 2026-06-06T06:46:30Z
- **Tasks:** 3
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- Pure NIP-23 helpers (articleCoordinate, parseArticle, classifyRelayClose) with 11 passing relay-free unit tests
- nostrReducer with hard-freeze at 21, coordinate dedup (first-arriving wins), seenCoords reset on refetch — 6 passing tests
- Streaming useArticleFetch hook: subscribeMany with maxWait:8000, per-relay onclose zip, 9000ms backstop, freeze-watcher effect
- App.tsx wraps in NostrProvider; BootSequence shown during streaming; status/articles surfaced via useNostr()
- npm run build exits 0 (tsc + vite build + 404 fallback); 17 total unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for pure helpers** - `62f7ae8` (test)
2. **Task 1 GREEN: install deps, types, pool singleton, nostr helpers** - `81cd773` (feat)
3. **Task 2 RED: failing tests for nostrReducer** - `5d538b3` (test)
4. **Task 2 GREEN: implement reducer + NostrContext provider** - `7bcff45` (feat)
5. **Task 3: streaming hook + NostrContext wiring + App integration** - `f9aa492` (feat)

**Plan metadata commit:** _(follows)_

## Files Created/Modified

- `src/types/nostr.ts` — NostrStatus, RelayOutcome, Article, Profile type exports
- `src/lib/pool.ts` — Module-level SimplePool singleton + RELAYS constant
- `src/lib/nostr.ts` — articleCoordinate, parseArticle, parseProfile, classifyRelayClose pure helpers
- `src/lib/nostr.test.ts` — 11 relay-free unit tests for all five behaviors
- `src/context/nostrReducer.ts` — nostrReducer with ARTICLE_RECEIVED (freeze+dedup), SET_STATUS, RESET
- `src/context/nostrReducer.test.ts` — 6 unit tests: freeze-at-21, dedup no-op same-ref, RESET clears
- `src/context/NostrContext.tsx` — NostrProvider (useReducer + useArticleFetch wired) + useNostr hook
- `src/hooks/useArticleFetch.ts` — streaming hook: subscribeMany, onclose zip, backstop timer, freeze watcher
- `vitest.config.ts` — vitest config with @/* alias and node environment
- `package.json` — nostr-tools + vitest deps, test script added
- `src/App.tsx` — NostrProvider wrap, AppShell with useNostr, BootSequence for streaming status

## Decisions Made

- AppShell inline component in App.tsx (not extracted to its own file) — avoids an extra file for Phase 2 scope; Phase 3 will refactor when real article cards are added
- PROFILE_RECEIVED in reducer is a pass-through no-op — Plan 02 implements profile resolution; the action type is declared now so the union is complete
- Freeze watcher is a separate useEffect keyed on [articleCount] — keeps D-05 close call out of subscription setup, preventing Pitfall 5 (close before allOpened resolves)

## Deviations from Plan

None — plan executed exactly as written. The `eslint-disable-line react-hooks/exhaustive-deps` comment on the fetchKey effect is intentional and documented: `dispatch` is a stable reducer dispatch and does not need to be in the dependency array; the effect re-runs only on `fetchKey` (refetch signal).

## Issues Encountered

None — nostr-tools installed cleanly, vitest resolved without conflict, tsc strict mode passed on first attempt.

## Known Stubs

- `src/App.tsx` non-streaming status display is a minimal `<pre>` showing `status` and `articles.length`. This is intentional for Phase 2 scope — Phase 3 renders the actual article list and replaces this placeholder.
- `PROFILE_RECEIVED` reducer case is a pass-through no-op. Profile resolution is implemented in Plan 02.

## Threat Flags

None — no new network endpoints or auth paths introduced. Security mitigations from the plan's threat model are implemented:

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-02-01 (event flood) | Hard-freeze at 21 + frozen-flag guard in onevent | Yes — reducer freeze test + frozen guard in hook |
| T-02-02 (hanging relay) | maxWait:8000 + 9000ms backstop setTimeout | Yes — build passes, grepped in source |
| T-02-03 (malformed event) | parseArticle optional-chaining fallbacks; empty-d skip in onevent | Yes — parse-only-d test passes |

## TDD Gate Compliance

Both Task 1 and Task 2 followed the full RED → GREEN cycle:

- Task 1: `62f7ae8` (test — RED) → `81cd773` (feat — GREEN)
- Task 2: `5d538b3` (test — RED) → `7bcff45` (feat — GREEN)

No REFACTOR phase needed — implementations were clean on first pass.

## Next Phase Readiness

- Phase 3 (article UI) can import `useNostr()` to access `articles`, `profiles`, `status`, and `refetch()`
- `Article` type is fully typed; Phase 3 renders title/author/timestamp and handles `title === undefined` fallback
- `status` transitions are live: `streaming → done | empty | error` available at the App seam
- Phase 2 Plan 02 wires `useProfileFetch` (PROFILE_RECEIVED implementation) — no blocker for Phase 3 start

## Self-Check: PASSED

All 9 created files found on disk. All 5 task commits verified in git log.

---
*Phase: 02-nostr-data-layer*
*Completed: 2026-06-06*
