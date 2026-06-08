# Pitfalls Research

**Domain:** 2-pane email-client layout with deep-linking added to a React 19 + Vite + shadcn/Tailwind-v4 SPA on GitHub Pages (Soveng v1.2)
**Researched:** 2026-06-08
**Confidence:** HIGH (codebase read + library source confirmed; all critical claims verified against installed node_modules or official docs)

---

## Critical Pitfalls

### Pitfall 1: Path-based deep links 404 on hard reload under `/soveng/` base path

**What goes wrong:**
If selection state is encoded in the URL pathname — e.g. `/soveng/article/naddr1...` — a hard reload or direct link causes GitHub Pages to look for a file at that path and return 404. The existing `404.html` fallback (written by `postbuild`) redirects to `index.html`, but ONLY if the path exists as a served asset. GitHub Pages project-site URLs include the repo segment (`/soveng/`) as a path component. Any path deeper than `/soveng/index.html` that is not a build output file returns 404 and the standard rafgraph-style redirect requires `pathSegmentsToKeep=1` to preserve the repo prefix.

**Why it happens:**
Developers reach for `BrowserRouter` or `createBrowserRouter` from react-router because that is the default tutorial example, then hit 404 on reload because GitHub Pages is a static file host with no server-side rewrite rules. The existing project has NO router installed — navigation has always been state-only (accordion open/close). Adding path-based routing from scratch in v1.2 without accounting for the static-host constraint reintroduces this 404 problem.

**How to avoid:**
Use hash-based routing for selection state. Store the selected article's naddr in the URL hash only: `https://gsovereignty.github.io/soveng/#naddr1qqq...`. The hash is never sent to the server, so GitHub Pages always serves `build/index.html` correctly. On mount, read `window.location.hash`, strip the leading `#`, attempt `nip19.decode(hash)` (from `nostr-tools/nip19`), and set initial selection state. No router library is needed — one `useState` initializer and one `hashchange` event listener covers the full requirement. Do NOT install react-router for this project; it adds bundle weight and the 404.html approach requires careful `pathSegmentsToKeep` tuning that has already caused regressions in comparable projects.

**Warning signs:**
- Deep link works in `vite preview` (local static server handles all paths) but 404s on `gsovereignty.github.io/soveng/naddr1...`
- No `404.html` in the `build/` directory (postbuild script must copy it)
- `pathSegmentsToKeep` in any 404.html script set to `0` (drops the `/soveng/` prefix, stranding the app at the domain root)

**Phase to address:**
Phase 1 of v1.2 (layout scaffold / routing plumbing) — must be the first thing designed so all subsequent selection wiring builds on the correct URL strategy.

---

### Pitfall 2: Cold-load deep link — selected article has not yet arrived from relays

**What goes wrong:**
A user opens `https://gsovereignty.github.io/soveng/#naddr1qqq...` from a share link. The app reads the hash on mount and sets `selectedNaddr = "naddr1qqq..."`. At that moment `articles` in `NostrContext` is `[]` — the WebSocket subscriptions have not yet received events. The reading pane renders the "select an article" placeholder because no article in the (empty) list matches `selectedNaddr`. Relays stream in events over the next 2-8 seconds. The selection never auto-resolves because the code only initialised selection state on mount and never re-checks it against newly arrived articles.

**Why it happens:**
Developers write the selection resolution logic as a one-time mount effect that tries to find the article in the current list. Because articles arrive asynchronously after mount, the find returns `undefined` and the pending selection is discarded. This is a race between two async processes: page hydration (JS parse + React mount) and relay streaming.

**How to avoid:**
Maintain a `pendingNaddr` ref that holds the hash-initialised naddr until it is resolved. In the same `useMemo` or effect that derives `filteredArticles`, check whether `pendingNaddr` matches any article by `article.coordinate` (which is `30023:pubkey:d`) decoded from the naddr. When a match is found, call `setSelectedId(match.id)` and clear `pendingNaddr`. The key insight: coordinate matching must happen in a `useEffect` that runs on every `filteredArticles` change, not once on mount. A 5-second timeout can surface a "article not found — it may have been filtered or not fetched from these relays" message and clear the pending state.

```typescript
// Conceptual: runs on every filteredArticles change
useEffect(() => {
  if (!pendingNaddr.current) return
  const decoded = tryDecodeNaddr(pendingNaddr.current)
  if (!decoded) { pendingNaddr.current = null; return }
  const match = filteredArticles.find(a => a.coordinate === decoded.coordinate)
  if (match) {
    setSelectedId(match.id)
    pendingNaddr.current = null
  }
}, [filteredArticles])
```

**Warning signs:**
- Deep link from a share works on second load (article already in relay cache / browser fetched faster) but not on first cold load
- "select an article to read" shown after relay streaming completes even though the correct article arrived
- Selection resets to null every time the article list re-renders during streaming

**Phase to address:**
Phase 1 of v1.2 (routing/selection plumbing). Must be designed alongside the URL strategy — they are coupled.

---

### Pitfall 3: Stale selection when filter hides the selected article

