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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 4 | Initial process — vertical MVP slices, deploy-first, data-layer isolation |

### Cumulative Quality

| Milestone | Source LOC | Tests | Notable |
|-----------|-----------|-------|---------|
| v1.0 | ~2,436 TS/TSX | Vitest on pure helpers + reducer (formatTimestamp 39, facets, parse*) | Zero new UI components built from scratch — shadcn primitives only |

### Top Lessons (Verified Across Milestones)

1. *(Pending second milestone to cross-validate.)*
