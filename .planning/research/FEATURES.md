# Feature Research

**Domain:** Email-client / master-detail reading layout for a Nostr long-form article reader (v1.2 milestone)
**Researched:** 2026-06-08
**Confidence:** HIGH — grounded in codebase inspection, NIP-23 spec, and established UX patterns for master-detail layouts

---

## Context: What Already Exists

v1.1 shipped the following components that v1.2 REUSES, not replaces:

| Existing Component | Role in v1.2 |
|-------------------|--------------|
| `ArticleBody` (react-markdown + rehype-sanitize) | Reading pane body — zero changes needed |
| `FilterBar` (hashtag checkboxes + AND/OR toggle) | Moves into sidebar — no logic changes |
| `ContentFilterControls` (Switch, Slider, Progress, Badge) | Moves into sidebar — no logic changes |
| `ArticleCard` (Accordion-based) | REPLACED by a flat sidebar row (ENRICH-01) + reading pane |
| `ArticleList` (Accordion wrapper) | REPLACED by a flat scrollable list inside the sidebar panel |
| `AppShell` layout (single-column `max-w-2xl`) | REPLACED by 2-pane ResizablePanelGroup |

The Article type already carries all fields needed for ENRICH-01:
- `title` — string | undefined (already has fallback chain in ArticleCard)
- `summary` — string | undefined (already parsed from NIP-23 `summary` tag)
- `image` — string | undefined (already parsed from NIP-23 `image` tag)
- `publishedAt` — ms epoch (already formatted by formatTimestamp)
- `pubkey` → Profile.picture, Profile.displayName (already resolved)

nostr-tools NIP-19 already ships `naddrEncode(AddressPointer)` and `decode(string)` — the address pointer takes `{ identifier: string, pubkey: string, kind: number }`, mapping directly onto Article fields `d`, `pubkey`, and `30023`.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the layout MUST have. Missing any of these makes the product feel broken or unfinished relative to the email-client mental model the v1.2 goal invokes.

| Feature | Why Expected | Complexity | Existing Dependency |
|---------|--------------|------------|---------------------|
| **Selected-row highlight** — clicking a sidebar row marks it visually selected and persists that highlight while the article is open | Every email client, RSS reader, and news app highlights the active item; absence feels like a broken click | LOW | New state `selectedArticleId: string \| null` in AppShell; sidebar row reads it to apply active CSS class |
| **Reading pane shows selected article** — clicking a row renders the full Markdown body in the right pane | Core purpose of the layout; without it the sidebar is just a list going nowhere | MEDIUM | Reuses ArticleBody verbatim; no changes to sanitization or rendering pipeline |
| **Terminal placeholder empty state** — when nothing is selected, the reading pane shows `> select an article to read` in terminal style | Empty pane with no content is disorienting; users expect a prompt or guide | LOW | New static JSX in reading pane component; no data dependency |
| **Sidebar holds all controls** — hashtag facets, AND/OR toggle, ML filter controls live in the sidebar, not above the reading pane | Controls must stay reachable without collapsing the reading view; sidebar is the natural home | LOW | FilterBar and ContentFilterControls move as-is; only their container changes |
| **Sidebar is scrollable, reading pane is independently scrollable** — scrolling the article list does not scroll the article body and vice versa | Standard email-client contract; violating it (shared scroll) confuses users and makes long articles unusable | LOW | CSS overflow-y: auto on each panel; shadcn ResizablePanel handles containment |
| **Mobile: full-screen list, tap to open full-screen reader** — on narrow viewports the two-pane layout collapses to a stack; tapping an article row fills the screen with the article | Mobile email clients (Gmail, Fastmail mobile) use this pattern; users expect it on small screens | MEDIUM | Breakpoint-driven conditional render; CSS `hidden md:flex` pattern; no router needed |
| **Mobile back control** — a visible `< back` affordance returns from the article to the list on mobile | Without it, users are stranded in the article and must use the browser back button, which may not work as expected in a static SPA | LOW | A single `setSelectedArticleId(null)` call wired to a button; visible only on mobile when article is selected |
| **Deep-linkable selection** — the selected article is encoded in the URL so the page can be shared and the back button works | Users expect a URL to "mean something" — sharing a link that opens on the article list rather than the selected article breaks sharing | MEDIUM | See deep-link section below; uses URL hash fragment to avoid GitHub Pages path routing issues |

