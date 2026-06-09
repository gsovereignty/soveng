# Roadmap: Soveng — Nostr Long-Form Reader

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-06-07) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Local ML Content Filtering** — Phase 5 (shipped 2026-06-08) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 📋 **v1.2 Email-Client Layout** — Phases 6-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-06-07</summary>

- [x] Phase 1: Scaffold & Deploy (2/2 plans) — completed 2026-06-06
- [x] Phase 2: Nostr Data Layer (3/3 plans) — completed 2026-06-07
- [x] Phase 3: Article List (2/2 plans) — completed 2026-06-07
- [x] Phase 4: Filtering & Inline Reader (2/2 plans) — completed 2026-06-07

Full phase details archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

</details>

<details>
<summary>✅ v1.1 Local ML Content Filtering (Phase 5) — SHIPPED 2026-06-08</summary>

- [x] Phase 5: ML Content Filtering (6/6 plans) — completed 2026-06-08

In-browser spam (transformers.js ONNX) + language (franc-min) + 500-word length filter,
running off the main thread in a Web Worker, fail-open throughout, with user-facing controls
(on-by-default toggle, download progress, hidden count, spam-confidence slider). Validated and
deployed on the live /soveng/ URL with a GO verdict pinning SPAM_THRESHOLD = 0.90. Absorbs the
former Phases 6 (Filter Controls) & 7 (False-Positive Recovery).

