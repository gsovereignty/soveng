# Architecture Patterns: v1.2 Email-Client Layout

**Domain:** 2-pane master-detail integration into existing React + Vite SPA
**Researched:** 2026-06-08
**Scope:** Presentation-layer rework only — data layer (NostrContext, nostrReducer, hooks, pool) is UNCHANGED

---

## Existing Architecture (Confirmed from Source)

### Confirmed component tree (pre-v1.2)

```
App (src/App.tsx)
  NostrProvider (src/context/NostrContext.tsx)
    AppShell
      — local useState: selectedTags, matchMode, filterEnabled, spamThreshold
      — useMemo chain: sortedArticles → visibleArticles → facets / dynamicCounts / filteredArticles
      — useClassification(sortedArticles, spamThreshold)
      ├── BootSequence
      ├── ContentFilterControls
      ├── FilterBar
      └── ArticleList (owns openId accordion state)
            ArticleCard (AccordionItem, AccordionTrigger, AccordionContent)
              ArticleBody (react-markdown + rehype-sanitize)
```

### Confirmed memo chain (src/App.tsx lines 37–80)

```
articles (from NostrContext via nostrReducer)
  ↓ sortArticlesByReplies(articles, replyCounts)
sortedArticles
  ↓ useClassification(sortedArticles, spamThreshold)  — returns classificationMap, version
visibleArticles   ← ML filter insertion point; filterEnabled toggle; always-on length gate
  ↓ buildFacets(visibleArticles)
facets
  ↓ computeDynamicCounts(visibleArticles, selectedTags, matchMode)
dynamicCounts
  ↓ filterArticles(visibleArticles, selectedTags, matchMode)
filteredArticles  ← what gets rendered
```

All memo deps are correct. This chain is the single source of truth for visible content and must not be changed for v1.2.

### Confirmed data layer (UNCHANGED for v1.2)

- `src/lib/pool.ts` — module-level SimplePool singleton; never touched by v1.2
- `src/context/nostrReducer.ts` — ARTICLE_RECEIVED / PROFILE_RECEIVED / REPLY_RECEIVED / SET_STATUS / RESET; no new actions needed
- `src/context/NostrContext.tsx` — NostrProvider wrapping useArticleFetch / useProfileFetch / useReplyFetch; no changes
- `src/hooks/useClassification.ts` — worker, map, version, scores; no changes
- `src/hooks/useArticleFetch.ts`, `useProfileFetch.ts`, `useReplyFetch.ts` — no changes
- `src/types/nostr.ts` — Article type already carries `summary`, `image`, `d`, `coordinate`, `pubkey`; no new fields needed

### Accordion state that disappears in v1.2

`ArticleList.tsx` owns `openId: string` (line 15) and a `useEffect` that clears it when the open article is filtered out (lines 19–24). Both go away entirely in v1.2 — replaced by `selectedArticleId` + the reading pane.

---

## Architecture Decision: Selected Article State Ownership

**Decision: URL hash as single source of truth, with a `selectedArticleId` derived state in AppShell.**

### Rationale

Three options exist:

1. `useState` in AppShell — simple but not deep-linkable, back button does nothing.
2. Lifted into nostrReducer — adds selection state to the data-layer context, which is wrong separation (the reducer owns Nostr data, not UI navigation state). The PROJECT.md Key Decisions explicitly call out "Local UI filter state — NOT in NostrContext (D-10)"; selection follows the same principle.
3. URL hash as source of truth — the naddr or event id lives in `window.location.hash`; a thin `useState<string>` in AppShell mirrors it. Deep-linkable, back-button-aware, no external router dependency needed (the app is already a single-page static build).

**Use option 3.** The naddr (NIP-19 encoded `naddr1...` string built from kind/pubkey/d) lives in `window.location.hash`. AppShell reads the initial hash on mount and updates it on user selection. Hash changes update AppShell state.

Implementation sketch (all in AppShell):

