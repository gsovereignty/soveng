---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Local ML Content Filtering
status: paused
stopped_at: Plan 05-05 complete — App.tsx integration (Wave 3 done)
last_updated: "2026-06-08T07:30:19.303Z"
last_activity: 2026-06-08
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07)

**Core value:** Discover and read recent Nostr long-form articles, filtered by hashtag — with zero backend, served as a static GitHub Pages site.
**Current focus:** Phase 05 — ml-pipeline-infrastructure

## Current Position

Phase: 05
Plan: Not started
Status: PAUSED at 05-06 blocking human-verify checkpoint. Task 1 (dev-only spam-score logging, commit f352e1e) done + build green. Awaiting: user pushes origin/main → GitHub Actions deploy → live-URL smoke test on https://gsovereignty.github.io/soveng/ (5 observations: .wasm 404s, SharedArrayBuffer warning, ORT version-pin match = 1.26.0-dev.20260416-b7804b056c, 20+ real article score range, fail-open) → GO/NO-GO verdict. Task 3 (pin SPAM_THRESHOLD or language-only fallback + redeploy) runs on resume after verdict.
Last activity: 2026-06-08

```
v1.1 progress: [░░░░░░░░░░] 0% (0/1 phases)
Phase 5 [░░░░░░░░░░] Not started (absorbs former Phases 6 & 7)
```

## Performance Metrics

**Velocity:**

- Total plans completed: 15 (v1.0)
- Average duration: —
- Total execution time: —

**By Phase (v1.0):**

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

### Pending Todos

- Resolve open product decision before Phase 5 planning: inspect real Nostr article spam scores against live relays. If false positives appear above 0.90 threshold, consider shipping language-detection-only for v1.1 and deferring spam ML to v1.2.
- Derive wasmPaths CDN version pin from node_modules/onnxruntime-web/package.json after npm install @huggingface/transformers.

### Blockers/Concerns

- None open.
- Carry-forward note: DATA-02 requirement/constraint text ("21 most recent, newest first") diverges from shipped behavior (uncapped, reply-count sort via 260607-vqt) — reconcile in next milestone.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260607-vqt | Don't stop at 21 events. Sort by number of replies. | 2026-06-07 | 0bfd4b2 | [260607-vqt-don-t-stop-at-21-events-sort-by-number-o](./quick/260607-vqt-don-t-stop-at-21-events-sort-by-number-o/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v1.1 | Former Phases 6 (Filter Controls) & 7 (False-Positive Recovery) folded into Phase 5 on 2026-06-08 — v1.1 is now a single phase shipping the full filtering feature + controls | Resolved | 2026-06-08 |

## Session Continuity

Last session: 2026-06-08T06:47:33Z
Stopped at: Plan 05-05 complete — App.tsx integration (Wave 3 done)
Resume file: .planning/phases/05-ml-pipeline-infrastructure/05-06-PLAN.md
