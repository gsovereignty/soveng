# Phase 6: Layout Scaffold & Routing - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the 2-pane master-detail **shell** and wire deep-link routing end-to-end —
nothing more. Concretely, this phase delivers:

- The shadcn `Resizable` desktop split (sidebar left, reading pane right), filling the
  full viewport via an `h-screen` height chain, with both panels scrolling independently.
- All existing filter controls (hashtag facets, AND/OR toggle, ML on/off, confidence
  slider, download progress, hidden count) relocated into the sidebar panel, terminal
  aesthetic unchanged.
- `selectedNaddr` state + `selectedArticle` memo + hash sync (`window.location.hash`,
  `hashchange`, `history.pushState`), so an open article is deep-linkable and back/forward
  navigates between selections.
- A **stub** reading pane and a **stub** sidebar list good enough to prove routing works.

This is presentation-layer plumbing only. The data layer (SimplePool, nostrReducer,
NostrContext, the fetch/profile/reply hooks, useClassification worker, and the frozen memo
chain `sortedArticles → visibleArticles → facets → dynamicCounts → filteredArticles`) does
NOT change — the only addition is one `selectedArticle` memo appended after `filteredArticles`.

**Explicitly NOT this phase:** enriched inbox rows / image handling (Phase 7), the full
`ReadingPane` rendering `ArticleBody` Markdown (Phase 7), deletion of `ArticleCard`/
`ArticleList` (Phase 7), and the mobile list/reader swap (Phase 8). Phase 6 success criteria
are entirely desktop + deep-linking.

</domain>

<decisions>
## Implementation Decisions

### Desktop split & resize bounds
- **D-01:** Default split is **35% sidebar / 65% reading pane**. The 35% sidebar leaves
  room for the enriched inbox rows landing in Phase 7; the 65% pane keeps the long-form
  reader reading-focused.
- **D-02:** The resize drag handle **clamps the sidebar between 25% and 50%** (i.e.
  `ResizablePanel` `minSize`/`maxSize` on the sidebar panel). Reading pane takes the
  remainder.
- **D-03:** Panel width is **not persisted** across sessions (explicitly out of scope per
  REQUIREMENTS.md — a trivial future `onLayout`→localStorage extension if ever wanted).

### Sidebar control placement
- **D-04:** The sidebar panel is a **fixed-height pinned header + scrolling list** layout:
  a `shrink-0` header holds `ContentFilterControls` + `FilterBar` and stays in place; the
  article list lives in a `flex-1 overflow-y-auto` region below it that scrolls
  independently. Controls remain reachable while browsing the list.
- **D-05:** Because the controls now live in a pinned header, `FilterBar`'s current
  `sticky top-0 z-20` is **no longer needed** and should be dropped — sticky-in-a-scroll-
  container was the research-flagged fragility (SUMMARY "Gaps to Address"). Removing sticky
  is the fix, not preserving it. `FilterBar`'s props/logic are otherwise unchanged
  (reposition only).

### Phase-6 reading-pane content (stub scope)
- **D-06:** When a row is clicked or a deep link resolves, the reading pane renders a
  **minimal article-header stub: title + author (name + avatar) + timestamp**, with NO
  Markdown body yet. This proves the correct article resolved from the naddr and makes
  success criteria #3 (deep link opens the article) and #4 (back/forward) verifiable in
  this phase. Phase 7 inserts `<ArticleBody>` below this header — the header stub is
  forward-compatible, not throwaway.
- **D-07:** When nothing is selected, the pane shows the terminal placeholder
  `> select an article to read` (this is the READ-02 placeholder, scaffolded now).

### Cold-load & not-found UX (LINK-02)
- **D-08:** While a deep-linked `selectedNaddr` is present but `selectedArticle` is still
  null AND relays are still streaming, the pane shows a terminal loading line
  (e.g. `> resolving article from relays…`). Resolution is **reactive** — the
  `selectedArticle` memo (which falls back to `sortedArticles`) re-evaluates as each
  `ARTICLE_RECEIVED` arrives and the article appears automatically. No polling.
- **D-09:** "Not found" is tied to the **relay stream lifecycle, not an arbitrary timer**:
  once the stream has finished (NostrContext `status` has left `streaming` — i.e. reached
  the done/ready/empty terminal state) and the naddr is still unresolved, show
  `[404] article not found on connected relays` in terminal style. (Planner: confirm the
  exact non-streaming status value(s) against `nostrReducer.ts`.)

### Claude's Discretion
- Exact resize-handle styling/visual treatment within the terminal aesthetic.
- StrictMode double-mount / double-listener guard for the `hashchange` effect (pitfall P16
  in research) — standard cleanup pattern, planner/executor handles.
- The precise `#`-strip-before-decode and naddr encode/decode call sites (pitfalls
  P12/P13) — mechanical, follow research PITFALLS.md.