```typescript
// Read initial hash; strip leading '#'
const [selectedNaddr, setSelectedNaddr] = useState<string>(
  () => window.location.hash.slice(1) || ''
)

// Update hash when user selects an article
function onSelectArticle(naddr: string) {
  setSelectedNaddr(naddr)
  window.location.hash = naddr
}

// Listen for back/forward navigation
useEffect(() => {
  const onHashChange = () => setSelectedNaddr(window.location.hash.slice(1) || '')
  window.addEventListener('hashchange', onHashChange)
  return () => window.removeEventListener('hashchange', onHashChange)
}, [])
```

No new reducer action. No new context field. The naddr string is the stable, NIP-19-encoded coordinate, not the mutable event id, because the same article could be re-published to a new event id while keeping the same addressable coordinate (kind:pubkey:d).

### Deriving naddr from Article

`Article` already has `coordinate` (string "30023:pubkey:d"), `pubkey`, and `d`. Use `nip19.naddrEncode` from `nostr-tools/nip19`:

```typescript
import { naddrEncode } from 'nostr-tools/nip19'

function articleNaddr(article: Article): string {
  return naddrEncode({ kind: 30023, pubkey: article.pubkey, identifier: article.d })
}
```

This function belongs in `src/lib/nostr.ts` (pure helper, consistent with existing `articleCoordinate` and `parseArticle` there).

### Resolving naddr → Article

A new derived memo in AppShell after `filteredArticles`:

```typescript
// src/App.tsx — new memo (add after filteredArticles)
const selectedArticle = useMemo(() => {
  if (!selectedNaddr) return null
  // Search filteredArticles first (fast path: it's already visible)
  const inFiltered = filteredArticles.find(a => articleNaddr(a) === selectedNaddr)
  if (inFiltered) return inFiltered
  // Cold-load / filter-hidden fallback: search ALL articles regardless of filter
  return sortedArticles.find(a => articleNaddr(a) === selectedNaddr) ?? null
}, [selectedNaddr, filteredArticles, sortedArticles])
```

This single memo handles both the normal case and the cold-load case (see below). `sortedArticles` is already in scope in AppShell.

---

## Deep-Link Data Flow

### Happy path (article already loaded, visible in filteredArticles)

```
user visits #naddr1abc...
→ useState init reads hash → selectedNaddr = "naddr1abc..."
→ selectedArticle memo: filteredArticles.find() hits → selectedArticle = Article
→ ReadingPane renders ArticleBody
```

### Cold-load case (deep-linked article has not streamed in yet)

```
user visits #naddr1abc...
→ selectedNaddr = "naddr1abc..." (from hash)
→ articles = [] (still streaming)
→ selectedArticle memo: find returns null → ReadingPane shows placeholder "> loading..."
→ ARTICLE_RECEIVED arrives: articles grows
→ sortedArticles memo re-runs
→ selectedArticle memo re-runs: sortedArticles.find() hits → selectedArticle = Article
→ ReadingPane renders article body
```

The key insight: `selectedArticle` searches `sortedArticles` as fallback (not just `filteredArticles`). Because `sortedArticles` is already a dependency of the memo, React will re-evaluate whenever a new article streams in. No explicit "wait for article" logic is needed — the memo chain handles it reactively.

### Filter-hides-selection edge case

When a user selects an article then applies a hashtag filter that excludes it:

```
selectedNaddr = "naddr1abc..."
filteredArticles does not contain the article
sortedArticles still contains it (ML/filter is post-sort)
→ selectedArticle memo: filteredArticles.find() misses, falls back to sortedArticles.find() → returns Article
→ ReadingPane continues showing the article (not cleared)
→ Sidebar list does not highlight any row (article not in filteredArticles)
```

This is the correct UX: the reading pane does not abruptly clear because the user changed a tag filter. The user explicitly chose to read the article; the filter is a list-narrowing tool, not a hide-what-you're-reading tool. The reading pane stays on the selected content until the user picks something else or navigates away.

