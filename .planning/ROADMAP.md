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

### 📋 v1.2 Email-Client Layout (Phases 6-8)

- [ ] **Phase 6: Layout Scaffold & Routing** - Install Resizable, establish h-screen height chain + inner overflow-y-auto scroll wrapper, move controls into sidebar panel, wire selectedNaddr state + selectedArticle memo + hash sync
- [ ] **Phase 7: Reading Pane & Enriched Rows** - Build SidebarRow (ENRICH-01, untrusted-image hardening), full ReadingPane reusing ArticleBody, selected-row highlight, scroll reset, "hidden by filter" notice; delete ArticleCard/ArticleList
- [ ] **Phase 8: Mobile Swap & Polish** - CSS visibility-based list/reader swap preserving scroll, back control, suppress Resizable handle below md breakpoint

## Phase Details

### Phase 6: Layout Scaffold & Routing
**Goal**: The 2-pane master-detail shell is on screen, independently scrolling, with all controls in the sidebar and deep-link routing wired end-to-end
**Depends on**: Phase 5 (complete)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LINK-01, LINK-02, LINK-03
**Success Criteria** (what must be TRUE):
  1. User sees a 2-pane horizontal split (sidebar left, reading pane right) on desktop that fills the full viewport — both panels scroll independently with 20+ articles loaded
  2. All existing filter controls (hashtag facets, AND/OR toggle, ML on/off, confidence slider, download progress, hidden count) are visible and functional inside the sidebar panel; the terminal aesthetic is unchanged
  3. Copying the URL of an open article and pasting it into a new tab opens that article directly, including after a hard reload (hash-based, no 404)
  4. The browser back and forward buttons navigate between article selections; opening a deep link when the article has not yet streamed in shows a loading state and then resolves automatically as relay data arrives
**Plans**: 4 plans
  - [ ] 06-01-PLAN.md — Foundations: articleNaddr helper, index.css height chain (P9), shadcn resizable install
  - [ ] 06-02-PLAN.md — 2-pane Resizable shell: h-screen layout, controls into sidebar, independent scroll (LAYOUT-01..04)
  - [ ] 06-03-PLAN.md — Deep-link routing + reading-pane stub: selectedNaddr/hash sync, selectedArticle memo, 404/loading states (LINK-01..03)
  - [ ] 06-04-PLAN.md — Human-verify checkpoint: split/scroll, controls, deep-link reload, back/forward + cold-load
**UI hint**: yes

### Phase 7: Reading Pane & Enriched Rows
**Goal**: Selecting an article renders its full content in the reading pane with sanitized Markdown; every sidebar row shows inbox-style enrichment with safe image handling; the inline accordion is gone
**Depends on**: Phase 6
**Requirements**: ENRICH-01, ROW-01, ROW-02, READ-01, READ-02, READ-03, READ-04, READ-05
**Success Criteria** (what must be TRUE):
  1. Clicking a sidebar row displays that article's Markdown body in the reading pane using the existing ArticleBody component (rehype-sanitize preserved, no `<script>` survives in the rendered DOM); the inline accordion reader is removed
  2. Each sidebar row shows author avatar + name, article title, timestamp, a summary snippet (from `summary` tag or stripped excerpt), and a thumbnail when `image` is present — absent summary/image degrade silently with no broken boxes or layout shift; the selected row is visually highlighted
  3. Author-supplied image URLs are rendered only over HTTPS, with `referrerPolicy="no-referrer"` and `loading="lazy"`; images that error or use HTTP are hidden immediately without a broken-image icon
  4. Switching to a different article resets the reading pane scroll to the top; when no article is selected the pane shows the terminal placeholder (`> select an article to read`); when the active filter hides the selected article the pane shows a "hidden by current filter" notice with a way to clear the filter
**Plans**: TBD
**UI hint**: yes

### Phase 8: Mobile Swap & Polish
**Goal**: On narrow screens the layout becomes a single full-screen pane that swaps between the article list and the reader, with the list scroll position preserved when returning
**Depends on**: Phase 7
**Requirements**: MOBILE-01, MOBILE-02, MOBILE-03
**Success Criteria** (what must be TRUE):
  1. On a mobile viewport (375px wide) the article list occupies the full screen by default; tapping any article row transitions to a full-screen reading pane for that article
  2. The reading pane on mobile shows a terminal-styled "< back" control; tapping it returns to the article list at the same scroll position the user was at before opening the article
  3. The Resizable drag handle is not visible or interactive on mobile viewports; the desktop 2-pane split is only present at the md breakpoint and above
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold & Deploy | v1.0 | 2/2 | Complete | 2026-06-06 |
| 2. Nostr Data Layer | v1.0 | 3/3 | Complete | 2026-06-07 |
| 3. Article List | v1.0 | 2/2 | Complete | 2026-06-07 |
| 4. Filtering & Inline Reader | v1.0 | 2/2 | Complete | 2026-06-07 |
| 5. ML Content Filtering | v1.1 | 6/6 | Complete | 2026-06-08 |
| 6. Layout Scaffold & Routing | v1.2 | 0/4 | Not started | - |
| 7. Reading Pane & Enriched Rows | v1.2 | 0/? | Not started | - |
| 8. Mobile Swap & Polish | v1.2 | 0/? | Not started | - |
