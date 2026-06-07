---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: MVP
status: shipped
stopped_at: v1.0 milestone complete
last_updated: "2026-06-07T15:05:36.000Z"
last_activity: 2026-06-07
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 9
  completed_plans: 9
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07)

**Core value:** Discover and read recent Nostr long-form articles, filtered by hashtag — with zero backend, served as a static GitHub Pages site.
**Current focus:** v1.0 shipped — planning next milestone (`/gsd-new-milestone`)

## Current Position

Milestone: v1.0 MVP — ✅ SHIPPED 2026-06-07
Phase: all complete (1-4)
Status: Milestone complete; awaiting next milestone
Last activity: 2026-06-07 - Archived v1.0 milestone (ROADMAP + REQUIREMENTS), tagged v1.0

Progress: [██████████] 100% (4/4 phases, 9/9 plans complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 02 | 3 | - | - |
| 03 | 2 | - | - |
| 04 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02 P03 | 2min | - tasks | - files |
| Phase 03 P02 | 1 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: nostr-tools SimplePool chosen over NDK (bundle size) and applesauce (RxJS overhead)
- Roadmap: Deploy-first ordering — Phase 1 establishes live Pages URL so all later work is verifiable there
- Roadmap: Data layer isolated to Phase 2 before any UI consumes it — relay risks contained to one phase
- 01-02: Vite base corrected to /soveng/ — repo is gsovereignty/soveng (project-subpath), not gsovereignty.github.io (root-page)
- 01-02: GitHub Actions artifact deploy (upload-pages-artifact + deploy-pages) over gh-pages npm package
- 01-02: SPA 404 fallback via postbuild npm script (node -e copyFileSync build/index.html build/404.html)
- 01-02: Build outDir set to build/ (gitignored) per user request to keep repo root clean
- 02-01: SimplePool at module scope in lib/pool.ts — never in React state (StrictMode-safe)
- 02-01: nostr-tools subpath imports only (/pool, /kinds, /core) — root barrel forbidden for tree-shaking
- 02-01: Freeze guard before dedup guard in ARTICLE_RECEIVED reducer (size check is outer gate)
- 02-01: AppShell child component pattern — lives inside NostrProvider so useNostr() works
- 02-01: PROFILE_RECEIVED is pass-through no-op for now; implemented in Plan 02
- 02-02: PROFILE_RECEIVED newest-wins uses strict > (not >=) per Pitfall 4
- 02-02: Single batched subscribeMany for all ≤21 pubkeys (D-09); no per-author sub
- 02-02: pubkeys.join(',') as stable useEffect dep avoids array identity churn
- [Phase ?]: 02-03: Plain button with terminal tokens for retry control
- [Phase ?]: 02-03: error vs empty branch messages are distinct static literals (D-06 error/empty distinction)
- [Phase ?]: 02-03: RESET clears seenCoords — Pitfall-3 regression guard closes stale-coord starvation
- 03-01: radix-ui unified package (not @radix-ui/react-avatar) — current shadcn CLI consolidates Radix primitives; user verified official package
- 03-01: npubEncode wrapped in try/catch for displayName + monogram fallback paths (T-03-04 mitigation)
- 03-01: d-tag excluded from title fallback — not user-facing display text
- [Phase ?]: Boot-then-stream (D-01): BootSequence guarded by articles.length === 0 — first article swaps to live ArticleList
- [Phase ?]: 03-02: Streaming status line (D-02): > streaming... N/21 received resolves to > ready — N articles loaded
- [Phase ?]: 03-02: No loadingProfiles gate — profiles.get() returns undefined; ArticleCard upgrades avatar/name in place on kind:0 arrival

### Pending Todos

None yet.

### Blockers/Concerns

- None open. (Resolved in v1.0: relay EOSE timeout tuning and batch kind:0 query limits — validated against live relays during Phase 2.)
- Carry-forward note: DATA-02 requirement/constraint text ("21 most recent, newest first") diverges from shipped behavior (uncapped, reply-count sort via 260607-vqt) — reconcile in next milestone.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260607-vqt | Don't stop at 21 events. Sort by number of replies. | 2026-06-07 | 0bfd4b2 | [260607-vqt-don-t-stop-at-21-events-sort-by-number-o](./quick/260607-vqt-don-t-stop-at-21-events-sort-by-number-o/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-07T09:16:40.597Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-filtering-inline-reader/04-CONTEXT.md