### Differentiators (Competitive Advantage)

Features that elevate the UX beyond baseline expectations without scope-creeping into v1.3 territory.

| Feature | Value Proposition | Complexity | Existing Dependency / Notes |
|---------|-------------------|------------|------------------------------|
| **ENRICH-01: Inbox-style sidebar rows** — each row shows title, author avatar + name, relative timestamp, summary snippet (truncated), and a thumbnail when `image` is present | Transforms the sidebar from a plain title list into a scannable inbox; users can triage articles before opening them | MEDIUM | All data already in the Article type and Profile map; new sidebar row component replaces ArticleCard's Accordion trigger; Avatar already in ui/avatar |
| **ENRICH-01 hero thumbnail** — when `image` tag is present, show a small fixed-size thumbnail (e.g. 48x48 or 64x64) in the sidebar row | Visual differentiation between articles; common in RSS readers (Reeder, NetNewsWire) and news apps | LOW | `article.image` is already parsed; just render `<img>` with onerror fallback; no new data fetch |
| **Resizable sidebar** — user can drag the handle to adjust sidebar width within min/max bounds | Reduces friction for users with long article titles or many hashtag facets | LOW | shadcn Resizable (react-resizable-panels) is available via `npx shadcn add resizable`; single ResizablePanelGroup wrapping sidebar + reading pane |
| **j/k or arrow-key navigation** — with focus on the sidebar list, pressing j/k or down/up selects the next/previous article | Power-user shortcut expected by developers and Nostr-native users familiar with terminal tools; aligns with the terminal aesthetic | MEDIUM | useEffect + keydown listener; requires tracking `selectedIndex` alongside `selectedArticleId`; no library needed |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Deep-link restores active filters (selected tags + match mode)** | "Share this filtered view" is a natural follow-on to sharing a selected article | Filters are ephemeral UI state (user-built, session-bound); encoding them in the URL bloats the hash significantly (multiple tags as query params), complicates parse/serialize logic, and creates a confusing UX when someone follows a link to a filtered view they did not set up. The selected article is the meaningful shareable unit, not the filter state. | Restore selected article from URL hash; leave filter state session-only. Explicitly out of scope for v1.2 (not in PROJECT.md target features). |
| **Animate the list↔detail transition on mobile** | Slide animation looks polished in native apps | CSS transitions on display:none/block require careful orchestration to avoid layout thrash; can regress accessibility (prefers-reduced-motion must be respected); adds complexity for minimal gain in a terminal-aesthetic app | Instantaneous swap with no animation is acceptable and consistent with the terminal aesthetic; implement with a CSS breakpoint class swap only |
| **Collapse sidebar to icon rail** — icon-only collapsed sidebar like VS Code | Saves horizontal space for reading | Adds a collapsed-state layer (tooltips, collapse button, icon mapping) for every control currently in the sidebar (facets, sliders); high complexity for a sidebar that mostly holds checkboxes and sliders, not navigation icons | shadcn ResizablePanel supports a minSize constraint (e.g. 20%); collapsing to 0 is possible but icon-rail mode is not worth implementing in v1.2. Use a fixed min-size instead. |
| **Mark as read / unread state** — visual distinction between opened and unopened articles | Email-client analogy invites this | Nostr is a public read-only stream; "read" state is purely local and ephemeral (articles are re-fetched fresh each load). Persisting per-article read state to localStorage adds a growing key set that accumulates indefinitely. No relay-side persistence exists. | Selected-row highlight (which clears on page reload) is sufficient for a single-session reader. Read/unread is explicitly out of scope (the app is a discovery tool, not an inbox manager). |
| **Infinite scroll / load more** in the sidebar | Email clients load more messages; users expect to scroll beyond the current article count | The article count is deliberately fixed (reply-count–ranked, not time-paged). Adding load-more conflicts with the editorial curation model and requires relay subscription management changes. CONF-02 (adjustable feed length) is deferred to a later milestone. | The fixed list is a feature, not a limitation; surface the count ("21 articles") so users understand the curation model. |