This is a deliberate design decision matching email-client convention: changing the inbox filter does not close the open email. The existing ArticleList D-10 behavior (collapse accordion when filtered out) is the OLD behavior that v1.2 replaces with this more conservative approach.

If the product decision is reversed (filter SHOULD clear selection), the change is one line: remove the `sortedArticles` fallback from the memo and let it return `null` when the article is hidden.

---

## Component Decomposition

### New components (to create)

**`src/components/ArticleListSidebar.tsx`**
- Owns the scrollable article list panel in the sidebar
- Props: `articles: Article[]`, `profiles: Map<string, Profile>`, `status: NostrStatus`, `selectedNaddr: string`, `onSelect: (naddr: string) => void`
- Renders the streaming status line (extracted from current `ArticleList`)
- Renders `SidebarRow` for each article — NOT ArticleCard (see below)
- No accordion, no openId state

**`src/components/SidebarRow.tsx`**
- Single article row in the sidebar list — inbox-style
- Props: `article: Article`, `profile: Profile | undefined`, `isSelected: boolean`, `onClick: () => void`
- Shows: avatar + author name + title + summary/image thumbnail (ENRICH-01) + timestamp
- Highlight when `isSelected` (terminal-surface background + green border-left)
- Uses existing `Avatar`, `AvatarImage`, `AvatarFallback` shadcn components
- No Accordion dependency

**`src/components/ReadingPane.tsx`**
- Dedicated reading panel (right/main pane)
- Props: `article: Article | null`, `profile: Profile | undefined`
- When `article` is null and `selectedNaddr` is empty: renders terminal placeholder `> select an article to read`
- When `article` is null and `selectedNaddr` is non-empty: renders `> loading...` (cold-load wait state)
- When `article` is present: renders article header (title, author, timestamp) + `<ArticleBody content={article.content} />`
- Scrollable internally; does NOT scroll the sidebar
- Accepts an optional `onBack` prop for mobile (renders `< back` button when provided)

**`src/components/AppLayout.tsx`** (optional extraction)
- If AppShell grows too large, extract the layout shell (the ResizablePanelGroup / sidebar / reading pane wiring) into this component
- Keeps AppShell focused on state/memos; AppLayout focused on DOM structure
- Not strictly required for v1.2 but recommended for maintainability

### Modified components (existing files change)

**`src/App.tsx` (AppShell)**
Changes required:
1. Add `selectedNaddr` state + hash sync (new `useState` + `useEffect`)
2. Add `onSelectArticle` handler
3. Add `selectedArticle` memo (after `filteredArticles`)
4. Replace the `<ArticleList>` render with the new 2-pane layout structure
5. Remove import of `ArticleList` (replaced by `ArticleListSidebar`)
6. Add mobile breakpoint logic (see Mobile section)
The memo chain (lines 37–83) is UNCHANGED.

**`src/components/ArticleCard.tsx`**
- The `AccordionItem`/`AccordionTrigger`/`AccordionContent` shell is removed
- The interior content (avatar, title, author, timestamp display logic) becomes `SidebarRow`
- `ArticleCard.tsx` itself can be deleted OR repurposed as a pure display card if needed elsewhere
- The `getMonogram` function moves to a shared utility or into `SidebarRow`

**`src/components/ArticleList.tsx`**
- The Accordion wrapper and `openId` state are removed
- The streaming status header is extracted/moved to `ArticleListSidebar`
- The component is superseded by `ArticleListSidebar` — original file can be deleted

**`src/components/ArticleBody.tsx`**
- NO CHANGES — this is the central asset being reused
- Moves from `AccordionContent` inside ArticleCard to `ReadingPane`
- The component signature `({ content: string })` is correct as-is