**What goes wrong:**
A user selects article A, then checks a hashtag filter that article A does not carry. `filteredArticles` no longer contains article A. The reading pane continues to show article A's content (selected ID is still set) while the list no longer highlights it. The two panes are out of sync. Alternatively, an ML classification result arrives after selection (the article was `pending`, then the worker scores it as `spam`) and the selected article disappears from `visibleArticles` while still rendered in the reading pane.

**Why it happens:**
Selection ID is stored in React state independent of the filter pipeline. The derived `filteredArticles` memo changes but there is no reactive link that says "if `selectedId` is no longer present in the visible list, clear it or show a warning."

**How to avoid:**
Derive `selectedArticle` from `filteredArticles` rather than `articles`:
```typescript
const selectedArticle = useMemo(
  () => filteredArticles.find(a => a.id === selectedId) ?? null,
  [filteredArticles, selectedId]
)
```
When `selectedArticle` is `null` but `selectedId` is non-null, the reading pane shows a "this article is currently hidden by your filters" notice rather than the last-seen content. Do NOT auto-clear `selectedId` on filter change — the user may have intentionally filtered and wants to see the notice, or they may undo the filter to get back to their article. Clear `selectedId` only on explicit "back" navigation or explicit new selection. Update the URL hash to empty (`history.replaceState(null,'','#')`) when the reading pane shows the hidden-article notice so a reload does not re-select a hidden article.

**Warning signs:**
- Removing a filter tag causes the list to update but the reading pane does not change
- Selecting an article then turning on ML filtering keeps the article in the reading pane even if it would be spam-classified
- Back button navigates "into" a selection that is no longer in the list

**Phase to address:**
Phase 1 of v1.2 (selection state design). The `selectedArticle` derivation pattern must be decided before the reading pane is built.

---

### Pitfall 4: ResizablePanel sets `overflow: hidden` inline, breaking ScrollArea inside panels

**What goes wrong:**
`react-resizable-panels` (the library underlying shadcn `Resizable`) injects an inline `overflow: hidden` style on every `Panel` element. When a `ScrollArea` (or a plain `overflow-y-auto` div) is nested directly inside a `ResizablePanel`, the panel's inline style takes precedence over all Tailwind utility classes, and the panel content is not scrollable — it is silently clipped. This is a confirmed known bug tracked in the shadcn-ui repository (issue #3548, filed April 2024). The article list panel and the reading pane both need independent vertical scroll, making this directly blocking.

**Why it happens:**
`react-resizable-panels` applies `style={{ overflow: 'hidden' }}` directly on the DOM element to prevent content from growing the panel during resize interactions. This is an inline style, which has higher specificity than Tailwind class-based styles. The bug was reported but as of the research date (June 2026) the upstream library has not universally fixed this for all nested scroll scenarios.

**How to avoid:**
Wrap the scrollable content in an intermediate `div` with `h-full overflow-y-auto` (or use shadcn `ScrollArea`) placed as a direct child of the `ResizablePanel`. The `ResizablePanel` holds `overflow:hidden` on itself; the inner wrapper establishes its own scroll context. Set `ResizablePanel` to `h-full` explicitly via `className="h-full"` and ensure the `ResizablePanelGroup` has an explicit height (`h-screen` or `h-[calc(100vh-Npx)]` for layouts with a header). Do NOT use `h-full` alone on `ResizablePanelGroup` without an explicit height ancestor — `h-full` resolves to zero if the parent has no set height.

```tsx
<ResizablePanel defaultSize={35} className="flex flex-col">
  {/* Intermediate wrapper establishes scroll context */}
  <div className="flex-1 overflow-y-auto">
    <ArticleList ... />
  </div>
</ResizablePanel>
```

**Warning signs:**
- List panel clips content silently — no scrollbar appears even with many articles
- Adding `overflow-y-scroll` class has no effect (inline style wins)
- Works in local dev with a short list but breaks with 20+ articles

**Phase to address:**
Phase 1 of v1.2 (layout scaffold). Verify scroll in both panels before implementing article content.

---

### Pitfall 5: ResizablePanel drag handle unusable on mobile — do not try to fix it for mobile

**What goes wrong:**
`react-resizable-panels` touch dragging on mobile/tablet has historically caused panels to jump to extreme positions on drag. The underlying library fixed this in v4.6.4 by requiring `touchAction: "none"` on the separator. However, even with the fix, a drag handle between two full-height panels on a narrow mobile screen is a poor UX target — too narrow to touch accurately, and conflicts with the browser's edge swipe gestures. The shadcn `Resizable` component may be on an older pinned version of `react-resizable-panels` depending on when the shadcn CLI was run.

**Why it happens:**
Developers scaffold the same `ResizablePanelGroup` for all breakpoints, then discover on real mobile devices that the drag handle is invisible, touch targets are too small (WCAG requires 44x44px), and the layout is broken when the panel is accidentally resized to 0%.

