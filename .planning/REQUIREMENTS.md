# Requirements — v1.2 Email-Client Layout

**Defined:** 2026-06-08
**Milestone:** v1.2 Email-Client Layout
**Core Value:** Discover and read recent Nostr long-form articles, filtered by hashtag — with zero backend, served entirely as a static GitHub Pages site.

> v1.2 is a **pure presentation-layer rework**. The nostr-tools data layer, the event-store
> reducer, the SimplePool and ML Web Worker singletons, and the derived-state memo chain are
> unchanged. The work replaces the single-column list + inline-accordion reader with a 2-pane,
> email-client-style master-detail layout, adds deep-linkable selection, and enriches the list
> rows. See `.planning/research/SUMMARY.md` for the grounding research.

## v1.2 Requirements

### Layout

- [ ] **LAYOUT-01**: User sees a 2-pane master-detail layout — an article-list sidebar on the left and a dedicated reading pane on the right (desktop).
- [ ] **LAYOUT-02**: The two panes split via the shadcn `Resizable` component with a full-height (`h-screen`) chain and independently scrolling regions (inner `overflow-y-auto` wrapper to avoid the `ResizablePanel overflow:hidden` bug).
- [ ] **LAYOUT-03**: The terminal/phosphor aesthetic (monospace, green-on-black, CRT chrome) is preserved across both panes.
- [ ] **LAYOUT-04**: All existing filter controls live inside the sidebar — hashtag facets, the AND/OR (Match ALL/ANY) toggle, and the v1.1 ML filter controls (on/off toggle, confidence slider, download progress, hidden-article count).

### Sidebar Rows

- [ ] **ENRICH-01**: Each sidebar row reads like an inbox entry — author avatar + name, article title, timestamp, a summary snippet (from the `summary` tag, falling back to a stripped content excerpt), and a thumbnail when the `image` tag is present. Absent summary/image degrade gracefully (no broken/placeholder boxes).
- [ ] **ROW-01**: Author-supplied image URLs are rendered safely — `https://`-only guard, `referrerPolicy="no-referrer"`, `loading="lazy"`, fixed dimensions to prevent layout shift, and hidden on load error (`onError`).
- [ ] **ROW-02**: The currently-selected row is visually highlighted for as long as its article is open.

### Reading Pane

- [x] **READ-01**: Selecting a row renders that article's sanitized Markdown body in the reading pane, reusing the existing `ArticleBody` (react-markdown + rehype-sanitize, never rehype-raw) unchanged.
- [x] **READ-02**: When no article is selected, the reading pane shows a terminal-styled placeholder (e.g. `> select an article to read`).
- [x] **READ-03**: Switching the selected article resets the reading pane's scroll position to the top.
- [x] **READ-04**: When the active hashtag/ML filter hides the currently-selected article, the reading pane shows a "hidden by current filter" notice with a way to clear the filter / restore the view (rather than silently mismatching the list, or slamming shut).
- [ ] **READ-05**: The inline-accordion reader is removed — there is one reading experience (the reading pane), not two.

### Deep-Linking

- [ ] **LINK-01**: The selected article is reflected in the URL as a hash-encoded `naddr` (NIP-19, kind:30023 addressable coordinate), so a read is shareable by copying the URL.
- [ ] **LINK-02**: Opening a deep link selects and displays that article, resolving correctly even when it has not yet streamed in from relays (resolves reactively as articles arrive); a "not found" notice appears if it never arrives within a reasonable wait.
- [ ] **LINK-03**: The browser back/forward buttons navigate between article selections, and deep links load without a 404 under the `/soveng/` base path (hash-based — no server route, no router library).

### Mobile

- [ ] **MOBILE-01**: On narrow screens the layout becomes a single full-screen pane — the article list by default, swapping to the full-screen reader when an article is selected.
- [ ] **MOBILE-02**: The mobile reader shows a terminal-styled "‹ back" control that returns to the list with its scroll position preserved (CSS visibility swap, not conditional unmount).
- [ ] **MOBILE-03**: The `Resizable` split handle is suppressed below the `md` breakpoint (no resize affordance on mobile).

## Future Requirements (deferred beyond v1.2)

### Enrichment

- **ENRICH-02**: Clickable hashtag pills on rows/reading pane to drive the filter.
- **ENRICH-03**: Per-relay connection status indicator.

### Configuration

- **CONF-01**: User-configurable relay set.
- **CONF-02**: Adjustable feed length.

### Filtering Quality

- **SPAM-05**: Nostr/long-form-trained spam classifier (replace the SMS-trained model).
- **SPAM-06**: Per-article "why filtered" disclosure.
- **MUTE-01**: Pubkey denylist / mute list.

### Tech Debt

- **DATA-02 reconcile**: Requirement/constraint text still says "21 most recent, newest first"; shipped behavior is uncapped + reply-count sort (quick task 260607-vqt). Reconcile the documented behavior in a future milestone.

## Out of Scope (v1.2)

| Feature | Reason |
|---------|--------|
| Router library (react-router / wouter) | A single `?article=`/hash param needs no router; manual `window.location.hash` + `hashchange` + history API suffices and adds zero bundle weight |
| shadcn `Sidebar` (nav-drawer) component | It is an app-navigation drawer (icon rail, cookie state, SidebarProvider) that fights a content-list + controls pattern; `Resizable` is the correct primitive |
| Encoding active filters in the deep link | Only the selected article is shareable; filters are ephemeral session state — encoding them bloats the URL and surprises on share |
| Persisting sidebar panel width across sessions | Nice-to-have; not v1.2 scope (trivial future extension via `react-resizable-panels` storage) |
| Read/unread state per article | Anti-feature — articles stream fresh each load; per-article persisted read state accumulates with no cleanup path. Selected-row highlight is the session affordance |
| Swipe gestures / pane animations on mobile | Out of scope — a plain CSS visibility swap with a back control is sufficient |
| Keyboard list navigation (j/k / arrows) | Differentiator, not table stakes for v1.2; defer unless cheap during implementation |
| Any data/protocol/relay change | v1.2 is presentation-only; the data layer, reducer, and singletons are frozen |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 6 | Pending |
| LAYOUT-02 | Phase 6 | Pending |
| LAYOUT-03 | Phase 6 | Pending |
| LAYOUT-04 | Phase 6 | Pending |
| LINK-01 | Phase 6 | Pending |
| LINK-02 | Phase 6 | Pending |
| LINK-03 | Phase 6 | Pending |
| ENRICH-01 | Phase 6 | Pending |
| ROW-01 | Phase 6 | Pending |
| ROW-02 | Phase 6 | Pending |
| READ-01 | Phase 6 | Complete |
| READ-02 | Phase 6 | Complete |
| READ-03 | Phase 6 | Complete |
| READ-04 | Phase 6 | Complete |
| READ-05 | Phase 6 | Pending |
| MOBILE-01 | Phase 6 | Pending |
| MOBILE-02 | Phase 6 | Pending |
| MOBILE-03 | Phase 6 | Pending |

**Coverage:** 18/18 mapped — all 18 reqs consolidated into Phase 6 (Phases 7 & 8 folded in 2026-06-09 per scope-consolidation request).

---
*Requirements defined: 2026-06-08 for milestone v1.2 Email-Client Layout*
*Traceability filled: 2026-06-09 by roadmapper*