---

## Feature Dependencies

```
[ENRICH-01 sidebar row]
    ├──reads──> article.title (already in Article type)
    ├──reads──> article.summary (already in Article type)
    ├──reads──> article.image (already in Article type)
    ├──reads──> article.publishedAt (already in Article type, via formatTimestamp)
    └──reads──> profiles[article.pubkey] (already in NostrContext)

[Reading pane]
    └──reuses──> ArticleBody (zero changes)

[Deep-link selection]
    ├──requires──> naddrEncode from nostr-tools/nip19 (already in package.json)
    ├──requires──> URL hash read on mount (window.location.hash)
    ├──requires──> URL hash write on selection (history.replaceState or hash assignment)
    └──requires──> popstate listener for browser back/forward

[Mobile list↔reader swap]
    └──requires──> selectedArticleId state (shared with desktop selection)

[Sidebar layout]
    ├──contains──> FilterBar (moved as-is, no prop changes)
    ├──contains──> ContentFilterControls (moved as-is, no prop changes)
    └──contains──> article list (new flat rows replacing ArticleList/ArticleCard accordion)

[2-pane ResizablePanelGroup]
    ├──requires──> shadcn Resizable component (not yet installed, run: npx shadcn add resizable)
    └──requires──> AppShell layout refactor (single-column max-w-2xl → full-width flex)
```

### Dependency Notes

- **Reading pane requires ArticleBody unchanged:** The sanitization pipeline (react-markdown + rehype-sanitize) must not be modified as part of the layout refactor. ArticleBody is extracted and reused as-is.
- **Sidebar row replaces ArticleCard's Accordion trigger:** ArticleCard's Accordion-based expand mechanism is retired. The new sidebar row is a plain button/div with selected-state styling. ArticleBody is moved from AccordionContent to the reading pane.
- **Deep-link requires hash-based URL, not pathname routing:** The app has `base: "/soveng/"` in vite.config.ts and no 404.html fallback. Path-based routing (e.g. `/soveng/article/naddr1...`) would 404 on hard reload. Hash fragments (`/soveng/#naddr1...`) work reliably on static hosts without a router library. No react-router dependency is needed.
- **Mobile swap is CSS + state, not a router transition:** On mobile, `selectedArticleId !== null` → hide list, show reading pane. Back button calls `setSelectedArticleId(null)`. This avoids adding a routing library for a two-state toggle.

---

## ENRICH-01 Sidebar Row Content Specification

NIP-23 defines `title`, `summary`, `image`, `published_at` as strictly optional tags. The codebase already parses all four into the Article type (confirmed in `src/lib/nostr.ts: parseArticle`). The following specifies what to show and the fallback for each absent field:

| Row Element | Source | Fallback |
|-------------|--------|----------|
| **Title** | `article.title` (NIP-23 `title` tag) | First sentence of `article.summary` truncated to 80 chars, then `"(untitled)"` — matches existing ArticleCard logic (DISP-01) |
| **Author avatar** | `profile.picture` (from kind:0) | Avatar monogram fallback — already implemented in ArticleCard's `getMonogram()`, reuse verbatim |
| **Author name** | `profile.displayName` (display_name → name from kind:0) | Truncated npub (first 12 chars + "…") — already in ArticleCard (DISP-02), reuse verbatim |
| **Timestamp** | `article.publishedAt` via `formatTimestamp()` | `article.createdAt` is always present (event.created_at × 1000); formatTimestamp already handles both (DISP-03) |
| **Summary snippet** | `article.summary` (NIP-23 `summary` tag), truncated to ~120 chars | First ~120 chars of `article.content` (raw Markdown — strip leading `#` heading if present); if content is also empty, omit snippet row entirely |
| **Hero thumbnail** | `article.image` (NIP-23 `image` tag) — render as small fixed-size img (48×48 or 64×48) | Omit the thumbnail slot entirely; do NOT show a placeholder box (placeholder boxes create a "broken image" visual when image is absent for most Nostr articles) |