**How to avoid:**
Use `ResizablePanelGroup` only on desktop (md and above). On mobile, implement a CSS-only full-screen swap: the list pane is `block` and the reading pane is `hidden` by default; when an article is selected (`selectedId !== null`), swap them with `hidden`/`block` class toggling. A "back" button in the reading pane clears `selectedId`. This is the "list ↔ reader swap" requirement in v1.2. Use a CSS media query breakpoint — do not try to render `ResizablePanelGroup` inside a mobile Sheet or Drawer.

Set `minSize` on both panels (e.g., `minSize={20}`) to prevent accidental collapse to 0% on desktop too.

**Warning signs:**
- `ResizablePanelGroup` is rendered unconditionally at all viewport widths
- Drag handle shows at 4px wide on a 375px screen
- Panels snap to 0% or 100% on touch drag

**Phase to address:**
Phase 2 of v1.2 (mobile layout) — but the desktop-only conditional must be scaffolded in Phase 1 so mobile is never broken at any point during development.

---

### Pitfall 6: Untrusted Nostr `image` tag URLs render tracking pixels in sidebar rows (ENRICH-01)

**What goes wrong:**
Kind:30023 articles carry an optional `image` tag with an author-supplied URL. Rendering this URL directly in a sidebar `<img src={article.image}>` makes a network request to an arbitrary third-party server on behalf of the user, leaking: (a) the user's IP address and approximate location, (b) a `Referer` header identifying `gsovereignty.github.io/soveng` as the origin, (c) user-agent and timing data. An adversarial author can supply a 1×1 pixel URL on their own server to build a fingerprint of every reader who loads the list. There is no opt-in consent mechanism.

**Why it happens:**
`article.image` is already parsed into the `Article` type (`image: string | undefined`) from v1.0. Adding it to a sidebar row is a one-line change that appears safe but silently activates external requests for every article displayed, including those from unknown authors.

**How to avoid:**
Always set `referrerPolicy="no-referrer"` and `crossOrigin="anonymous"` on sidebar image elements to suppress the `Referer` header and prevent cookie/credential leakage. Set explicit `loading="lazy"` so images outside the viewport do not trigger requests until the user scrolls. Add a `width` and `height` attribute (or `aspect-ratio` CSS) to reserve space before the image loads and prevent layout shift (CLS). Provide an `onError` handler that replaces the `src` with a terminal-styled monogram placeholder — identical to the existing `AvatarFallback` pattern in `ArticleCard` — so broken/404 images do not display broken-image icons in every row.

```tsx
<img
  src={article.image}
  alt=""
  referrerPolicy="no-referrer"
  crossOrigin="anonymous"
  loading="lazy"
  width={48}
  height={48}
  className="object-cover shrink-0 border border-terminal-border"
  onError={(e) => { e.currentTarget.style.display = 'none' }}
/>
```

For a higher privacy bar (deferred — not required in v1.2): pass image URLs through a Content Security Policy `img-src` directive that restricts to known CDNs. Not feasible on GitHub Pages (no custom response headers), but a meta-CSP tag in `index.html` can partially help.

**Warning signs:**
- Network tab in DevTools shows 20+ requests to external domains on initial list render
- No `Referrer-Policy` header (check response headers — GitHub Pages does not set it)
- Broken-image icon visible in sidebar rows for articles with dead image URLs
- Sidebar rows shift vertically as images load (no reserved space)

**Phase to address:**
Phase 2 of v1.2 (richer sidebar rows / ENRICH-01). Image hardening must be part of the row implementation, not a follow-up.

---

### Pitfall 7: Untrusted `image` URL with `http://` on the HTTPS site causes mixed-content block

**What goes wrong:**
`gsovereignty.github.io` is served over HTTPS. A Nostr author can supply `image: "http://example.com/img.jpg"` (plain HTTP). Modern browsers block mixed active content outright and silently drop mixed passive content (`<img>` requests) in strict mode, replacing the image with a broken icon. The article's `image` field is populated as-is from the relay event tag — no protocol normalisation happens today.

**Why it happens:**
The `Article` type stores `image: string | undefined` verbatim. There is no validation layer between relay event parsing and rendering. Nostr relay events are author-controlled strings.

**How to avoid:**
Before rendering any sidebar image, check `article.image?.startsWith('https://')`. If the URL is HTTP (or a relative URL, or a `data:` URI) render the monogram fallback immediately without issuing any request. Do not attempt to upgrade `http://` to `https://` — the upgraded URL may not resolve. This check belongs in the sidebar row component, not in the data layer (keeping data layer raw is the right pattern).

**Warning signs:**
- Chrome/Firefox console shows `Mixed Content: The page was loaded over HTTPS but requested an insecure image`
- Images from certain relay authors consistently show as broken in production but load fine in local `vite dev` (which is HTTP)

**Phase to address:**
Phase 2 of v1.2 (ENRICH-01 sidebar rows). Can be a single guard added to the `src` prop resolution.

---

### Pitfall 8: rehype-sanitize must remain in the ArticleBody pipeline after moving the reader out of the Accordion

