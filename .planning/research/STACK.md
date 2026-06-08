# Stack Research

**Domain:** v1.2 Email-Client Layout — 2-pane master-detail UI for a zero-backend static Nostr reader
**Researched:** 2026-06-08
**Confidence:** HIGH

## Context

This is a focused stack delta for the v1.2 milestone. The existing stack (Vite 8 + React 19 + TS 5, shadcn/ui new-york Tailwind v4, nostr-tools 2.23.5, react-markdown 10, Vitest) is not being replaced. Only net-new additions are documented here.

The constraint driving every choice: **zero backend, static files served under `/soveng/` on GitHub Pages with a 404.html SPA fallback**. No server-side routing is available. Any routing approach must work entirely client-side, and URL changes must not trigger 404s from the server.

---

## Recommended Stack Additions

### UI Components (shadcn — copy-into-src model, no new runtime dep)

| Component | shadcn add command | Purpose | Why |
|-----------|-------------------|---------|-----|
| `sidebar` | `npx shadcn@latest add sidebar` | 2-pane layout shell — left panel holding article list + all controls | Built-in `SidebarProvider` manages open/closed state and CSS variables; `offcanvas` collapsible mode gives mobile sheet-slide-in for free; `isMobile` from `useSidebar()` drives the mobile list↔reader swap without extra state |
| `resizable` | `npx shadcn@latest add resizable` | User-draggable split between sidebar and reading pane on desktop | Wraps `react-resizable-panels` (bvaughn); `ResizablePanelGroup` + `ResizablePanel` + `ResizableHandle withHandle`; keyboard accessible; persists panel sizes via `autoSaveId` |
| `scroll-area` | `npx shadcn@latest add scroll-area` | Independent scroll within sidebar list and reading pane | Required so the two panes scroll independently; prevents the whole-page scroll that breaks the fixed-height email-client feel; Radix `ScrollArea` handles custom scrollbar theming via Tailwind tokens |
| `separator` | `npx shadcn@latest add separator` | Horizontal dividers between sidebar sections (filter controls / facets / article list) | Zero-dep; already used in shadcn ScrollArea demo; pairs with sidebar section grouping |

**Side-effects of `sidebar` add:** the shadcn CLI auto-adds `sheet` (used internally for mobile off-canvas) and `button` if not already present. Both are copy-into-src — no new npm dependency is introduced. The existing `radix-ui` unified package (already in `package.json`) covers all Radix primitives these components use.

**Side-effects of `resizable` add:** installs `react-resizable-panels@4.11.2` as an npm runtime dependency (536KB unpacked; tree-shakeable to a small gzip footprint). Peer deps: `react>=18`, `react-dom>=18` — both satisfied by the existing React 19 install.

### URL / Deep-Linking (one new runtime dep, or zero-dep manual approach)

**Recommendation: use wouter@3 with `useHashLocation` and `useSearch`.**

This is the lightest viable approach that gives proper back-button support, shareable URLs, and React-idiomatic state-from-URL — without the bundle weight of react-router v7.

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `wouter` | 3.10.0 | Hash-based client-side routing for article selection deep links | ~1.5KB gzip; ships `wouter/use-hash-location` as a named subpath export; `useSearch` + `useSearchParams` hooks read/write `?article=naddr1...` query params; `base` prop on `<Router>` handles the `/soveng/` prefix; no server interaction required |

**Routing strategy — hash-based, not pathname-based:**

The GitHub Pages deployment cannot serve dynamic paths. The existing 404.html SPA fallback handles direct navigations to `/soveng/` but not to arbitrary sub-paths like `/soveng/article/naddr1...` — that would require server-side redirect logic that GitHub Pages does not support for arbitrary paths.

Hash routing (`/#?article=naddr1...`) keeps the entire URL state in the fragment, which the server never sees. Every navigation stays on the single `/soveng/` HTML response. The back button and browser history work because the browser manages hash history natively.

**URL shape:**
```
https://gsovereignty.github.io/soveng/#?article=naddr1qqzkjurn...
```

The `#` fragment is the hash router's path. The `?article=` is a search param within that hash path, read via wouter's `useSearch`/`useSearchParams` hook. This is distinct from `window.location.hash` in the traditional anchor-jump sense — wouter intercepts it as a router path.

**Integration with Vite base config:**
The existing `vite.config.ts` sets `base: "/soveng/"`. Wouter's `<Router base="/soveng/">` prop is only relevant for `useBrowserLocation`; with `useHashLocation`, the base is irrelevant because the server always serves the same document regardless of hash. No `vite.config.ts` change required.

