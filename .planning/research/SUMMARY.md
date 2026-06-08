# Project Research Summary

**Project:** Soveng — Nostr Long-Form Reader, v1.2 Email-Client Layout
**Domain:** Presentation-layer refactor: 2-pane master-detail layout for a static-hosted React SPA
**Researched:** 2026-06-08
**Confidence:** HIGH

## Executive Summary

The v1.2 milestone is a pure presentation-layer refactor. The data layer — SimplePool singleton, nostrReducer, NostrContext, the useArticleFetch/useProfileFetch/useReplyFetch hooks, the useClassification worker, and the full memo chain in AppShell — does not change. The only structural addition is a single derived memo (`selectedArticle`) appended after `filteredArticles`. Everything else is a rearrangement and replacement of display components: the inline-accordion reader becomes a dedicated reading pane, the flat article list replaces ArticleCard/ArticleList, and the single-column layout becomes a resizable 2-pane split.

The recommended implementation uses `ResizablePanelGroup` + `ResizablePanel` (shadcn `Resizable`) for the desktop split, and manual `window.location.hash` + `hashchange` + `history.replaceState` for deep-linking — with no router library. Three researchers who read the actual codebase (FEATURES, ARCHITECTURE, PITFALLS) converged independently on this no-router, Resizable-only approach. The STACK researcher recommended the shadcn `Sidebar` component and the `wouter` library as additions; the majority position, grounded in source-code inspection, is that neither is needed and both add complexity that fights against the content-list pattern. The dissent is worth knowing: `wouter` adds only 1.5KB and its `useSearchParams` API is more idiomatic in React than manual hash wiring; the `shadcn Sidebar` provides offcanvas mobile handling for free. If the team finds manual hash wiring fiddly during implementation, `wouter` is a low-cost upgrade — but the default plan is zero new routing dependency.

