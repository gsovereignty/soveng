# Milestones — Soveng

A historical record of shipped versions.

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