**What goes wrong:**
The existing `ArticleBody` renders safely via `react-markdown + rehype-sanitize`. When the Accordion is removed and replaced by a dedicated reading pane, there is a risk that the `ArticleBody` component is inadvertently refactored or its `rehypePlugins={[rehypeSanitize]}` prop is dropped during the restructuring. Without `rehypeSanitize`, any raw HTML in a Nostr article body reaches the DOM, enabling stored XSS — a Nostr author can publish `<script>alert(1)</script>` or a `javascript:` href and it will execute in every reader's browser.

**Why it happens:**
The refactor from Accordion to pane involves moving `<ArticleBody content={article.content} />` from `AccordionContent` to a new `ReadingPane` component. This is a mechanical change but creates a moment where the sanitization plugin could be dropped if the developer copies only the `content` prop and rewrites the render call from scratch instead of lifting the whole `ArticleBody` component unchanged.

**How to avoid:**
Do not rewrite `ArticleBody`. Lift it unchanged into `ReadingPane` — `<ArticleBody content={selectedArticle.content} />` is the only call needed. Add a comment in `ReadingPane` that mirrors the security note at the top of `ArticleBody.tsx`: "rehype-sanitize must remain in the rehypePlugins array — do not remove it." Treat `ArticleBody` as a security boundary component that is never to be inlined. Add a Vitest smoke test that renders `ArticleBody` with a payload containing `<script>xss</script>` and asserts the rendered output does not contain `<script>` (this test already implicitly exists if ArticleBody tests were written; verify it covers the component in the new rendering context).

**Warning signs:**
- Any render of article content that does NOT use `ArticleBody` directly (e.g. raw `dangerouslySetInnerHTML`)
- The word `rehype-raw` appearing anywhere in the new pane code
- Removal of `rehypePlugins` from a `<Markdown>` usage

**Phase to address:**
Phase 2 of v1.2 (reading pane). Security check should be in the phase acceptance criteria.

---

### Pitfall 9: Independent scroll regions require explicit height containment — `h-full` resolves to zero without an explicit height ancestor

**What goes wrong:**
The 2-pane layout needs both the article list panel and the reading pane to scroll independently within fixed-height containers. In Tailwind, `h-full` means "100% of the parent's height." If any ancestor in the chain does not have an explicit height set (e.g. `<html>`, `<body>`, `<div id="root">`, or `AppShell`'s outer div currently uses `min-h-screen`), the `h-full` on a child resolves to zero and the panel collapses. The current `AppShell` renders `min-h-screen` with `flex-col` — this grows with content rather than constraining to viewport, which is correct for a scrolling list but wrong for a fixed 2-pane layout where scroll must be contained inside each pane.

**Why it happens:**
`min-h-screen` is the right default for a single-column layout where the page scrolls as one unit. Switching to a 2-pane layout requires `h-screen` (or `h-dvh` for mobile browser chrome handling) on the outermost container so that the total height is bounded, and then each pane scrolls within that bound. Forgetting to change `min-h-screen` → `h-screen` on `AppShell` means both panels grow with content instead of scrolling.

**How to avoid:**
Change `AppShell`'s outer wrapper from `min-h-screen flex-col` to `h-screen flex-col overflow-hidden` (or `h-dvh` on mobile to account for iOS Safari's collapsing toolbar). Ensure `html` and `body` elements are `height: 100%` — in the existing `index.css` check that these are set. The `ResizablePanelGroup` should receive `className="h-full"` so it fills the flex container. For the header/footer chrome within AppShell, use `flex-none` to prevent them from participating in the height distribution.

```css
/* index.css additions */
html, body, #root {
  height: 100%;
  overflow: hidden; /* prevent double scrollbar */
}
```

**Warning signs:**
- Both panels show all content without a scrollbar (content overflows the viewport)
- Adding `overflow-y-auto` to a panel has no effect — panel has zero calculated height
- Layout looks correct in a small browser window but breaks when content is long

**Phase to address:**
Phase 1 of v1.2 (layout scaffold). The height chain must be set up before any content is put into the panels.

---

### Pitfall 10: Scroll position does not reset when the selected article changes

**What goes wrong:**
The user reads article A, scrolls halfway down its body, then clicks article B in the list. The reading pane shows article B's content but the scroll position is preserved from article A — the user sees the middle of article B rather than the top.

**Why it happens:**
React reuses the reading pane DOM element across article selections (the same `div` is updated in place via state change). The `scrollTop` of the pane's scroll container is not reset. The browser does not automatically scroll to the top when the contents of an element change in place.

**How to avoid:**
Use a `key` prop on the reading pane's scroll container equal to `selectedId`. When `selectedId` changes, React unmounts and remounts the element, which resets `scrollTop` to 0 naturally. Alternatively, use `useLayoutEffect` with `containerRef.current.scrollTop = 0` triggered by `selectedId`. The `key` approach is simpler and avoids imperative refs.

```tsx
<div key={selectedId} className="flex-1 overflow-y-auto p-4">
  <ArticleBody content={selectedArticle.content} />
</div>
```

**Warning signs:**
- Clicking a new article in the list shows content mid-page
- The scroll position of the reading pane persists across article selections