The four highest-risk surfaces that require specific mitigation during implementation are: (1) the deep-link cold-load async race, where the naddr from the URL must be held in a pending state and resolved reactively as articles stream in from relays; (2) untrusted `image` URLs in sidebar rows, which require `referrerPolicy="no-referrer"`, HTTPS-only guard, `loading="lazy"`, and `onError` fallback before any `<img>` renders; (3) preserving `rehype-sanitize` in the `ArticleBody` pipeline when the component is lifted out of the Accordion context into `ReadingPane`; and (4) the `react-resizable-panels` `overflow:hidden` inline-style bug (shadcn-ui issue #3548) that silently clips scroll content inside panels unless an inner wrapper div establishes the scroll context.

---

## Key Findings

### Recommended Stack

The base stack (Vite 8 + React 19 + TypeScript 5 + shadcn/ui new-york Tailwind v4 + nostr-tools 2.23.5 + react-markdown + Vitest) is unchanged. The only confirmed-necessary net-new npm dependency is `react-resizable-panels@4.11.2`, installed automatically by `npx shadcn@latest add resizable`. The shadcn CLI will also need `npx shadcn@latest add scroll-area` and `npx shadcn@latest add separator` for panel-internal scrolling and section dividers. NIP-19 encoding for deep links uses `naddrEncode`/`decode` from `nostr-tools/nip19` — already installed, no new library needed.

**Core technologies (net-new for v1.2):**
- `react-resizable-panels` (via shadcn `Resizable`): desktop 2-pane draggable split — the only new npm runtime dep; ~536KB unpacked, small gzipped footprint
- `nostr-tools/nip19` subpath: `naddrEncode({ kind: 30023, pubkey, identifier: article.d })` for URL hash deep links — already in `package.json`
- Manual hash routing (`window.location.hash` + `hashchange` + `history.replaceState`): zero-dep deep-linking that is correct for a static GitHub Pages SPA with `base: "/soveng/"`

**STACK researcher dissent — wouter@3 and shadcn Sidebar:**
The STACK researcher recommended `wouter@3.10.0` (1.5KB gzip) for hash routing and the shadcn `Sidebar` component for the left-panel shell. The FEATURES, ARCHITECTURE, and PITFALLS researchers — all of whom read the source code — independently concluded that `wouter` is unnecessary for a single URL parameter and that the shadcn `Sidebar` (designed for nav drawers with icon rails, cookie-based state, and offcanvas sheets) is the wrong primitive for a scrollable article-list panel. The consensus recommendation is `Resizable`-only with manual hash wiring. The trade-off: manual hash wiring requires careful handling of ~4 edge cases (initial mount read, `hashchange` listener, `#` strip before decode, back/forward) while `wouter`'s `useSearchParams` handles these idiomatically. If those edge cases cause implementation friction, `wouter` is a clean drop-in upgrade.

### Expected Features

The v1.2 feature set is well-defined from PROJECT.md's current milestone section and confirmed by source inspection. All data prerequisites are already in the `Article` type and `Profile` map.

**Must have (table stakes — P1 launch):**
- 2-pane ResizablePanelGroup layout (desktop) + full-screen CSS swap (mobile)
- Selected-row highlight — visual state on the active sidebar row
- Reading pane with `ArticleBody` reused verbatim — the central correctness guarantee
- Terminal placeholder: `> select an article to read` when nothing is selected
- Independent scroll in sidebar list and reading pane (separate overflow contexts)
- ENRICH-01 enriched sidebar rows — title, author avatar+name, timestamp always; summary snippet and thumbnail with graceful fallbacks when absent
- Mobile back control — `< back to list` button; full-screen swap driven by `selectedId !== null`
- Deep-linkable selection — naddr in URL hash, restored on cold load, back/forward works

**Should have (add after validation — v1.x):**
- j/k keyboard navigation — expected by power/developer users; `role=listbox` / `role=option` ARIA is required for the list regardless
- Persisted sidebar width — `ResizablePanelGroup` `onLayoutChange` to `localStorage`; trivial

**Defer to v2+:**
- Clickable tag pills (ENRICH-02) — already deferred in PROJECT.md
- Per-relay status indicator (ENRICH-03) — already deferred in PROJECT.md
- Mark as read/unread — local-only, accumulates indefinitely, no relay-side persistence
- Collapse sidebar to icon rail — high complexity for a sidebar holding checkboxes, not nav icons

**Open product decision to resolve in requirements:**
When a filter hides the currently selected article, should the reading pane stay open (email-client convention: filter does not close the open email) or clear to the placeholder? The ARCHITECTURE researcher recommends staying open (fallback to `sortedArticles` in the `selectedArticle` memo). The PITFALLS researcher suggests showing a "hidden by filter" notice instead of stale content. Both approaches are one-line changes from the same base implementation. The requirements phase must pick one and record it as a key decision.

### Architecture Approach

This is a component-tree restructuring within `AppShell` with no changes downstream of `filteredArticles` in the memo chain and no changes to the data layer. The existing memo chain (`sortedArticles → visibleArticles → facets → dynamicCounts → filteredArticles`) is preserved exactly. One new memo is appended: `selectedArticle`, derived from `selectedNaddr` string state (held in AppShell, synced to `window.location.hash`), which searches `filteredArticles` first and falls back to `sortedArticles` to handle both the filter-hides-selection and cold-load cases.

**Components being created:**
1. `SidebarRow.tsx` — single inbox-style article row; pure presentational; `isSelected` prop-passed, not from context; reuses existing `Avatar` / `getMonogram` / `formatTimestamp` logic from `ArticleCard`
2. `ArticleListSidebar.tsx` — scrollable article list for the sidebar panel; wraps `SidebarRow` rows; no Accordion, no `openId` state
3. `ReadingPane.tsx` — right pane; wraps `ArticleBody` unchanged; handles three states: no selection (placeholder), cold-load pending (loading text), and article present (header + body)

**Components being removed:**
- `ArticleCard.tsx` (Accordion-based) — interior display logic migrates to `SidebarRow`
- `ArticleList.tsx` (Accordion wrapper) — superseded by `ArticleListSidebar`

**Components unchanged (must not be modified):**
- `ArticleBody.tsx` — security boundary; `rehype-sanitize` pipeline must be preserved as-is
- `FilterBar.tsx` — repositioned into sidebar panel only; no logic or prop changes
- `ContentFilterControls.tsx` — repositioned into sidebar panel only; no changes
- All of `src/context/`, `src/hooks/`, `src/lib/pool.ts`, `src/lib/nostr.ts` (except adding `articleNaddr` helper)

**Key layout constraint:** `AppShell`'s outer wrapper must change from `min-h-screen flex-col` to `h-screen flex-col overflow-hidden`, and `html / body / #root` must be `height: 100%` so that `h-full` chains resolve correctly inside `ResizablePanelGroup`. Without this, both panels grow with content instead of scroll-containing.

### Critical Pitfalls

1. **ResizablePanel `overflow:hidden` breaks scroll (P4, issue #3548)** — `react-resizable-panels` injects inline `overflow: hidden` on every `Panel` element, overriding Tailwind utility classes. Prevent by wrapping all scrollable content in an intermediate `<div className="flex-1 overflow-y-auto">` inside each `ResizablePanel` — never nest `ScrollArea` or `overflow-y-auto` directly as a panel child.

2. **Cold-load deep-link async race (P2)** — On cold load with a hash URL, `articles` is `[]` when AppShell mounts. The `selectedArticle` memo must search `sortedArticles` (not only `filteredArticles`) so that as each `ARTICLE_RECEIVED` dispatch updates the memo chain, the reactive re-evaluation finds the article automatically. No polling or timeout needed — the memo dependency on `sortedArticles` handles it. Additionally, the `hashchange` listener in `useEffect` must coexist with the `useState` initializer that reads `window.location.hash` synchronously on mount — both paths are required (initial load vs. navigation events).

3. **Untrusted `image` URLs in sidebar rows (P6, P7)** — Every sidebar `<img>` must have `referrerPolicy="no-referrer"`, `crossOrigin="anonymous"`, `loading="lazy"`, explicit `width`/`height`, and an `onError` handler that hides the element. Additionally, only render if `article.image?.startsWith('https://')` — HTTP URLs on the HTTPS GitHub Pages host cause mixed-content browser blocks. These guards must be part of the initial `SidebarRow` implementation, not a follow-up.

4. **rehype-sanitize must survive the Accordion-to-ReadingPane refactor (P8)** — The risk moment is when `<ArticleBody content={...} />` is lifted from `AccordionContent` into `ReadingPane`. The component must be used unchanged — never inlined or rewritten. Add a security comment in `ReadingPane` that names `rehype-sanitize` as a required dependency of `ArticleBody`.

5. **`h-full` resolves to zero without explicit height ancestor (P9)** — `min-h-screen` on AppShell is wrong for a 2-pane layout; it allows content to grow unbounded instead of constraining to viewport. Change to `h-screen` (or `h-dvh` on mobile for iOS Safari chrome). Add `height: 100%` to `html`, `body`, and `#root` in `index.css`. This must be the very first thing scaffolded — every subsequent scroll test depends on the height chain being correct.

---

## Implications for Roadmap

All four researchers converged on a 3-phase implementation order. The phasing below reflects that consensus.

### Phase 1: Layout Scaffold + Routing Plumbing

**Rationale:** The height chain, ResizablePanel scroll wrapper, hash routing machinery, `selectedNaddr` state, and `selectedArticle` memo are all foundational. Every subsequent phase depends on them being correct. Getting layout and routing wrong here means reworking later phases. Phase 1 must be verified with scroll tests (20+ articles, independent panels) and deep-link tests (cold load, back button, StrictMode double-mount) before Phase 2 begins.

**Delivers:** Full 2-pane ResizablePanelGroup shell (desktop) + CSS-only full-screen swap scaffold (mobile); `selectedNaddr` state in AppShell; `selectedArticle` memo; hash read-on-mount + `hashchange` listener; `articleNaddr` helper in `src/lib/nostr.ts`; FilterBar + ContentFilterControls repositioned into left panel; stub `ArticleListSidebar` (existing article list, not yet enriched); stub `ReadingPane` (placeholder only); verified independent scroll in both panels.

**Features addressed:** 2-pane layout, sidebar holds all controls, terminal placeholder empty state, deep-linkable selection foundation, mobile scaffold

**Pitfalls to address in this phase:** P1 (path routing 404), P2 (cold-load async race), P4 (ResizablePanel overflow:hidden), P9 (h-full height chain), P11 (selection in AppShell not NostrContext), P12 (hash # strip), P13 (hashchange initial load), P16 (StrictMode double listener)

**Research flags:** Standard patterns — no additional research needed for this phase.

---

### Phase 2: Reading Pane + ENRICH-01 Sidebar Rows

**Rationale:** With layout and routing confirmed working, the reading pane and sidebar row content can be built without risk of the scaffold changing underneath them. ENRICH-01 (image handling, summary fallback, avatar) belongs here alongside the reading pane because both are output surfaces for article data — the security and privacy requirements for both (rehype-sanitize preservation, image URL guards) are best reviewed as a single unit.

**Delivers:** Full `ReadingPane` (article header + `ArticleBody` + cold-load placeholder); `SidebarRow` with ENRICH-01 content (title, author avatar+name, timestamp always present; summary snippet and thumbnail with fallbacks); `isSelected` highlight on active row; scroll reset on article switch (`key={selectedNaddr}` on reading pane scroll container); deletion of `ArticleCard.tsx` and `ArticleList.tsx`; ARIA `role=listbox` / `role=option` / `aria-selected` markup on the article list.

**Features addressed:** Reading pane with ArticleBody, selected-row highlight, ENRICH-01 enriched rows, terminal placeholder (reading pane), accessibility baseline

**Pitfalls to address in this phase:** P6 (tracking pixels from untrusted images), P7 (mixed-content http:// images), P8 (rehype-sanitize preserved in ReadingPane), P10 (scroll position reset on article switch), P15 (ARIA on the article list)

**Research flags:** Standard patterns for all items. Image privacy/security is well-documented; ARIA listbox pattern is from APG and is established.

---

### Phase 3: Mobile Swap + Polish

**Rationale:** Mobile list/reader swap is a separate layout mode that can be scaffolded last because it shares all the state machinery built in Phase 1. Building mobile last avoids designing around mobile constraints during the desktop scaffold phase. Key mobile-specific pitfall (scroll position preserved via CSS visibility not conditional mount) is isolated to this phase.

**Delivers:** Mobile full-screen list and reading pane (CSS `hidden md:flex` / `flex md:hidden` conditional visibility, not conditional mounting); `< back to list` button visible only on mobile when article is selected; verified scroll position preserved on back navigation (list stays at position because it remains mounted); `onBack` prop wired to `ReadingPane`; `ResizablePanelGroup` conditionally rendered only on `md:` and above (or suppressed with minSize guards).

**Features addressed:** Mobile list/reader swap, mobile back control

**Pitfalls to address in this phase:** P5 (Resizable drag handle unusable on mobile — suppress at small viewports), P14 (mobile list scroll position lost — use CSS visibility, not unmount)

**Research flags:** Standard patterns — CSS breakpoint swap is well-established. No additional research needed.

---

### Phase Ordering Rationale

- Phase 1 must come first because height chain, scroll containment, and hash routing are depended on by every other component. Discovering a layout correctness issue in Phase 2 after ENRICH-01 is built would require undoing component work.
- Phase 2 bundles the reading pane with ENRICH-01 because both involve displaying article content and both carry security requirements (sanitization, image URL guards) that are easiest to audit together.
- Phase 3 isolates mobile because it shares all state from Phase 1 but introduces no new data requirements — it is purely a CSS/conditional-render concern that is cleanest when the desktop layout is already stable.
- The open product decision (filter hides selected article: stay open vs. clear) must be made before Phase 1 implementation begins, because it determines whether the `selectedArticle` memo falls back to `sortedArticles` or restricts to `filteredArticles`.

### Research Flags

Phases with standard patterns (no additional research-phase needed):
- **Phase 1:** Hash routing is a well-documented browser API pattern; `react-resizable-panels` behavior is confirmed from shadcn docs and issue tracker.
- **Phase 2:** ENRICH-01 data fields confirmed in source; `ArticleBody` reuse is trivial; ARIA listbox is from APG.
- **Phase 3:** CSS breakpoint swap is standard Tailwind; no new libraries or APIs.

No phase requires `/gsd-plan-phase --research-phase` — all unknowns are resolved by this research.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | STACK researcher verified npm package sizes, API availability, and version compatibility. The wouter vs. manual-hash disagreement is documented and resolved. No unknown dependencies. |
| Features | HIGH | FEATURES researcher read actual source (`src/types/nostr.ts`, `src/lib/nostr.ts`, `src/components/ArticleCard.tsx`, `vite.config.ts`). All data prerequisites confirmed present in existing `Article` type. |
| Architecture | HIGH | ARCHITECTURE researcher read `src/App.tsx` lines 37-83 (memo chain), all context/hook files, and component interfaces. Integration points are concrete and file-specific. |
| Pitfalls | HIGH | PITFALLS researcher verified against installed `node_modules` (rehype-sanitize schema, nostr-tools nip19), shadcn-ui issue tracker (P4 issue #3548 confirmed), and existing codebase patterns (D-10, StrictMode singleton pattern). |

**Overall confidence:** HIGH

### Gaps to Address

- **Open product decision — filter-hides-selection behavior:** Research documents both options (reading pane stays open vs. shows "hidden by filter" notice) but does not decide. The requirements phase must record this as a key decision. The ARCHITECTURE researcher prefers "stay open" (email-client convention); PITFALLS researcher prefers "hidden by filter" notice (avoids stale content). Both are one-line changes from the same base.

- **`FilterBar` sticky positioning inside scrollable sidebar panel:** The current `FilterBar` uses `sticky top-0 z-20`. When moved into an `overflow-y-auto` sidebar panel, sticky behavior depends on the panel being the scroll ancestor. This should be verified immediately in Phase 1 — if sticky behavior breaks, the control bar must be restructured (fixed height header + scrollable list below it within the panel).

- **`shadcn Sidebar` not installed — confirm Resizable-only is sufficient:** PROJECT.md's original "use existing shadcn Sidebar/Resizable" was a pre-research guess. The confirmed approach is `Resizable`-only. If mobile offcanvas behavior becomes desirable in a future milestone, `Sidebar` is available — it is not needed now.

---

## Sources

### Primary (HIGH confidence — official docs and codebase)

- `src/App.tsx`, `src/context/NostrContext.tsx`, `src/context/nostrReducer.ts` — memo chain, state shape, data layer boundaries (read in full by ARCHITECTURE researcher)
- `src/components/ArticleCard.tsx`, `ArticleBody.tsx`, `ArticleList.tsx`, `FilterBar.tsx`, `ContentFilterControls.tsx` — component interfaces and display logic confirmed
- `src/types/nostr.ts`, `src/lib/nostr.ts` — Article type fields `summary`, `image`, `d`, `coordinate`, `pubkey` confirmed present
- `src/lib/pool.ts`, `src/hooks/useClassification.ts` — module-level singleton pattern; confirmed data layer is separate and unchanged
- `node_modules/nostr-tools/lib/types/nip19.d.ts` — `naddrEncode(AddressPointer)` confirmed available at nostr-tools@2.23.5
- `node_modules/hast-util-sanitize/lib/schema.js` — confirmed sanitize schema for `img` attributes
- `vite.config.ts` — `base: "/soveng/"` confirmed; static GitHub Pages constraint confirmed
- `.planning/PROJECT.md` — v1.2 milestone scope, Key Decisions table, D-10 pattern reference
- `package.json` — confirmed no react-router-dom; react-resizable-panels not yet installed
- https://ui.shadcn.com/docs/components/resizable — ResizablePanelGroup/Panel/Handle API
- https://ui.shadcn.com/docs/components/sidebar — SidebarProvider structure (basis for STACK recommendation and majority rejection)
- shadcn-ui/ui issue #3548 — ScrollArea/scroll inside ResizablePanel overflow:hidden confirmed bug
- NIP-19 specification (nips.nostr.com/19) — naddr encoding: kind + pubkey + d-tag identifier
- MDN — `history.replaceState`, `hashchange` event, mixed content blocking
- ARIA APG Listbox Pattern — role=listbox, role=option, aria-selected, keyboard navigation

### Secondary (MEDIUM confidence)

- https://github.com/molefrog/wouter — useHashLocation, useSearchParams, ~1.5KB gzip (STACK researcher's recommended alternative; rejected by majority)
- npm registry — package size verification: wouter@3.10.0, react-resizable-panels@4.11.2
- https://nostrbook.dev/kinds/30023 — naddr deep-link convention for kind:30023
- React docs — "Preserving and Resetting State": CSS visibility vs conditional mounting for scroll preservation

---

*Research completed: 2026-06-08*
*Ready for roadmap: yes*