- Whether the stub sidebar list reuses the existing `ArticleList`/`ArticleCard` as-is for
  this phase or a thin throwaway list — as long as rows are clickable and set
  `selectedNaddr`. (These components are deleted in Phase 7 regardless.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & requirements
- `.planning/REQUIREMENTS.md` — v1.2 requirements; Phase 6 owns LAYOUT-01..04, LINK-01..03.
  Also the "Out of Scope (v1.2)" table (no router lib, no shadcn Sidebar, no filter-in-URL,
  no width persistence, no read/unread state).
- `.planning/ROADMAP.md` §"Phase 6: Layout Scaffold & Routing" — goal + 4 success criteria.

### Grounding research (read in full — HIGH confidence, source-verified)
- `.planning/research/SUMMARY.md` — executive summary, phase ordering, 4 top-risk surfaces,
  and the resolved wouter-vs-manual-hash / Resizable-vs-Sidebar debate.
- `.planning/research/ARCHITECTURE.md` — `AppShell` memo chain, where `selectedArticle`
  appends, `selectedNaddr` in AppShell (not NostrContext, D-10), component create/remove map.
- `.planning/research/PITFALLS.md` — P1 (path routing 404), P2 (cold-load async race),
  P4 (ResizablePanel `overflow:hidden` #3548), P9 (`h-full` height chain), P11 (selection
  in AppShell), P12 (`#` strip), P13 (hashchange initial load), P16 (StrictMode double
  listener). These are the Phase 6 pitfalls to mitigate.
- `.planning/research/STACK.md` — `react-resizable-panels@4.11.2` via
  `npx shadcn@latest add resizable`; `naddrEncode`/`decode` from `nostr-tools/nip19`
  (already installed); also `scroll-area`/`separator` if needed for panel internals.
- `.planning/research/FEATURES.md` — Phase 6 "must have" feature framing.

### External docs (cited by research)
- https://ui.shadcn.com/docs/components/resizable — ResizablePanelGroup/Panel/Handle API.
- shadcn-ui/ui issue #3548 — the `overflow:hidden` scroll bug; fix = inner
  `div h-full overflow-y-auto` wrapper inside each panel.
- NIP-19 (nips.nostr.com/19) — `naddr` = kind:30023 + pubkey + d-tag identifier.
- MDN — `history.pushState`, `hashchange`, mixed-content (for later phases).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/App.tsx` `AppShell` — owns all local UI filter state and the full memo chain.
  `selectedNaddr` (useState) and `selectedArticle` (useMemo, appended after
  `filteredArticles`, searching `filteredArticles` then `sortedArticles`) belong here,
  mirroring the D-10 "selection lives in AppShell, not context" pattern.
- `src/components/FilterBar.tsx` — moves into the sidebar pinned header verbatim; drop its
  `sticky top-0 z-20` (D-05), no prop/logic change.
- `src/components/ContentFilterControls.tsx` — moves into the sidebar pinned header, no change.
- `src/components/ArticleList.tsx` / `ArticleCard.tsx` — usable as the stub list this phase
  (rows must set `selectedNaddr` on click); both are deleted in Phase 7.
- `src/lib/nostr.ts` — add an `articleNaddr(article)` helper wrapping
  `naddrEncode({ kind: 30023, pubkey, identifier: article.d })`; mirror the existing
  `npubEncode` try/catch fallback discipline (03-01 decision).
- `getMonogram` / `formatTimestamp` / `Avatar` — reuse for the reading-pane header stub.

### Established Patterns
- **Frozen memo chain:** `sortedArticles → visibleArticles → facets → dynamicCounts →
  filteredArticles` must NOT change. `selectedArticle` is the only append (P11/ARCHITECTURE).
- **State-in-AppShell, never NostrContext** (D-10) — avoids re-render storms during relay
  streaming; `selectedNaddr` follows this.
- **Module-scope singletons** (pool.ts, classifier worker) — irrelevant to add here, but the
  `hashchange` listener must use a StrictMode-safe `useEffect` add/remove cleanup (P16).

### Integration Points
- Outer `AppShell` wrapper changes from `min-h-screen … flex-col items-center justify-center`
  (centered single column) to a full-viewport `h-screen flex flex-col overflow-hidden`
  shell hosting `ResizablePanelGroup`. `html`, `body`, `#root` get `height: 100%` in
  `src/index.css` so the `h-full` chain resolves (P9) — this is the FIRST thing scaffolded;
  every scroll test depends on it.
- Each `ResizablePanel` wraps its scrollable content in an inner
  `<div className="flex-1 overflow-y-auto">` (or `h-full overflow-y-auto`) to defeat the
  injected `overflow:hidden` (P4/#3548) — never put `overflow-y-auto` directly on the panel.
- The CRT chrome (`crt-scanlines crt-flicker`, terminal tokens) stays on the outer shell so
  the aesthetic (LAYOUT-03) is preserved across both panes.

</code_context>

<specifics>
## Specific Ideas

- Loading line copy: terminal-styled, e.g. `> resolving article from relays…`.
- Not-found copy: `[404] article not found on connected relays` (matches the existing
  `[ERR]` / `[EMPTY]` / `[FILTER]` bracketed-tag convention in `App.tsx`).
- Empty-selection placeholder: `> select an article to read` (READ-02 wording).
- Split feel: reading-focused (35/65), not email-balanced — this is a long-form reader first.

</specifics>

<deferred>
## Deferred Ideas

- **Persisted sidebar width** (`onLayout`→localStorage) — out of scope per REQUIREMENTS.md;
  trivial future extension.
- **Collapsible controls section** in the sidebar — considered for control placement;
  rejected for Phase 6 as extra UI work bordering on Phase 7+ scope. Pinned header chosen.
- **Mobile list/reader swap** (MOBILE-01..03) — Phase 8. Phase 6 does NOT scaffold the CSS
  visibility swap; it builds the desktop shell only. (Research's "Phase 1 mobile scaffold"
  note is superseded by the roadmap putting all mobile work in Phase 8.)
- **j/k keyboard navigation** + `role=listbox`/`role=option` ARIA — ARIA baseline lands with
  the enriched list in Phase 7; keyboard nav is a deferred v1.x "should have".
- **wouter router / shadcn Sidebar** — rejected by research consensus; manual hash +
  Resizable only. Recorded so it is not revisited.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 6-layout-scaffold-routing*
*Context gathered: 2026-06-09*
