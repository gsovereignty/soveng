# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-07
**Phases:** 4 | **Plans:** 9 | **Timeline:** 3 days (2026-06-05 → 2026-06-07)

### What Was Built
- Live GitHub Pages deployment with terminal CRT theme (green-phosphor OKLCH, JetBrains Mono, Actions artifact deploy + SPA 404 fallback)
- Robust Nostr data layer: module-level SimplePool singleton, kind:30023 streaming with dedup-by-coordinate, EOSE/maxWait timeout, batched kind:0 profile resolution (newest-wins)
- End-to-end article list: ArticleCard with title/author/timestamp fallbacks, tested UTC timestamp formatter, boot-then-stream loading, distinct error/empty states
- Hashtag faceting (count-ranked sticky filter bar, AND/OR toggle, distinct empty-filter state) and an XSS-safe inline Markdown reader (react-markdown + rehype-sanitize, controlled single-open Accordion)

### What Worked
- **Deploy-first ordering** — Phase 1 established a live URL, making every later phase verifiable in the real deployment target rather than just locally.
- **Data layer isolated to one phase** — relay/timeout/dedup risk was contained to Phase 2 before any UI consumed it; UI phases never fought relay flakiness.
- **TDD on pure helpers and the reducer** — parseArticle, parseProfile, formatTimestamp (39 tests), facets, and the nostrReducer were red/green tested, catching the freeze-before-dedup ordering and the Pitfall-3 stale-coordinate regression early.
- **Vertical MVP slices** — each phase shipped a deployable increment, so scope never ballooned mid-phase.

### What Was Inefficient
- **STATE.md drifted from reality** — its "Current Position" still read 86% / "Phase 04 not started" while all phases were actually complete; the metrics table had stale/placeholder rows. Worth keeping STATE in sync at phase close.
- **DATA-02 requirement text not updated when behavior changed** — the 21-cap was lifted via a quick task but the requirement/constraint text was never reconciled, surfacing as a divergence only at milestone close.
- **No milestone audit run** — closed on the strength of all-requirements-checked + all-summaries-present rather than a `/gsd-audit-milestone` pass.

### Patterns Established
- Module-level singletons for stateful clients (SimplePool) — never in React state, StrictMode-safe.
- nostr-tools subpath imports only (`/pool`, `/kinds`, `/core`, `/nip19`) — root barrel forbidden for tree-shaking.
- Untrusted Nostr content always rendered as React text children or through rehype-sanitize — never dangerouslySetInnerHTML, never rehype-raw.
- Freeze-then-dedup ordering in the article reducer (size gate is the outer guard).
- Newest-wins profile Map with strict `>` comparison and new-Map-on-update for identity.
- Boot-then-stream loading: BootSequence only while `streaming && articles.length === 0`.

### Key Lessons
1. **Reconcile requirement text the moment behavior changes** — a quick task that alters a documented constraint (the 21 cap) should update REQUIREMENTS/PROJECT/CLAUDE in the same change, not leave it for milestone close.
2. **Keep STATE.md honest at phase boundaries** — stale position/percent fields undermine its value as the resume anchor.
3. **Isolating the riskiest integration (live relays) into its own early phase paid off** — repeat for future external-dependency work.

### Cost Observations
- Model mix: not tracked this milestone.
- Notable: heavy reliance on pure-function TDD kept rework low; most deviations were caught at test time rather than in deployment.

---

## Milestone: v1.1 — Local ML Content Filtering

**Shipped:** 2026-06-08
**Phases:** 1 | **Plans:** 6 | **Timeline:** 2 days (2026-06-07 → 2026-06-08)

### What Was Built
- In-browser spam filtering via a transformers.js ONNX classifier in a module-level Web Worker singleton (numThreads=1, version-pinned wasmPaths CDN, CI-verifiable via check:ort-version)
- franc-min English-language gate + always-on 500-word length gate, fronted by a fail-open `isHidden` allowlist and a `ClassificationLabel` contract (10 Vitest tests)
- useClassification hook: cheap-gates-first orchestration, per-event-id raw-score cache, instant slider re-thresholding without re-inference, fail-open on every path
- ContentFilterControls from shadcn primitives only (Switch/Slider/Progress/Badge) — toggle, 0.50–0.99 slider, download progress, hidden-count badge, model-failure notice
- Surgical App.tsx integration via a single `visibleArticles` memo; evidence-based validation on the live /soveng/ URL with a GO verdict pinning SPAM_THRESHOLD = 0.90