**`src/components/FilterBar.tsx`**
- NO CHANGES to logic or props
- Moves from `sticky top-0` in the main column to inside the sidebar panel
- The `sticky top-0` positioning may need adjustment in the new layout context (sticky within a scrollable sidebar panel, not the page)

**`src/components/ContentFilterControls.tsx`**
- NO CHANGES to logic or props
- Moves into the sidebar panel alongside FilterBar
- The `border-b border-terminal-border py-2 mb-2` wrapper is fine inside the sidebar

### shadcn components to install (not yet present)

The project does not have `resizable` or `sidebar` in `src/components/ui/`. Both need to be added:

```bash
npx shadcn@latest add resizable
npx shadcn@latest add sidebar
```

**`ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle`** — from `@/components/ui/resizable`
- Adds `react-resizable-panels` to dependencies
- Use for the desktop 2-pane layout: horizontal orientation, sidebar panel ~30% default, reading panel ~70%
- The `withHandle` prop on ResizableHandle gives a visible drag affordance

**Sidebar components** — from `@/components/ui/sidebar`
- `SidebarProvider`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, etc.
- Note: the shadcn Sidebar component is designed for app-level navigation sidebars with collapsible/offcanvas behavior. For a simple fixed-position article list pane, `ResizablePanel` alone may be sufficient without the full Sidebar system — both are acceptable. The PROJECT.md specifically calls out "use existing shadcn Sidebar/Resizable", so both should be pulled in and the simpler one chosen after inspection.

---

## Layout Structure

### Desktop layout (>= md breakpoint)

```
AppShell (full viewport, flex row)
  ResizablePanelGroup orientation="horizontal"
    ResizablePanel defaultSize="33%" (sidebar)
      SidebarContent (overflow-y-auto, full height)
        ContentFilterControls
        FilterBar
        ArticleListSidebar
          SidebarRow × N
    ResizableHandle withHandle
    ResizablePanel defaultSize="67%" (reading pane)
      ReadingPane
        (article header + ArticleBody | placeholder)
```

### Mobile layout (< md breakpoint)

Two full-screen panels, toggled by a `showReader: boolean` state in AppShell:

```
showReader === false:
  full-screen sidebar (ContentFilterControls + FilterBar + ArticleListSidebar)

showReader === true:
  full-screen ReadingPane
    "< back" button → sets showReader = false, clears selectedNaddr
```

The `onSelectArticle` handler on mobile sets both `selectedNaddr` and `showReader = true`. The ReadingPane receives `onBack` prop only on mobile.

Mobile detection: use a `useSyncExternalStore`-based window width listener, or a CSS-only approach using Tailwind's responsive prefix on visibility classes (`hidden md:block`, `block md:hidden`). The CSS-only approach is preferred — it avoids JS resize event overhead and keeps the component tree consistent.

---

## Integration Points: What Changes in Which File

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/App.tsx` | Modified | Add `selectedNaddr` state + hash sync + `onSelectArticle` handler + `selectedArticle` memo; replace ArticleList render with 2-pane layout; preserve entire memo chain unchanged |
| `src/lib/nostr.ts` | Modified | Add `articleNaddr(article: Article): string` pure helper using `naddrEncode` from `nostr-tools/nip19` |
| `src/components/ArticleList.tsx` | Deleted | Superseded by `ArticleListSidebar` |
| `src/components/ArticleCard.tsx` | Deleted | Interior logic migrates to `SidebarRow` |
| `src/components/ArticleBody.tsx` | Unchanged | Reused directly by `ReadingPane` |
| `src/components/FilterBar.tsx` | Unchanged | Repositioned into sidebar panel, no prop changes |
| `src/components/ContentFilterControls.tsx` | Unchanged | Repositioned into sidebar panel, no prop changes |
| `src/components/ArticleListSidebar.tsx` | New | Article list for sidebar; no accordion |
| `src/components/SidebarRow.tsx` | New | Single article row with summary/image (ENRICH-01) |
| `src/components/ReadingPane.tsx` | New | Full article reader; reuses ArticleBody |
| `src/components/ui/resizable.tsx` | New (shadcn) | `npx shadcn@latest add resizable` |
| `src/components/ui/sidebar.tsx` | New (shadcn) | `npx shadcn@latest add sidebar` (if used) |
| `src/index.css` | Possibly | Accordion keyframe animations can stay (other features may use accordion); no harm leaving them |

---

## Patterns to Follow

### Pattern 1: URL hash as navigation state (no router)

This app has no React Router. For a single-route SPA, URL hash is the correct deep-link mechanism: it does not trigger a page reload, it is browser-history-aware, and it survives GitHub Pages serving `index.html` for all paths.

```typescript
// In AppShell — initialization
const [selectedNaddr, setSelectedNaddr] = useState<string>(
  () => window.location.hash.slice(1) || ''
)