**Content-stripping note for summary fallback:** When falling back to `article.content`, strip leading `#` Markdown headings (regex `^#+\s+.+\n?`) before taking the first 120 characters, to avoid showing a heading as the snippet.

**Image loading failure:** Wire `onError` on the thumbnail `<img>` to set a local state flag and hide the img element. This prevents broken-image icons.

**Prevalence context:** In the wild, NIP-23 articles frequently omit `summary` and `image`. A content-analysis of current Nostr long-form articles shows these are author-optional. The sidebar must degrade gracefully to title+author+timestamp rows when both are absent, which is the baseline for many articles.

---

## Deep-Link Selection: Scope and Mechanism

**What the URL encodes:** The selected article's NIP-19 `naddr` — a bech32-encoded address pointer containing `{ kind: 30023, pubkey, identifier: article.d }`. This is the stable, relay-agnostic canonical identifier for a NIP-23 article.

**What the URL does NOT encode:** Active filter tags, match mode, spam threshold, or filter enabled state. These are ephemeral session UI state. A shared URL opens the app with filters cleared and the selected article visible — which matches user expectation for "share this article".

**Mechanism:**
- On mount: read `window.location.hash`, attempt `decode()` from nostr-tools/nip19, if result is `type: 'naddr'` and the `identifier + pubkey` matches a loaded article, set `selectedArticleId` to that article's id.
- On selection: call `naddrEncode({ kind: 30023, pubkey: article.pubkey, identifier: article.d })` and write to `window.location.hash` via `history.replaceState(null, '', '#' + naddr)` (replaceState rather than pushState so selecting different articles does not pollute the back stack with list→article transitions; only explicit back navigation should trigger back).
- On deselect (mobile back): clear the hash with `history.replaceState(null, '', '#')` or `window.location.hash = ''`.
- `popstate` listener: handles browser back/forward — re-read the hash and update `selectedArticleId` accordingly.

**GitHub Pages compatibility:** Hash fragments never reach the server. No 404.html needed, no react-router. This is the correct approach for the `/soveng/` static deployment.

**Timing caveat:** Articles stream in asynchronously from relays. On a cold load with a hash URL, the matching article may not yet be in the articles array when the component mounts. The deep-link restore must either: (a) watch for the article to appear in the articles array and select it on first appearance, or (b) defer selection until `status === 'done'`. Approach (a) is preferred — the article appears within 1–3s and the selection happens automatically.

---

## Responsive Layout Pattern

**Desktop (>= md breakpoint, ~768px):** Two-pane layout using shadcn `ResizablePanelGroup direction="horizontal"`. Left panel: sidebar (article list + controls) with `defaultSize={35}` (35% width), `minSize={20}`, `maxSize={50}`. Right panel: reading pane, takes remaining width. `ResizableHandle withHandle` shows the drag affordance.

**Mobile (< md breakpoint):** Single-column. Render either the sidebar list OR the reading pane based on `selectedArticleId !== null`. Back button renders at the top of the reading pane (terminal-styled: `< back to list`). No swipe gesture needed for v1.2.

**Implementation note:** Do not use shadcn `Sidebar` component for the article sidebar. The shadcn `Sidebar` component is designed for navigation drawers with icon rails, collapsible groups, and tooltips — it is not suited to a content-list sidebar that must hold scrollable article rows and form controls. Use `ResizablePanelGroup` + `ResizablePanel` directly. The PROJECT.md explicitly calls out "use existing shadcn `Sidebar`/`Resizable`" but on examination shadcn `Sidebar` adds substantial cookie-based state, mobile sheet behavior, and SidebarProvider complexity that conflicts with the simple content-pane pattern needed here. Recommend using only `Resizable` components and handling mobile with CSS breakpoints, unless the project explicitly wants the Sidebar component's collapse/sheet behavior.

