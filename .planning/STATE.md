---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Email-Client Layout
status: roadmap_complete
stopped_at: roadmap created — ready for phase planning
last_updated: "2026-06-09T00:00:00.000Z"
last_activity: 2026-06-09
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08)

**Core value:** Discover and read recent Nostr long-form articles, filtered by hashtag — with zero backend, served as a static GitHub Pages site.
**Current focus:** v1.2 Email-Client Layout — roadmap complete, ready for Phase 6 planning

## Current Position

Phase: Phase 6 (next — not yet started)
Plan: —
Status: Roadmap created
Last activity: 2026-06-09 — v1.2 roadmap written (Phases 6-8, 18 requirements mapped)

```
v1.0 MVP                        [██████████] SHIPPED 2026-06-07
v1.1 Local ML Content Filtering [██████████] SHIPPED 2026-06-08
v1.2 Email-Client Layout        [░░░░░░░░░░] ROADMAP READY  (0/3 phases)
```

## Performance Metrics

**Velocity:**

- Total plans completed: 15 (v1.0) + 6 (v1.1) = 21
- Average duration: —
- Total execution time: —

**By Phase (historical):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 02 | 3 | - | - |
| 03 | 2 | - | - |
| 04 | 2 | - | - |
| 05 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

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
- v1.1 roadmap: Integration is surgical — single visibleArticles memo inserted between sortedArticles and the three existing downstream memos; facets derive from visibleArticles (post-filter) not sortedArticles
- v1.1 roadmap: Phase 5 must resolve all 5 critical pitfalls AND be smoke-tested on deployed /soveng/ URL (not just localhost)
- v1.1 roadmap: SPAM_THRESHOLD = 0.90 (not 0.50) — domain shift from SMS training data; named constant with comment required from day one
- v1.1 roadmap: Worker singleton at module level (mirrors pool.ts pattern) — never inside useEffect; StrictMode-safe
- v1.1 roadmap: franc treats 'und' as English (fail-open); code blocks stripped before detection; 200+ char minimum after stripping
- v1.1 roadmap: ?worker Vite import syntax for full dependency bundling (not bare new URL())
- v1.1 roadmap: wasmPaths CDN URL must be pinned to exact onnxruntime-web transitive version — derive from node_modules at implementation time
- 05-05: visibleArticles inserted between sortedArticles and all three downstream memos — facets/dynamicCounts/filteredArticles all derive from ML-filtered view
- 05-05: spamThreshold added to visibleArticles dep array alongside classificationVersion — slider re-thresholding triggers memo re-eval even when version is stale
- 05-05: filterEnabled default-on via lazy initializer !== 'false' (T-05-LSPARSE safe default)
- 05-05: ContentFilterControls rendered above FilterBar inside the articles branch
- v1.2 roadmap: Hash-based deep linking (window.location.hash) — no router library; zero-dep, correct for GitHub Pages static host
- v1.2 roadmap: selectedNaddr state in AppShell (not NostrContext) — mirrors D-10 pattern; avoids re-render storm during relay streaming
- v1.2 roadmap: selectedArticle memo searches filteredArticles first, falls back to sortedArticles — handles both cold-load and filter-hides-selection in one memo
- v1.2 roadmap: Filter-hides-selection shows "hidden by filter" notice (READ-04) — avoids silently stale reading pane; user can clear filter to restore
- v1.2 roadmap: ResizablePanel scroll fix via inner div h-full overflow-y-auto wrapper (shadcn-ui issue #3548) — must be scaffolded in Phase 6 before any content
- v1.2 roadmap: Mobile layout uses CSS visibility swap (not conditional unmount) — preserves list scroll position on back navigation
- v1.2 roadmap: LINK-03 uses history.pushState (back navigates between reads) per explicit requirement — not replaceState
- v1.2 roadmap: shadcn Resizable only; no shadcn Sidebar component; no wouter router library

### Pending Todos

- (Resolved 2026-06-08) Spam-score validation against live relays — done in 05-06: GO verdict, no over-filtering at 0.90.
- (Resolved 2026-06-08) wasmPaths CDN version pin — derived in 05-02: 1.26.0-dev.20260416-b7804b056c.

### Open for future milestones

- SPAM-05: domain-tuned spam model if false-positive rates stay high after launch feedback.
- SPAM-06: per-article "why filtered" disclosure.
- MUTE-01: pubkey denylist / mute list.
- DATA-02: reconcile requirement/constraint text ("21 most recent, newest first") with shipped behavior (uncapped, reply-count sort via 260607-vqt).

### Blockers/Concerns

- None open.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260607-vqt | Don't stop at 21 events. Sort by number of replies. | 2026-06-07 | 0bfd4b2 | [260607-vqt-don-t-stop-at-21-events-sort-by-number-o](./quick/260607-vqt-don-t-stop-at-21-events-sort-by-number-o/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v1.1 | Former Phases 6 (Filter Controls) & 7 (False-Positive Recovery) folded into Phase 5 on 2026-06-08 — v1.1 is now a single phase shipping the full filtering feature + controls | Resolved | 2026-06-08 |

## Session Continuity

Last session: 2026-06-09
Stopped at: v1.2 roadmap created — 3 phases (6-8), 18 requirements mapped
Resume: run `/gsd-plan-phase 6` to begin planning Phase 6: Layout Scaffold & Routing