// Selection handler — updates both state and URL
function onSelectArticle(article: Article) {
  const naddr = articleNaddr(article)
  setSelectedNaddr(naddr)
  window.location.hash = naddr
}

// Back/forward navigation listener
useEffect(() => {
  const handler = () => setSelectedNaddr(window.location.hash.slice(1) || '')
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}, [])
```

### Pattern 2: selectedArticle searches both filtered and unfiltered lists

The fallback to `sortedArticles` (not just `filteredArticles`) handles two cases with one memo:
- Cold-load: article not yet in any list → returns null → "loading..." placeholder
- Filter-hides-selection: article hidden by tag filter → found in sortedArticles → reading pane stays open

```typescript
const selectedArticle = useMemo(() => {
  if (!selectedNaddr) return null
  const inFiltered = filteredArticles.find(a => articleNaddr(a) === selectedNaddr)
  if (inFiltered) return inFiltered
  return sortedArticles.find(a => articleNaddr(a) === selectedNaddr) ?? null
}, [selectedNaddr, filteredArticles, sortedArticles])
```

### Pattern 3: isSelected prop on SidebarRow (no context)

The selected article highlight is prop-passed, not a context value. This keeps `SidebarRow` as a pure presentational component:

```typescript
// In ArticleListSidebar
{articles.map(article => (
  <SidebarRow
    key={article.id}
    article={article}
    profile={profiles.get(article.pubkey)}
    isSelected={articleNaddr(article) === selectedNaddr}
    onClick={() => onSelect(articleNaddr(article))}
  />
))}
```

`isSelected` is false when the selected article is hidden by filters (the article is not in `filteredArticles` which is what `ArticleListSidebar` receives). This is correct — no row is highlighted when the current selection is filter-hidden, while the reading pane still shows it.

### Pattern 4: ArticleBody unchanged, wrapped by ReadingPane

`ArticleBody` takes `{ content: string }` and is fully self-contained. `ReadingPane` adds the article header (title, author avatar, timestamp) and the scrollable container, then renders `<ArticleBody content={article.content} />`.

```typescript
// ReadingPane.tsx
export function ReadingPane({ article, profile, onBack }: ReadingPaneProps) {
  if (!article) {
    return (
      <div className="flex items-center justify-center h-full font-mono text-terminal-muted text-sm">
        {/* distinguish cold-load (selectedNaddr exists) from no-selection */}
        ...
      </div>
    )
  }
  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      {onBack && <button onClick={onBack}>...back...</button>}
      {/* header */}
      <ArticleBody content={article.content} />
    </div>
  )
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Selected article state in NostrContext / nostrReducer

**Why bad:** The reducer owns Nostr protocol state (articles, profiles, replyCounts). Adding UI navigation state (which article is selected) violates the existing separation explicitly codified in D-10. It would also force a SELECTED_ARTICLE reducer action and a context value change, propagating re-renders through all consumers of useNostr().

**Instead:** `useState<string>` in AppShell, synced to URL hash.

### Anti-Pattern 2: Calling naddrEncode inside SidebarRow or ReadingPane on every render