**Phase to address:**
Phase 2 of v1.2 (reading pane). Simple fix, but easy to miss if not tested with long articles.

---

### Pitfall 11: Selection state re-render storm — `selectedId` placed in NostrContext triggers the entire context subtree

**What goes wrong:**
`NostrContext` currently holds relay data (articles, profiles, replyCounts, status). If `selectedId` is added to `NostrContext`, every article state update (which happens on every streaming event from the relay, potentially every 200ms during the initial fetch) triggers a re-render of every consumer of that context, including the now-expensive reading pane with its full Markdown render tree.

**Why it happens:**
React context does not support fine-grained subscriptions — any state change in a context's value object causes all consumers to re-render. The existing `NostrContext` is heavily updated during streaming. Putting selection state there couples the reading pane's render cycle to relay streaming.

**How to avoid:**
Keep `selectedId` as `useState` in `AppShell`, not in `NostrContext`. The existing pattern (D-10, Pattern 5 in the codebase) correctly keeps filter state (`selectedTags`, `matchMode`) in `AppShell` rather than context. Selection state follows the same pattern. `selectedArticle` is then a local `useMemo` in `AppShell` derived from `filteredArticles` + `selectedId`, identical to how `filteredArticles` is derived today. The reading pane receives `selectedArticle` as a prop and only re-renders when its own prop changes — not on every relay event.

**Warning signs:**
- Adding `selectedId` to `NostrContext` and noticing the reading pane Markdown flickers on every streaming event
- React DevTools profiler shows `ReadingPane` rendering dozens of times during the initial article stream
- Frame drops during the 0–8 second relay streaming window when articles are arriving rapidly

**Phase to address:**
Phase 1 of v1.2 (selection state design). Architectural decision — must be made before any wiring.

---

### Pitfall 12: `window.location.hash` contains a `#` — naddr decode fails without stripping it

**What goes wrong:**
`window.location.hash` returns `"#naddr1qqq..."` (the leading `#` is included). Passing this directly to `nip19.decode()` from `nostr-tools/nip19` throws because bech32 strings must not start with `#`. The decode returns an error or throws, the pending selection is cleared, and the deep link silently does nothing.

**Why it happens:**
Browser APIs return the full fragment including the `#` delimiter. NIP-19 decode functions expect only the bech32 payload. This is a one-character strip but easy to forget.

**How to avoid:**
Always strip with `window.location.hash.slice(1)` before decoding. Wrap the decode in a try/catch that returns `null` on any error — malformed hashes (e.g. a user typing a custom URL with a bad fragment) must not crash the app.

```typescript
function tryDecodeNaddr(hash: string): { coordinate: string } | null {
  try {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash
    const decoded = nip19.decode(raw)
    if (decoded.type !== 'naddr') return null
    const { kind, pubkey, identifier } = decoded.data
    return { coordinate: `${kind}:${pubkey}:${identifier}` }
  } catch {
    return null
  }
}
```

**Warning signs:**
- Deep links work in manual testing (developer copies the URL with `#` stripped) but not when users use the actual browser URL bar copy
- Console error: `"invalid bech32 string"` or similar from nostr-tools decode on page load

**Phase to address:**
Phase 1 of v1.2. Include a unit test: `tryDecodeNaddr('#naddr1qqq...')` and `tryDecodeNaddr('naddr1qqq...')` both return a valid result.

---

### Pitfall 13: `hashchange` event not fired when user navigates back/forward through the same hash

**What goes wrong:**
The browser's back button fires `hashchange` when the fragment changes. But if the user navigates from the article view back to the list (by clearing the hash) and then forward again (restoring the hash), the browser re-fires `hashchange` and the selection is correctly restored. HOWEVER: `hashchange` does NOT fire on the initial page load. The initial hash must be read synchronously in the `useState` initializer or in a `useEffect` that runs on mount. Developers who set up only the `hashchange` listener miss the cold-load / bookmark case entirely.

**Why it happens:**
`hashchange` is an event, not a polled value. It fires on transitions, not on initial state. This is a classic mistake when implementing hash-based routing.

**How to avoid:**
Read `window.location.hash` in the `useState` initializer for `selectedId` (or `pendingNaddr`), AND attach a `hashchange` listener in a `useEffect`. Two code paths, one for initial load and one for navigation:

```typescript
const [pendingNaddr, setPendingNaddr] = useState<string | null>(
  () => window.location.hash.slice(1) || null
)

useEffect(() => {
  const onHashChange = () => setPendingNaddr(window.location.hash.slice(1) || null)
  window.addEventListener('hashchange', onHashChange)
  return () => window.removeEventListener('hashchange', onHashChange)
}, [])
```

**Warning signs:**
- Share links work when pasted into a new tab but back/forward browser navigation loses selection
- OR: direct bookmark loads work but share links (opened from another app) do not

**Phase to address:**
Phase 1 of v1.2. Include a test for both paths: initial-hash-on-mount and hashchange-event.

---

### Pitfall 14: Mobile list↔reader swap loses list scroll position when returning to list