Full phase details archived in [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

### 📋 v1.2 Email-Client Layout (Phase 6 — consolidated)

> **Scope consolidation (2026-06-09):** Phases 7 & 8 were folded into Phase 6 per user
> request — the entire v1.2 layout (scaffold + routing + reading pane + enriched rows +
> mobile) is now delivered in a single phase.

- [ ] **Phase 6: Email-Client Layout (full v1.2)** - Resizable 2-pane scaffold + h-screen height chain, controls in sidebar, deep-link routing (selectedNaddr/hash); full ReadingPane reusing ArticleBody, enriched SidebarRow (ENRICH-01 + untrusted-image hardening), selected-row highlight, scroll reset, "hidden by filter" notice, delete ArticleCard/ArticleList; mobile single-pane list/reader swap preserving scroll, back control, suppress Resizable handle below md breakpoint
- ~~Phase 7: Reading Pane & Enriched Rows~~ — **folded into Phase 6** (2026-06-09)
- ~~Phase 8: Mobile Swap & Polish~~ — **folded into Phase 6** (2026-06-09)

## Phase Details

### Phase 6: Email-Client Layout (full v1.2 — Phases 7 & 8 folded in)

**Goal**: The complete v1.2 email-client layout — a 2-pane master-detail shell with deep-link routing, a full Markdown reading pane, inbox-style enriched rows with safe images, and a mobile single-pane swap — replacing the single-column inline-accordion reader
**Depends on**: Phase 5 (complete)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LINK-01, LINK-02, LINK-03, ENRICH-01, ROW-01, ROW-02, READ-01, READ-02, READ-03, READ-04, READ-05, MOBILE-01, MOBILE-02, MOBILE-03
**Success Criteria** (what must be TRUE):

  1. User sees a 2-pane horizontal split (sidebar left, reading pane right) on desktop that fills the full viewport — both panels scroll independently with 20+ articles loaded
  2. All existing filter controls (hashtag facets, AND/OR toggle, ML on/off, confidence slider, download progress, hidden count) are visible and functional inside the sidebar panel; the terminal aesthetic is unchanged
  3. Copying the URL of an open article and pasting it into a new tab opens that article directly, including after a hard reload (hash-based, no 404)
  4. The browser back and forward buttons navigate between article selections; opening a deep link when the article has not yet streamed in shows a loading state and then resolves automatically as relay data arrives
  5. Clicking a sidebar row displays that article's Markdown body in the reading pane using the existing ArticleBody component (rehype-sanitize preserved, no `<script>` survives in the rendered DOM); the inline accordion reader is removed
  6. Each sidebar row shows author avatar + name, article title, timestamp, a summary snippet (from `summary` tag or stripped excerpt), and a thumbnail when `image` is present — absent summary/image degrade silently with no broken boxes or layout shift; the selected row is visually highlighted
  7. Author-supplied image URLs are rendered only over HTTPS, with `referrerPolicy="no-referrer"` and `loading="lazy"`; images that error or use HTTP are hidden immediately without a broken-image icon
  8. Switching to a different article resets the reading pane scroll to the top; when no article is selected the pane shows the terminal placeholder (`> select an article to read`); when the active filter hides the selected article the pane shows a "hidden by current filter" notice with a way to clear the filter
  9. On a mobile viewport (375px wide) the article list occupies the full screen by default; tapping any article row transitions to a full-screen reading pane for that article
  10. The mobile reading pane shows a terminal-styled "‹ back" control; tapping it returns to the article list at the same scroll position the user was at before opening the article
  11. The Resizable drag handle is not visible or interactive on mobile viewports; the desktop 2-pane split is only present at the md breakpoint and above

**Plans**: 7 plans (06-01..03 complete; 06-04..07 planned 2026-06-09)

**Wave 1**

  - [x] 06-01-PLAN.md — Foundations: articleNaddr helper, index.css height chain (P9), shadcn resizable install (completed 2026-06-09)

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 06-02-PLAN.md — 2-pane Resizable shell: h-screen layout, controls into sidebar, independent scroll (LAYOUT-01..04) (completed 2026-06-09)

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 06-03-PLAN.md — Deep-link routing + reading-pane stub: selectedNaddr/hash sync, selectedArticle memo, 404/loading states (LINK-01..03) (completed 2026-06-09)
  - [~] Reading-pane body (READ-01/READ-05) partially pulled forward 2026-06-09 (commit dd680bb): ArticleBody renders in the pane, sidebar accordion disabled. Remaining READ/ENRICH/ROW/MOBILE work to be planned.

**Wave 4** *(blocked on Wave 3 completion)*

  - [x] 06-04-PLAN.md — Enriched SidebarRow + accordion removal: avatar/name/title/timestamp/summary/thumbnail, untrusted-image hardening, selected-row highlight, delete ArticleCard (ENRICH-01, ROW-01, ROW-02, READ-05)

**Wave 5** *(blocked on Wave 4 — shares src/App.tsx)*

  - [x] 06-05-PLAN.md — Reading-pane polish: scroll-reset on article switch + hidden-by-filter notice with restore control; reconfirm sanitized body + placeholder (READ-01, READ-02, READ-03, READ-04)

**Wave 6** *(blocked on Wave 5 — shares src/App.tsx)*

  - [x] 06-06-PLAN.md — Mobile single-pane swap: CSS-visibility list/reader swap preserving scroll, '‹ back' control, suppress Resizable handle below md (MOBILE-01, MOBILE-02, MOBILE-03)

**Wave 7** *(blocked on Waves 4-6 — final verification)*

  - [ ] 06-07-PLAN.md — Human-verify checkpoint: automated build/test/security gate + browser verification of all 11 success criteria (supersedes the original 06-04)

**UI hint**: yes

### ~~Phase 7: Reading Pane & Enriched Rows~~ — folded into Phase 6 (2026-06-09)

Requirements (ENRICH-01, ROW-01/02, READ-01..05) and success criteria moved into Phase 6 above.

### ~~Phase 8: Mobile Swap & Polish~~ — folded into Phase 6 (2026-06-09)

Requirements (MOBILE-01/02/03) and success criteria moved into Phase 6 above.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold & Deploy | v1.0 | 2/2 | Complete | 2026-06-06 |
| 2. Nostr Data Layer | v1.0 | 3/3 | Complete | 2026-06-07 |
| 3. Article List | v1.0 | 2/2 | Complete | 2026-06-07 |
| 4. Filtering & Inline Reader | v1.0 | 2/2 | Complete | 2026-06-07 |
| 5. ML Content Filtering | v1.1 | 6/6 | Complete | 2026-06-08 |
| 6. Email-Client Layout (full v1.2) | v1.2 | 6/7 | In Progress|  |
| ~~7. Reading Pane & Enriched Rows~~ | v1.2 | — | Folded into Phase 6 | 2026-06-09 |
| ~~8. Mobile Swap & Polish~~ | v1.2 | — | Folded into Phase 6 | 2026-06-09 |
