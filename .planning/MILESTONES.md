# Milestones — Soveng

A historical record of shipped versions.

## v1.1 Local ML Content Filtering — ✅ Shipped 2026-06-08

**Delivered:** In-browser ML content filtering for the reader — spam (transformers.js ONNX), non-English (franc-min), and sub-500-word articles are hidden from the list, all classified off the main thread in a Web Worker and fail-open throughout — with full user-facing controls (on-by-default toggle, model download progress, hidden-article count, spam-confidence slider) and no backend.

**Stats:**
- Phases: 1 (ML Content Filtering — absorbs former Phases 6 & 7)
- Plans: 6 | Tasks: ~13 (4 waves)
- Files changed: 41 (+7,583 / −632)
- Timeline: 2 days (2026-06-07 → 2026-06-08)
- Git range: 810af11 (v1.1 start) → da1d4fd

**Key accomplishments:**
1. franc-min language gate + 500-word length gate with fail-open `isHidden` allowlist (ClassificationLabel contract, 10 Vitest tests)
2. ONNX spam classifier in a module-level Web Worker singleton — numThreads=1, `wasmPaths` CDN pinned to the exact onnxruntime-web transitive version, CI-verifiable via `check:ort-version`
3. useClassification hook — cheap-gates-first orchestration, per-event-id score cache, instant slider re-thresholding without re-inference, fail-open on every path
4. Prop-driven ContentFilterControls from shadcn primitives only (Switch/Slider/Progress/Badge) — toggle, 0.50–0.99 slider, download progress, hidden-count badge, model-failure notice
5. Surgical App.tsx integration — single `visibleArticles` memo as the ML-filter insertion point; facets/dynamicCounts/filteredArticles all derive from the post-filter view; default-on persisted toggle
6. Evidence-based validation on the live `/soveng/` URL — DEV-only spam-score logging (tree-shaken from production), all 5 ML-on-Pages pitfalls cleared, GO verdict pinning `SPAM_THRESHOLD = 0.90`

**Adjustments / known notes:**
- CTRL-06 (reveal hidden articles) reinterpreted 2026-06-08 — folded into the CTRL-05 spam-confidence slider (max threshold surfaces false positives); no separate control shipped.
- Former Phases 6 (Filter Controls) & 7 (False-Positive Recovery) folded into Phase 5 (commit 700a576) — v1.1 shipped as a single phase.
- No milestone audit was run before close (proceeded on all-requirements-checked + all-summaries-present + live GO verdict).
- Spam model is a general SMS-trained classifier, not domain-tuned (mitigation: 0.90 threshold); domain-tuned model deferred (SPAM-05).

**Archives:**
- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`

**Tag:** v1.1

## v1.0 MVP — ✅ Shipped 2026-06-07

**Delivered:** A zero-backend, terminal-styled Nostr long-form reader, live on GitHub Pages, that streams kind:30023 articles from four public relays, resolves author profiles, and lets readers filter by hashtag and read Markdown inline.

**Stats:**
- Phases: 4 (Scaffold & Deploy → Nostr Data Layer → Article List → Filtering & Inline Reader)
- Plans: 9 | Tasks: ~30
- Files changed: 93 (+19,131 / -7)
- Source LOC: 2,436 (TypeScript/TSX)
- Timeline: 3 days (2026-06-05 → 2026-06-07)
- Git range: bd21080 (init) → 128c0ae

**Key accomplishments:**
1. Live GitHub Pages deployment with terminal CRT theme — green-phosphor OKLCH palette, JetBrains Mono, GitHub Actions artifact deploy with SPA 404 fallback
2. Robust Nostr data layer — module-level SimplePool singleton, kind:30023 streaming with dedup-by-coordinate, EOSE/maxWait timeout so slow relays never block render
3. Batched author-profile resolution — single kind:0 subscription for all pubkeys, newest-wins profile Map, upgrade-in-place as profiles arrive
4. End-to-end article list — ArticleCard with title/author/timestamp fallbacks, tested UTC timestamp formatter, boot-then-stream loading and distinct error/empty states
5. Hashtag faceting — count-ranked sticky filter bar with AND/OR (Match ALL/ANY) toggle and a distinct empty-filter state
6. XSS-safe inline Markdown reader — react-markdown + remark-gfm + rehype-sanitize (no rehype-raw), controlled single-open Accordion

**Adjustments / known notes:**
- DATA-02: the fixed 21-article cap was lifted and sort switched to reply-count via quick task 260607-vqt during the milestone. Requirement/constraint text ("21 most recent, newest first") still describes pre-adjustment behavior — reconcile in next milestone.
- FILT-*: facet panel shipped as a sticky top filter bar (D-01), not a sidebar — presentation delta, scope unchanged.

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

**Tag:** v1.0