**Alternative considered — no library at all (manual `window.location.hash`):**

It is viable to manage the selected article purely via `useState` + `useEffect` + `window.location.hash` + `hashchange` event listener without any routing library. The pattern is:

```typescript
// On mount: read hash → set selectedNaddr state
// On select: write window.location.hash = '#?article=' + naddr
// hashchange listener: update state
```

This works and adds zero bytes. However, it requires manual implementation of:
- `pushState`-style history (back button sees every change, not just article opens)
- URL encoding/decoding
- `replaceState` vs `pushState` decision (replace on filter change, push on article open)

For a single parameter this is achievable in ~20 lines. The recommendation is wouter because its `useSearchParams` hook handles the `URLSearchParams` read/write API idiomatically in React and the 1.5KB cost is justified. If the team prefers zero new dependencies, the manual approach is documented in PITFALLS.md.

### Nostr URL Encoding (no new dependency — nostr-tools already installed)

`nostr-tools/nip19` (already in `package.json`) provides `naddrEncode` and `decode` for kind:30023 addressable events. **No new library is needed.**

The `Article` type (already in `src/types/nostr.ts`) carries all fields needed to construct an naddr:
- `article.d` → `identifier`
- `article.pubkey` → `pubkey`
- `30023` → `kind` (constant)
- Relay hints are optional — omit them to keep URLs shorter

```typescript
import { naddrEncode, decode } from 'nostr-tools/nip19'

// Encode (article → URL param)
const naddr = naddrEncode({
  identifier: article.d,
  pubkey: article.pubkey,
  kind: 30023,
  // relays: [] — omitted for shorter URLs; article already in memory
})

// Decode (URL param → lookup key)
const result = decode(naddr)
if (result.type === 'naddr') {
  const { identifier, pubkey, kind } = result.data
  const coordinate = `${kind}:${pubkey}:${identifier}` // matches Article.coordinate
}
```

The `Article.coordinate` field (`"30023:pubkey:d"`) is the stable deduplication key already used by the data layer. Round-tripping through naddr decode reconstructs the coordinate without needing the event `id`. Use `coordinate` as the lookup key, not `id`, because the data layer dedupes by coordinate and may have replaced an article event with a newer version.

---

## Installation

```bash
# shadcn component additions (copy-into-src, no new npm dep except react-resizable-panels)
npx shadcn@latest add sidebar
npx shadcn@latest add resizable
npx shadcn@latest add scroll-area
npx shadcn@latest add separator

# Routing (one small runtime dep)
npm install wouter@3.10.0
```