**What goes wrong:**
On mobile, the user scrolls 15 articles deep in the list, taps article 16, reads it, taps "back". The list pane re-mounts (because it was `hidden` or unmounted) and scroll position resets to the top. The user must scroll 15 articles deep again.

**Why it happens:**
If the mobile swap is implemented by conditionally mounting/unmounting the list pane (`{!selectedId && <ArticleList />}`), React destroys and recreates the list DOM including its scroll container. The scroll position is lost. The same happens with `display: none` toggled via CSS class if implemented by replacing a component in the tree with a different key.

**How to avoid:**
Use CSS visibility toggling rather than conditional mounting. Both panes are always mounted; CSS classes switch between `block` and `hidden` (or `translate-x-full` for a slide transition). Because both components remain in the React tree, their internal state (including scroll position) is preserved.

```tsx
{/* Mobile: both always mounted, CSS controls visibility */}
<div className={cn("h-full", selectedId ? "hidden md:block" : "block")}>
  <ArticleList ... />
</div>
<div className={cn("h-full", selectedId ? "block" : "hidden md:block")}>
  <ReadingPane ... />
</div>
```

This mirrors the pattern recommended by React docs ("Preserving and Resetting State") for cases where you want state preserved across visibility changes.

**Warning signs:**
- List scroll position resets to top every time the user returns from an article on mobile
- Hashtag filter state resets if FilterBar is in the list pane and conditionally unmounted

**Phase to address:**
Phase 3 of v1.2 (mobile layout). Must be an explicit acceptance criterion: verify scroll position is preserved on back navigation.

---

### Pitfall 15: Accessibility — no `aria-selected` or keyboard navigation in the article list

**What goes wrong:**
The article list becomes a master-detail selector. Without ARIA markup, assistive technology (screen readers) cannot understand which item is selected or how to navigate the list. Keyboard users (Tab key only) cannot navigate between list items. The reading pane receives keyboard focus only if `focus()` is called explicitly on selection; without it, focus stays in the list after selection and the reader must tab through the entire list to reach the article content.

**Why it happens:**
The existing list is an Accordion — shadcn's `Accordion` component handles focus and ARIA internally. Replacing it with a custom list of clickable rows removes all the accessibility infrastructure that Accordion provided without any obvious error.

**How to avoid:**
Use `role="listbox"` on the article list container and `role="option"` with `aria-selected={selectedId === article.id}` on each row. Implement keyboard navigation: `ArrowDown`/`ArrowUp` to move through items, `Enter` to select, `Escape` to clear selection and return focus to the list. On selection, call `readingPaneRef.current?.focus()` to move keyboard focus into the reading pane (the pane must have `tabIndex={-1}` to be programmatically focusable). This matches the ARIA Authoring Practices Guide (APG) listbox pattern.

**Warning signs:**
- VoiceOver/NVDA announces only "button" for each article row with no selection state
- Tab key moves focus through every article title without entering the reading pane
- No `role` attributes on the list container

**Phase to address:**
Phase 2 of v1.2 (reading pane + list selection). Can be layered onto the component after basic selection works, but must be in scope for v1.2.

---

### Pitfall 16: StrictMode double-mount of `hashchange` listener and selection effects

**What goes wrong:**
React 19 StrictMode in development mounts every component twice (mount → unmount → mount). A `useEffect` that attaches a `hashchange` listener and does not remove it in the cleanup will attach two listeners. Both fire on every hash change, doubling the state update calls. More critically, if the selection initialisation effect (`pendingNaddr` resolution) runs twice with different timing, it can set selection to `null` on the second mount pass if the article has not yet arrived.

**Why it happens:**
The existing pool singleton and worker singleton are module-level and immune to StrictMode double-mount. But new `useEffect` hooks for `hashchange` and selection resolution will be subject to double-mount. The cleanup function must remove the listener; if omitted, the bug is invisible in production (effects run once) but causes subtle double-selection or double-clear bugs in development.

**How to avoid:**
Always return a cleanup function from every `useEffect` that attaches event listeners. The existing codebase already follows this pattern consistently (e.g. `useClassification` removes the worker message listener in cleanup). Apply the same discipline to the `hashchange` listener:

```typescript
useEffect(() => {
  const handler = () => { ... }
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}, [])
```

The selection resolution effect (Pitfall 2) must be idempotent: calling it twice with the same `filteredArticles` must produce the same result with no side effects.

**Warning signs:**
- In development: article is selected then immediately deselected when loading a deep link
- In development: `hashchange` fires actions twice (console.log fires twice per hash change)
- In production (single mount): everything works, masking the dev-mode bug