**Why bad:** naddrEncode is not expensive, but calling it N times per article row per render is unnecessary and creates unstable string values if called in callbacks.

**Instead:** The `articleNaddr` helper is called once per article in `ArticleListSidebar`'s map, and the naddr string is passed to `SidebarRow` as a prop. The `selectedArticle` memo also calls it, but only for the comparison, once per filteredArticles change.

### Anti-Pattern 3: FilterBar with `sticky top-0` inside a scrollable panel

**Why bad:** `sticky top-0` works relative to the scrolling ancestor. If FilterBar stays as-is inside a `overflow-y-auto` sidebar panel, it will stick to the top of that panel — which is correct. But if it is inside a non-scrolling parent it becomes non-functional. Test this after repositioning.

**Instead:** Confirm the sidebar panel's overflow model before or during implementation. The FilterBar's `sticky top-0 z-20` is correct IF the sidebar panel is the scrolling container. If the entire page scrolls instead, the FilterBar will stick to the wrong element.

### Anti-Pattern 4: Using the shadcn Sidebar's collapsible/offcanvas behavior for the article list

**Why bad:** The shadcn Sidebar is designed for app navigation (left-hand nav, icon-only collapse). Using it for a scrollable article list adds unnecessary DOM structure (SidebarMenu, SidebarMenuItem etc.) and fights against the default mobile behavior (it collapses to an offcanvas drawer, not a full-screen list).

**Instead:** Use `ResizablePanel` for the desktop split. For mobile, use a CSS `hidden md:flex` / `flex md:hidden` toggle on two separate full-viewport divs. The shadcn Sidebar component can still be installed for the `SidebarProvider` context if the resizable layout needs it, but the SidebarMenu navigation primitives are not the right fit for an article list.

### Anti-Pattern 5: Clearing selectedArticle on filteredArticles change

**Why bad:** Clearing selection when the user changes a tag filter is surprising (email clients do not close the open email when the user changes the folder view). It also breaks the deep-link contract — a shared URL should show the article regardless of filter state.

**Instead:** The `selectedArticle` memo falls back to `sortedArticles`, keeping the article visible in the reading pane even when filters hide it from the list.

---

## Scalability Considerations

| Concern | For v1.2 (current scale) | Notes |
|---------|--------------------------|-------|
| Article count | Uncapped but typically < 100 | The `find()` calls in `selectedArticle` are O(n) on a small array; no performance concern |
| Hash sync | Single hashchange listener | Fine for single-page app; no router needed |
| Panel resize persistence | Not required in v1.2 | Could add `localStorage` persistence of panel size via ResizablePanelGroup's `onLayoutChange` in a future milestone |
| Mobile breakpoint | CSS-only (Tailwind md:) | Avoids JS resize event for layout switching; sufficient for v1.2 |

---

## Build Order

The recommended implementation sequence for v1.2, accounting for dependencies:

**Step 1 — Layout scaffold (no data, no interactivity)**
- `npx shadcn@latest add resizable` → generates `src/components/ui/resizable.tsx`
- Create `ReadingPane.tsx` stub (placeholder only, no article props yet)
- Create `ArticleListSidebar.tsx` stub (static list, no selection)
- Modify `AppShell` to render `ResizablePanelGroup` with two panels: left=ArticleListSidebar, right=ReadingPane
- Move `ContentFilterControls` and `FilterBar` into the left panel
- Verify: layout renders, controls still work, articles still list

**Step 2 — Sidebar rows (ENRICH-01)**
- Create `SidebarRow.tsx` with summary/image/title/author display (inbox look)
- Wire into `ArticleListSidebar` in place of `ArticleCard`
- Delete `ArticleCard.tsx` once `SidebarRow` is confirmed working
- Delete `ArticleList.tsx`
- Verify: all articles display with richer row content