No `nostr-tools` or `react-markdown` changes needed.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-router@7` | 2.3–4.3MB unpacked depending on version bracket; tree-shaking is per-route not per-feature (known open issue #10354); HashRouter + useSearchParams adds disproportionate weight for one URL param | `wouter` (~1.5KB gzip) or manual `hashchange` |
| `react-router-dom` separately | `react-router-dom` no longer exists as a separate package in v7 — it merged into `react-router`. Adding it installs the full framework package. | `wouter` |
| `history` (npm) | Transitively pulled in by react-router v5/v6; wouter has zero additional deps | `wouter` ships its own 100-line hash history |
| `@radix-ui/react-*` individual packages | The project already uses the unified `radix-ui` package (added in shadcn February 2026 migration). New shadcn components added via CLI will import from `radix-ui` not `@radix-ui/react-*`. Do not add individual Radix packages manually. | Shadcn CLI handles this correctly |
| BrowserRouter / `createBrowserRouter` with basename | Requires the server to serve the same HTML for all paths under `/soveng/`. GitHub Pages 404.html fallback only redirects to `/soveng/` — not to arbitrary subpaths. History-based routing will break on direct URL load of any article link. | `useHashLocation` in wouter or `HashRouter` in react-router |
| NDK, applesauce, or any Nostr protocol library beyond nostr-tools | Presentation-layer rework only; data layer is unchanged and validated | nostr-tools already installed |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `wouter` + `useHashLocation` | Manual `hashchange` + `useState` | Zero-dependency preference, or if the team finds wouter's API unfamiliar. The manual approach is ~20 lines and fully viable for one URL param. |
| `wouter` + `useHashLocation` | `react-router@7` `createHashRouter` | React Router makes sense when you have multiple named routes, data loaders, nested layouts, or route-based code splitting. This app has one selectable state (the article). react-router's overhead is not justified. |
| shadcn `Sidebar` + `Resizable` | Custom CSS flex/grid layout | Custom layout is fine if you want zero new UI components. shadcn `Sidebar` is chosen because it handles the mobile off-canvas sheet, the keyboard shortcut, and the CSS variable width system out of the box — otherwise all that needs to be built from scratch, violating the standing "use existing shadcn components" preference. |
| naddr (NIP-19) for article URL ID | Raw event `id` (hex) | A raw hex `id` is shorter but ties the URL to a specific event version. naddr encodes the coordinate (kind+pubkey+d), which matches the data layer's deduplication key and remains valid if a newer version of the article is fetched. Use naddr. |
| naddr without relay hints | naddr with relay hints | Relay hints make naddr strings ~80 chars longer per relay and are not needed here because the app fetches from a fixed relay set and has the article in memory. Omit relays for shorter shareable URLs. |

---

## App.tsx Integration Points

The v1.2 rework replaces App.tsx's current single-column `<div className="... flex flex-col">` with a 2-pane layout shell. The existing state (selectedTags, matchMode, filterEnabled, spamThreshold, classificationMap, visibleArticles, facets) stays in `AppShell` — none of it moves to a router or context. The only addition is:

1. **`selectedNaddr: string | null`** — new state, initialised from URL hash on mount via `useSearch`/`useSearchParams` from wouter.
2. **`SidebarProvider` + `Sidebar`** — wraps the left panel (FilterBar + ContentFilterControls + ArticleList).
3. **`ResizablePanelGroup`** — replaces the `max-w-2xl` centering div; contains `ResizablePanel` (sidebar, ~300px default) + `ResizableHandle` + `ResizablePanel` (reading pane, flex-1).
4. **`ScrollArea`** — wraps both the sidebar article list and the reading pane content independently.
5. **`ArticleBody`** component (already exists) — moved from inline accordion into the reading pane with a terminal placeholder when `selectedNaddr` is null.

The `NostrProvider` wrapper and all hook-based data fetching in `AppShell` are unchanged.

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `wouter` | 3.10.0 | React 19 | Peer dep is React 16.8+; ships ES modules; no React context conflicts with shadcn or nostr-tools |
| `react-resizable-panels` | 4.11.2 | React 18/19 | Installed by `npx shadcn@latest add resizable`; peer dep `react>=18` satisfied |
| shadcn `sidebar` | latest CLI | Tailwind v4, React 19, `radix-ui` unified | Requires `Sheet` component as internal dep; CLI installs both together |
| nostr-tools nip19 subpath | 2.23.5 | `nostr-tools/nip19` | `naddrEncode`/`decode` available at this version; import from subpath not root barrel |

---

## Sources

- `/llmstxt/ui_shadcn_llms_txt` (Context7) — Sidebar component props/collapsible modes, SidebarProvider, ResizablePanelGroup/Panel/Handle, ScrollArea, Sheet mobile integration
- `/nbd-wtf/nostr-tools` (Context7) — `naddrEncode`, `decode`, NIP-19 naddr type, kind 30023 constant
- `/remix-run/react-router` (Context7) — `createHashRouter`, `HashRouter`, `useSearchParams` — verified available in v7 but not recommended here
- https://ui.shadcn.com/docs/components/sidebar — SidebarProvider structure, collapsible modes, mobile Sheet behavior
- https://ui.shadcn.com/docs/components/resizable — `react-resizable-panels` dependency, install command
- https://ui.shadcn.com/docs/changelog/2026-02-radix-ui — unified `radix-ui` package migration (Feb 2026); new-york style components import from `radix-ui` not `@radix-ui/react-*`
- https://github.com/molefrog/wouter — `useHashLocation` subpath export, `useSearch`/`useSearchParams`, `base` prop, ~1.5KB gzip claim
- npm registry — `wouter@3.10.0` (75KB unpacked), `react-resizable-panels@4.11.2` (536KB unpacked), `react-router@7.17.0` (4.75MB unpacked)
- https://github.com/nostr-protocol/nips/blob/master/19.md — naddr encoding spec: identifier+pubkey+kind+optional relays
- https://nostrbook.dev/kinds/30023 — kind:30023 naddr deep-link convention

---
*Stack research for: Soveng v1.2 Email-Client Layout milestone*
*Researched: 2026-06-08*