**Phase to address:**
Phase 1 of v1.2. StrictMode correctness must be verified in development before any phase acceptance sign-off.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store `selectedId` in `NostrContext` | One less prop to thread | Re-renders entire context on every relay event during streaming | Never — keep in AppShell state |
| Use `window.location.pathname` for selection (path routing) | Prettier URLs | 404 on hard reload on GitHub Pages; requires 404.html path-redirect tuning | Never for this project |
| Render `article.image` directly without `referrerPolicy` | One-line implementation | Privacy leak — IP + Referer sent to arbitrary authors' servers | Never |
| Use `rehype-raw` to support HTML in article bodies | Authors can use HTML formatting | Stored XSS — forbidden by CLAUDE.md | Never |
| Mount/unmount list and reader panes conditionally on mobile | Simpler code | List scroll position lost on every back navigation | Only acceptable if list is short enough that re-scroll is not painful — still not recommended |
| Skip `key` on reading pane scroll container | One less prop | Scroll position carries over between articles | Never — add the key |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `nostr-tools/nip19` naddr decode | Pass `window.location.hash` raw (includes `#`) | `hash.slice(1)` before decode; wrap in try/catch |
| `nip19.naddrEncode` for URL | Encode the event `id` (hex) | Encode `{ kind, pubkey, identifier: article.d }` — naddr uses the d-tag, not event id |
| shadcn `Resizable` on mobile | Render at all breakpoints | Render only at `md:` and above; use CSS swap below |
| `ResizablePanel` + `ScrollArea` | Nest `ScrollArea` directly in panel | Wrap in intermediate `div h-full overflow-y-auto` |
| GitHub Pages `base: "/soveng/"` | Use `window.location.pathname` for routing | Use `window.location.hash` only — base path is irrelevant for hash routing |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Markdown re-render on every relay streaming event | Reading pane flickers during the 0-8s stream window | Derive `selectedArticle` from `filteredArticles` + prop memoisation; keep `selectedId` in AppShell not context | From the first streamed article through EOSE |
| Images in sidebar rows fire 20+ network requests simultaneously on list render | Slow initial load, waterfall in network tab | `loading="lazy"` on all sidebar images | Every page load |
| `useMemo` for `filteredArticles` re-runs on every `classificationVersion` bump | Spurious re-renders during ML classification | Already correct — `classificationVersion` dep is intentional; do not add `selectedId` to the same memo chain | During the 30-60s classification window after page load |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Render `article.image` without `referrerPolicy="no-referrer"` | IP/Referer tracking by arbitrary Nostr authors | Always `referrerPolicy="no-referrer"` on all untrusted-URL images |
| Render `article.image` with `http://` URL on HTTPS site | Mixed content block + broken image | Guard: only render if `url.startsWith('https://')` |
| Remove `rehypeSanitize` from `ArticleBody` during reading pane refactor | Stored XSS from Nostr article bodies | Never inline `<Markdown>` outside `ArticleBody`; add security comment to `ReadingPane` |
| Use `dangerouslySetInnerHTML` as a "simpler" Markdown renderer | XSS | Not applicable — `react-markdown` never uses it; do not introduce it |
| Encode full relay URL in the naddr URL fragment | Relay operator can track which readers are opening which articles (mild) | Omit the relay hint from `naddrEncode`: `{ kind, pubkey, identifier }` only |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state in reading pane while pendingNaddr resolves | User sees "select an article" for 8 seconds on a deep link cold load | Show "> loading article from relay..." while `pendingNaddr` is non-null and streaming is in progress |
| Back button clears hash but does not restore previous list scroll | Disorienting — user loses their place | CSS-visibility mobile swap (Pitfall 14); desktop scroll position is not lost because list stays mounted |
| Selected article highlighted in list but list does not auto-scroll to it on deep link | Article #18 is selected via deep link; user sees articles #1-#10 with no visual indication | `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the selected row after `selectedId` is resolved |
| Sidebar images all same aspect ratio creates ragged layout when some are absent | Visual jitter between rows with/without images | Reserve fixed space (e.g. `w-12 h-12`) even when no image — show monogram placeholder |

---

## "Looks Done But Isn't" Checklist