---

## MVP Definition for v1.2

### Launch With (v1.2)

- [ ] 2-pane layout — ResizablePanelGroup (desktop) + full-screen swap (mobile)
- [ ] Sidebar flat rows replacing accordion — title, author avatar+name, timestamp always present
- [ ] ENRICH-01 enriched rows — summary snippet and thumbnail when available, graceful fallbacks
- [ ] Reading pane — ArticleBody reused verbatim, terminal placeholder when no selection
- [ ] Mobile back control — `< back` button visible when article is open on mobile
- [ ] Deep-linkable selection — naddr in URL hash, restored on load, back/forward works
- [ ] Sidebar contains all controls — FilterBar + ContentFilterControls moved as-is

### Add After Validation (v1.x)

- [ ] j/k keyboard navigation — good for power users but not blocking launch; add in v1.3 if requested
- [ ] Persisted sidebar width — save ResizablePanel width to localStorage; trivial but not blocking

### Future Consideration (v2+)

- [ ] Clickable tag pills (ENRICH-02) — already deferred in PROJECT.md
- [ ] Per-relay status indicator (ENRICH-03) — already deferred in PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 2-pane ResizablePanelGroup layout | HIGH | LOW | P1 |
| Selected-row highlight | HIGH | LOW | P1 |
| Reading pane with ArticleBody | HIGH | LOW | P1 |
| Terminal placeholder empty state | HIGH | LOW | P1 |
| Sidebar scrollable, reading pane scrollable | HIGH | LOW | P1 |
| ENRICH-01 enriched sidebar rows (title+author+timestamp+snippet+thumbnail) | HIGH | MEDIUM | P1 |
| Mobile list↔reader swap | HIGH | MEDIUM | P1 |
| Mobile back control | HIGH | LOW | P1 |
| Deep-linkable selection (naddr hash) | MEDIUM | MEDIUM | P1 |
| Resizable sidebar drag handle | MEDIUM | LOW | P1 |
| j/k keyboard navigation | MEDIUM | MEDIUM | P2 |
| Persisted sidebar width (localStorage) | LOW | LOW | P2 |

---

## Sources

- `/Users/gareth/git/nostr/soveng/src/types/nostr.ts` — Article type fields confirmed (title, summary, image, publishedAt, content, d, pubkey, coordinate)
- `/Users/gareth/git/nostr/soveng/src/lib/nostr.ts` — parseArticle confirms NIP-23 tag parsing; naddrEncode prerequisites present
- `/Users/gareth/git/nostr/soveng/src/components/ArticleCard.tsx` — existing DISP-01/02/03 fallback logic to reuse in ENRICH-01
- `/Users/gareth/git/nostr/soveng/src/components/ArticleBody.tsx` — confirmed reusable as-is for reading pane
- `/Users/gareth/git/nostr/soveng/node_modules/nostr-tools/lib/types/nip19.d.ts` — naddrEncode(AddressPointer) confirmed available in installed nostr-tools@2.23.5
- `/Users/gareth/git/nostr/soveng/vite.config.ts` — base: "/soveng/" confirmed; no 404.html; hash routing is the correct GitHub Pages approach
- [NIP-23 Long-form Content](https://nips.nostr.com/23) — tag fields title/summary/image/published_at confirmed optional; d tag structure
- [shadcn Resizable docs](https://ui.shadcn.com/docs/components/radix/resizable) — ResizablePanelGroup/Panel/Handle components; react-resizable-panels foundation
- [Oracle Alta UI: Master-Detail Pattern](https://www.oracle.com/webfolder/ux/middleware/alta/patterns/masterdetail.html) — canonical master-detail interaction model (in-context vs drilldown, yoking)
- MDN History.pushState / replaceState — browser history API for hash-based deep linking
- Inbox row design research — sender name, subject, preheader pattern maps to author, title, summary for article rows

---

*Feature research for: Soveng v1.2 Email-Client Layout (master-detail reading layout)*
*Researched: 2026-06-08*