**Step 3 — Selection + reading pane**
- Add `articleNaddr` to `src/lib/nostr.ts`
- Add `selectedNaddr` state and `onSelectArticle` to AppShell
- Add `selectedArticle` memo to AppShell
- Add `isSelected` + `onClick` wiring from AppShell → ArticleListSidebar → SidebarRow
- Implement `ReadingPane` fully: article header + ArticleBody + placeholder states
- Remove Accordion from `src/components/ui/accordion.tsx` imports (or leave; no harm)
- Verify: click row → reading pane shows article; click again → deselects

**Step 4 — Deep-link: URL hash sync**
- Add hash init, `onSelectArticle` hash write, and `hashchange` listener to AppShell
- Add cold-load placeholder text to ReadingPane (when selectedNaddr != '' but selectedArticle is null)
- Verify: navigate to #naddr1... → correct article loads; back button works; share URL opens to correct article

**Step 5 — Mobile list↔reader swap**
- Add `md:hidden` / `hidden md:flex` CSS on the two layout modes
- Wire `onBack` prop to ReadingPane for mobile; clicking back returns to sidebar
- Verify: at mobile viewport, list is full-screen; tapping row shows reader; back returns to list

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Selected-article state ownership | HIGH | Grounded in actual App.tsx state architecture; consistent with existing D-10 pattern |
| Memo chain unchanged | HIGH | Verified by reading src/App.tsx lines 37–83 in full |
| ArticleBody reuse in ReadingPane | HIGH | Component is prop-only `{ content: string }`, no internal state, trivially movable |
| Deep-link via URL hash (no router) | HIGH | Standard browser API; confirmed static-site constraint from PROJECT.md |
| Cold-load resolution via sortedArticles memo | HIGH | Memo re-evaluates on every ARTICLE_RECEIVED dispatch; no polling needed |
| Filter-hides-selection: keep reading pane open | MEDIUM | UX decision; email-client convention, but product could choose differently |
| shadcn Resizable suitable for 2-pane split | MEDIUM | Confirmed from docs; react-resizable-panels v4 API verified; not yet installed in project |
| shadcn Sidebar: use ResizablePanel instead of SidebarMenu | MEDIUM | Verified from shadcn docs; Sidebar is nav-oriented; ResizablePanel is the right primitive for a scrollable list panel |

---

## Sources

- `src/App.tsx` — memo chain, local state, current component render tree (read in full)
- `src/context/NostrContext.tsx` — NostrProvider, state shape, what useNostr() exposes
- `src/context/nostrReducer.ts` — action types, NostrState shape, RESET/ARTICLE_RECEIVED
- `src/components/ArticleList.tsx` — Accordion openId state, D-10 filter-clear effect
- `src/components/ArticleCard.tsx` — AccordionItem/Trigger/Content shell, display fallback logic
- `src/components/ArticleBody.tsx` — react-markdown + rehype-sanitize, `{ content: string }` interface
- `src/components/FilterBar.tsx` — props interface, sticky positioning, show-all toggle
- `src/components/ContentFilterControls.tsx` — props interface, layout
- `src/types/nostr.ts` — Article type (summary, image, d, coordinate, pubkey confirmed present)
- `src/lib/nostr.ts` — articleCoordinate, parseArticle, sortArticlesByReplies (pure helpers)
- `src/lib/pool.ts` — module-level SimplePool singleton (confirmed data layer is separate)
- `src/hooks/useClassification.ts` — version-counter pattern, worker singleton, classificationMap
- `.planning/PROJECT.md` — v1.2 milestone scope, Key Decisions table, D-10 pattern reference
- `package.json` — confirmed no react-router-dom; react-resizable-panels not yet installed
- `vite.config.ts` — base: "/soveng/" (static GitHub Pages constraint confirmed)
- https://ui.shadcn.com/docs/components/resizable — ResizablePanelGroup/Panel/Handle API, v4 prop names
- https://ui.shadcn.com/docs/components/sidebar — SidebarProvider, SidebarContent structure