- [ ] **Deep link on cold load:** Verify on `gsovereignty.github.io/soveng/#naddr1...` (not just localhost) that the article loads after relay streaming completes
- [ ] **Deep link hard reload:** Hard-reload (Cmd+Shift+R) a deep link URL — must NOT 404
- [ ] **Filter hides selected article:** Check article, apply filter that hides it — reading pane must show "hidden by filter" notice, not stale content
- [ ] **Mobile scroll preservation:** On 375px width, scroll list to article 15, tap it, tap back — list must be scrolled back to article 15
- [ ] **Sanitization preserved:** Open DevTools console on a rendered article, search DOM for `<script` — must find none
- [ ] **Mixed content images:** Set `article.image` to `"http://example.com/img.jpg"` in a test fixture — must render monogram fallback, not a mixed-content warning
- [ ] **ResizablePanel scroll:** With 20+ articles, the list panel must scroll independently of the reading pane
- [ ] **Reading pane scroll reset:** Select article A (scroll down), then article B — reading pane must be at the top
- [ ] **StrictMode:** All `useEffect` hooks that attach listeners have cleanup `return` functions; verified by checking no double-fire in dev

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Path routing 404s on GitHub Pages | HIGH | Migrate to hash routing; update all `history.pushState` calls to `location.hash` assignments; remove any router library |
| Cold load selection lost | MEDIUM | Add `pendingNaddr` ref + resolution effect keyed on `filteredArticles` |
| Stale selection on filter | LOW | Change `selectedArticle` derivation to use `filteredArticles` instead of `articles` |
| ScrollArea in ResizablePanel broken | LOW | Add intermediate `div h-full overflow-y-auto` wrapper |
| XSS from dropped rehype-sanitize | CRITICAL | Restore `rehypePlugins={[rehypeSanitize]}`; audit all `<Markdown>` usages; treat as security incident |
| Tracking pixels from untrusted images | MEDIUM | Add `referrerPolicy="no-referrer"` retroactively; no user data leaked to Nostr authors beyond IP |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Path routing 404s (P1) | v1.2 Phase 1 | Hard-reload deep link on live gsovereignty.github.io domain |
| Cold-load async article arrival (P2) | v1.2 Phase 1 | Open deep link URL in new tab; wait for relay stream to complete; article must load |
| Stale selection on filter (P3) | v1.2 Phase 1 | Select article; apply filter that hides it; verify reading pane shows "hidden" notice |
| ResizablePanel overflow:hidden (P4) | v1.2 Phase 1 | Load 20+ articles; confirm list panel scrolls independently |
| Resizable on mobile (P5) | v1.2 Phase 1 (scaffold) + Phase 3 (mobile) | Check at 375px — no drag handle visible; CSS swap works |
| Tracking pixels from image (P6) | v1.2 Phase 2 | Network tab on list render; zero requests to external image hosts above the fold |
| Mixed content http:// image (P7) | v1.2 Phase 2 | Fixture with http:// image URL; no mixed content warning in console |
| rehype-sanitize preserved (P8) | v1.2 Phase 2 | DOM audit: no `<script>` in rendered article content |
| h-full height chain (P9) | v1.2 Phase 1 | Both panels scroll; no content overflow outside viewport |
| Scroll reset on article switch (P10) | v1.2 Phase 2 | Switch articles; reading pane returns to top |
| Selection re-render storm (P11) | v1.2 Phase 1 | React DevTools profiler: ReadingPane does not render on relay streaming events |
| hash # strip (P12) | v1.2 Phase 1 | Unit test: `tryDecodeNaddr('#naddr1...')` returns valid coordinate |
| hashchange initial load (P13) | v1.2 Phase 1 | Unit test: both mount-path and hashchange-event paths covered |
| Mobile scroll position lost (P14) | v1.2 Phase 3 | Manual: scroll list to item 15, select, back, list is still at item 15 |
| Accessibility / ARIA (P15) | v1.2 Phase 2 | VoiceOver: list announces role=listbox, each item has aria-selected |
| StrictMode double listener (P16) | v1.2 Phase 1 | Dev build: no double-fire of hashchange handler; no double selection |

---

## Sources

- shadcn-ui/ui issue #3548 — ScrollArea not working inside ResizablePanel (April 2024)
- shadcn-ui/ui issue #9681 — Touch device dragging issue in Resizable (fixed in react-resizable-panels 4.6.4)
- react-resizable-panels issue #469 — Configurable overflow strategy for Panels
- react-resizable-panels discussion #429 — Scrollable Panels pattern
- github.com/rafgraph/spa-github-pages — 404.html redirect approach for SPA on GitHub Pages; `pathSegmentsToKeep=1` for sub-path project sites
- `node_modules/hast-util-sanitize/lib/schema.js` — confirmed: `img` default schema allows only `src` (+ aria attrs); `protocols.src = ['http', 'https']`; `loading`, `referrerPolicy`, `width`, `height` are in the `*` allowlist
- NIP-19 specification (nips.nostr.com/19) — naddr encodes `kind + pubkey + d-tag identifier`; relay hints are optional and should be omitted for privacy
- `node_modules/nostr-tools/lib/cjs/nip19.js` — `naddrEncode({kind,pubkey,identifier})` produces ~99 char bech32 string; safe as URL fragment
- React docs — "Preserving and Resetting State": CSS visibility vs conditional mounting; `key` prop for scroll reset
- ARIA APG Listbox Pattern — `role=listbox`, `role=option`, `aria-selected`, `aria-activedescendant`; keyboard: Arrow keys navigate, Enter selects, Escape returns focus
- MDN Web Docs — Mixed Content: passive mixed content (`<img src="http://...">`) blocked in strict mode on HTTPS origins
- Web.dev — Cumulative Layout Shift: images without `width`/`height` cause layout shift; `aspect-ratio` CSS as alternative
- Existing codebase — `src/lib/pool.ts`, `src/lib/classifierWorker.ts`: module-level singleton pattern; confirmed safe re StrictMode double-mount because singletons are outside React lifecycle
- Existing codebase — `src/App.tsx`: confirmed `selectedTags`/`matchMode` in AppShell (not context), following D-10 Pattern 5; selection must follow same pattern

---
*Pitfalls research for: v1.2 Email-Client Layout (Soveng Nostr long-form reader, GitHub Pages SPA)*
*Researched: 2026-06-08*