### What Worked
- **Cheap-gates-first pipeline** — running the franc language gate and 500-word length gate before ONNX inference avoided spinning up the model for cheaply-cut articles, and kept the hot path synchronous.
- **Score cache + threshold-as-parameter** — caching raw ONNX scores per event id and passing the threshold into the hook let the slider re-threshold instantly with zero re-inference; the integration reduced to one memo.
- **Module-level worker singleton mirroring pool.ts** — reusing the established v1.0 singleton pattern made the Worker StrictMode-safe with no new conceptual surface.
- **Validate on the deployed URL, not localhost** — the mandated 05-06 live smoke test (wasm 404s, SharedArrayBuffer, ORT version pin, real score range, fail-open) caught the class of problems that only appear under the /soveng/ base path.
- **Folding Phases 6 & 7 into Phase 5 early** — deciding up front to ship the feature and its controls as one slice avoided orphaned half-features.

### What Was Inefficient
- **STATE.md drifted again** — the YAML and "Current Position" still read `status: paused` / "Plan 05-05 complete" at milestone close, even though the phase had been executed, verified, and committed (da1d4fd). Same lesson as v1.0, not yet internalized.
- **No milestone audit run** — closed (as in v1.0) on all-requirements-checked + all-summaries-present + a live GO verdict, rather than a `/gsd-audit-milestone` pass. Two milestones running.
- **CTRL-06 left as `[ ]` after reinterpretation** — the requirement was folded into the slider during discussion but its checkbox was never updated, so it surfaced as an apparent gap at close.

### Patterns Established
- Off-main-thread ML as a module-level Web Worker singleton; never instantiate inside a component/effect.
- External CDN asset versions (ONNX wasmPaths) pinned to the exact transitive dependency version and guarded by a `check:*` npm script so drift fails CI.
- Fail-open by construction for content gating — `isHidden` is an allowlist-of-hides; unknown/error/undetermined labels always show.
- Expensive-classification results cached per stable id, with the user-tunable threshold kept as a pure parameter so re-thresholding never re-runs the model.
- A single insertion-point memo (`visibleArticles`) upstream of all derived memos when adding a filter to an existing pipeline.

### Key Lessons
1. **Keep STATE.md honest at phase/milestone close** — this is now a repeated finding; the resume anchor is worth a 30-second update at every boundary.
2. **Run `/gsd-audit-milestone` before close** — flagged in v1.0 and skipped again; the audit is the intended guard against checkbox-driven false confidence.
3. **Update requirement checkboxes the moment scope is reinterpreted** — CTRL-06's stale `[ ]` mirrors v1.0's stale DATA-02 text; reconcile docs in the same change that changes the decision.
4. **Validate browser-ML constraints on the real deployment target** — base-path, wasm hosting, and SharedArrayBuffer issues are invisible on localhost.

### Cost Observations
- Model mix: not tracked this milestone.
- Sessions: spanned 2 days; a human-verify checkpoint (05-06) paused execution for the live-URL smoke test before the GO/NO-GO verdict.
- Notable: TDD on the synchronous gates + hook again kept rework low; most deviations (tsc errors post-merge, package-lock native bindings) were mechanical and caught at build time.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 4 | Initial process — vertical MVP slices, deploy-first, data-layer isolation |
| v1.1 | 1 | Single-phase feature milestone — folded planned sub-phases into one slice; added a human-verify checkpoint for live-URL ML validation |

### Cumulative Quality

| Milestone | Source LOC | Tests | Notable |
|-----------|-----------|-------|---------|
| v1.0 | ~2,436 TS/TSX | Vitest on pure helpers + reducer (formatTimestamp 39, facets, parse*) | Zero new UI components built from scratch — shadcn primitives only |
| v1.1 | +~7,583/−632 across 41 files | Vitest on language gates (10) + useClassification hook | ML kept fully client-side; off-main-thread Worker singleton; shadcn primitives only |

### Top Lessons (Verified Across Milestones)

1. **Keep STATE.md honest at phase/milestone boundaries** — drifted in both v1.0 and v1.1; the resume anchor decays without a deliberate close-out update.
2. **Run the milestone audit before closing** — skipped in both v1.0 and v1.1; checkbox completeness is not the same as verified coverage.
3. **Reconcile docs the moment a decision changes** — v1.0's stale DATA-02 text and v1.1's stale CTRL-06 checkbox are the same failure mode.
4. **Reusing established structural patterns (module-level singletons, pure-function TDD) keeps integration cheap** — held across both milestones.
