# Phase 6: Layout Scaffold & Routing - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 7 (5 modified, 1 created, 1 shadcn add)
**Analogs found:** 6 / 7 (the `resizable` shadcn add has no analog — CLI-generated)

This phase is presentation-layer plumbing only. The frozen memo chain
(`sortedArticles → visibleArticles → facets → dynamicCounts → filteredArticles`,
`src/App.tsx` lines 37–77) does NOT change — `selectedArticle` is the single append.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/App.tsx` (AppShell) | container / state-owner | event-driven (hashchange) + transform (memo) | itself (existing AppShell) | self / in-place |
| `src/components/FilterBar.tsx` | component (presentational) | request-response (props) | itself + `ContentFilterControls.tsx` | self / in-place |
| `src/components/ContentFilterControls.tsx` | component (presentational) | request-response (props) | itself | self / in-place |
| `src/index.css` | config (global styles) | n/a | existing `@layer base` block | self / in-place |
| `src/lib/nostr.ts` (`articleNaddr`) | utility (pure helper) | transform | `getMonogram` npubEncode try/catch + existing `articleCoordinate` | exact |
| reading-pane stub (new component) | component (presentational) | request-response (props) | `ArticleCard.tsx` (header) + `ArticleList.tsx` (status line) | role-match (header subtree is exact) |
| `src/components/ui/resizable.tsx` | config (shadcn primitive) | n/a | none (CLI-generated) | no analog |

## Pattern Assignments

### `src/App.tsx` — AppShell (container, event-driven + transform)

**Analog:** itself — every new piece mirrors an existing pattern already in this file.

**1. Local-UI-state-in-AppShell pattern (D-10 / Pattern 5)** — `selectedNaddr` follows
the exact shape of the existing filter state. Existing (lines 18–28):
```typescript
// Local UI filter state — NOT in NostrContext (D-10, Pattern 5)
const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR') // D-09: default OR
```
New state initializes from the URL hash (P12 strip, P13 read-on-mount):
```typescript
const [selectedNaddr, setSelectedNaddr] = useState<string>(
  () => window.location.hash.slice(1) || ''
)
```

**2. StrictMode-safe event-listener effect (P16)** — the codebase's canonical
add/remove cleanup is `useClassification.ts` lines 166–172. Copy that discipline for
the `hashchange` listener:
```typescript
// src/hooks/useClassification.ts:166–172 — the pattern to mirror
worker.addEventListener("message", handleMessage)
return () => {
  worker.removeEventListener("message", handleMessage)
}
```
Applied to the hashchange listener (cleanup is mandatory — P16):
```typescript
useEffect(() => {
  const onHashChange = () => setSelectedNaddr(window.location.hash.slice(1) || '')
  window.addEventListener('hashchange', onHashChange)
  return () => window.removeEventListener('hashchange', onHashChange)
}, [])
```
There is also an existing persistence effect at lines 31–33 (`localStorage.setItem`)
showing the project's single-concern `useEffect` style.

**3. `selectedArticle` memo — the ONLY chain append (P11 / ARCHITECTURE)** — mirrors the
existing `useMemo` derivation style (lines 74–77 `filteredArticles`). Append AFTER
`filteredArticles`; search filtered first, fall back to `sortedArticles` (both already in
scope) for the cold-load (P2) and filter-hidden (P3) cases:
```typescript
const selectedArticle = useMemo(() => {
  if (!selectedNaddr) return null
  const inFiltered = filteredArticles.find(a => articleNaddr(a) === selectedNaddr)
  if (inFiltered) return inFiltered
  return sortedArticles.find(a => articleNaddr(a) === selectedNaddr) ?? null
}, [selectedNaddr, filteredArticles, sortedArticles])
```

**4. Outer-wrapper + layout swap (P9 / P4)** — the current centered single column
(lines 95–101) is the thing being replaced:
```typescript
// CURRENT (centered single column — being replaced):
<div className="crt-scanlines crt-flicker min-h-screen bg-terminal-bg flex flex-col items-center justify-center p-8">
  <header className="w-full max-w-2xl mb-6"> ... </header>
  <main className="w-full max-w-2xl"> ... </main>
```
Change to a full-viewport `h-screen flex flex-col overflow-hidden` shell (P9), keeping
`crt-scanlines crt-flicker bg-terminal-bg` on the outer div so the CRT aesthetic
(LAYOUT-03) covers both panes. Inside, host `ResizablePanelGroup orientation="horizontal"`.
Sidebar panel `defaultSize={35} minSize={25} maxSize={50}` (D-01/D-02); reading pane takes
the remainder. Each `ResizablePanel` must wrap scroll content in an inner
`<div className="flex-1 overflow-y-auto">` to defeat the injected `overflow:hidden`
(P4 / shadcn #3548) — never put `overflow-y-auto` directly on the panel.

**5. Terminal status-conditional render (preserve)** — the `status` branch ladder
(lines 103–129: `streaming`→BootSequence, `error`→`[ERR]`, `empty`→`[EMPTY]`, else content)
and the `[FILTER]` empty branch (lines 149–160) are reused. `NostrStatus` is
`'streaming' | 'done' | 'empty' | 'error'` (`src/types/nostr.ts:1`) — the non-streaming /
404 decision (D-09) keys off `status !== 'streaming'`.

**6. Selection handler** — new, no analog, trivial:
```typescript
function onSelectArticle(article: Article) {
  const naddr = articleNaddr(article)
  setSelectedNaddr(naddr)
  window.location.hash = naddr   // hashchange listener keeps state in sync on back/fwd
}
```

---

### `src/lib/nostr.ts` — `articleNaddr` helper (utility, transform)

**Analog:** the `npubEncode` try/catch in `getMonogram` (`ArticleCard.tsx:20–24` and
`:46–51`) + the existing pure-helper style of `articleCoordinate` (`nostr.ts:4–7`).

**Imports pattern** — subpath import (CLAUDE.md: never root barrel). `ArticleCard.tsx:7`:
```typescript
import { npubEncode } from "nostr-tools/nip19"
```
Add alongside: `import { naddrEncode } from "nostr-tools/nip19"`.

**Existing pure-helper signature to mirror** (`nostr.ts:4–7`):
```typescript
export function articleCoordinate(event: Event): string {
  const d = event.tags.find(t => t[0] === "d")?.[1] ?? ""
  return `${event.kind}:${event.pubkey}:${d}`
}
```

**Try/catch fallback discipline to mirror** (`ArticleCard.tsx:46–51`, the 03-01 decision):
```typescript
try {
  displayName = npubEncode(article.pubkey).slice(0, 12) + "…"
} catch {
  displayName = article.pubkey.slice(0, 12) + "…"
}
```

**New helper** — `Article` already carries `pubkey` and `d` (`nostr.ts:26–38`). Omit relay
hints (privacy + shorter URLs, per STACK/PITFALLS):
```typescript
export function articleNaddr(article: Article): string {
  try {
    return naddrEncode({ kind: 30023, pubkey: article.pubkey, identifier: article.d })
  } catch {
    return article.coordinate   // fallback: stable coordinate key, never throws
  }
}
```

---

### `src/components/FilterBar.tsx` (component, request-response) — reposition only

**Analog:** itself. Props/logic UNCHANGED (D-05). The ONLY edit is dropping the sticky
wrapper. Current root element (line 30):
```typescript
<div className="sticky top-0 z-20 bg-terminal-bg border-b border-terminal-border py-2 px-0 mb-4">
```
Drop `sticky top-0 z-20` (D-05 — controls now live in a `shrink-0` pinned header, so
sticky is unnecessary and was the research-flagged fragility). Keep
`bg-terminal-bg border-b border-terminal-border py-2 px-0 mb-4`. Nothing else changes —
the `ToggleGroup` match-mode control, the `Checkbox` facet list, and the `> more (n)`
expander all stay verbatim.

---

### `src/components/ContentFilterControls.tsx` (component, request-response) — reposition only

**Analog:** itself. Props/logic UNCHANGED. Root wrapper (line 29) already has no sticky:
```typescript
<div className="flex flex-col gap-2 border-b border-terminal-border py-2 mb-2">
```
This `border-b … py-2 mb-2` wrapper is fine inside the sidebar pinned header. Move the
JSX into the sidebar `shrink-0` header above `FilterBar`; no internal edits.

---

### `src/index.css` (config) — height chain (P9)

**Analog:** the existing `@layer base` block (lines 45–58), which already styles `body`
with `min-height: 100vh`.

Current (lines 49–57):
```css
body {
  background-color: var(--color-terminal-bg);
  color: var(--color-terminal-green);
  font-family: var(--font-mono);
  -webkit-font-smoothing: antialiased;
  margin: 0;
  padding: 0;
  min-height: 100vh;
}
```
Add `height: 100%` on `html, body, #root` so the `h-full`/`h-screen` chain resolves (P9 —
`h-full` collapses to zero without an explicit-height ancestor). Add inside `@layer base`:
```css
html, body, #root {
  height: 100%;
}
html, body {
  overflow: hidden;   /* prevent double scrollbar — scroll lives inside each panel */
}
```
Note: change `body`'s `min-height: 100vh` to coexist with `height: 100%`; the inner panes
own scrolling now, not the page. The accordion keyframes (lines 126–140) can stay — no harm.

---

### Reading-pane stub component (component, request-response) — NEW

**Analog:** `ArticleCard.tsx` (the metadata header subtree is an EXACT reuse) +
`ArticleList.tsx` (the terminal status-line copy pattern).

**Title fallback chain** — copy verbatim from `ArticleCard.tsx:35–38`:
```typescript
const displayTitle =
  article.title?.trim() ||
  article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80) ||
  "(untitled)"
```

**Author name fallback chain (DISP-02)** — copy verbatim from `ArticleCard.tsx:42–52`:
```typescript
let displayName: string
const resolvedName = profile?.displayName?.trim()
if (resolvedName) {
  displayName = resolvedName
} else {
  try {
    displayName = npubEncode(article.pubkey).slice(0, 12) + "…"
  } catch {
    displayName = article.pubkey.slice(0, 12) + "…"
  }
}
const monogram = getMonogram(profile, article.pubkey)
```
NOTE: `getMonogram` currently lives module-private in `ArticleCard.tsx:11–25`. For the
stub, either copy it or hoist it to a shared util (planner's call — ArticleCard is deleted
in Phase 7 anyway, per CONTEXT D-flag).

**Avatar + name + timestamp header** — copy the metadata row from `ArticleCard.tsx:70–98`
(`Avatar`/`AvatarImage`/`AvatarFallback` from `@/components/ui/avatar`, the grayscale/
hue-rotate image classes, the truncated name, the `/` separator, and
`formatTimestamp(article.publishedAt)` from `@/lib/formatTimestamp`):
```typescript
<div className="flex items-center gap-2 text-xs text-terminal-green-dim">
  <Avatar className="h-6 w-6 shrink-0">
    <AvatarImage
      src={profile?.picture}
      alt={displayName}
      className="grayscale brightness-75 sepia hue-rotate-90 saturate-200"
    />
    <AvatarFallback className="bg-terminal-surface border border-terminal-border text-terminal-green-dim text-[10px]">
      {monogram}
    </AvatarFallback>
  </Avatar>
  <span className="truncate max-w-[12rem]">{displayName}</span>
  <span className="text-terminal-muted select-none">/</span>
  <span className="text-terminal-muted shrink-0">{formatTimestamp(article.publishedAt)}</span>
</div>
```
Do NOT wrap in `AccordionItem/Trigger/Content` — the stub is a plain header `div`
(Phase 7 inserts `<ArticleBody>` below it; Phase 6 renders NO Markdown body, D-06).

**Terminal placeholder / loading / 404 states** — mirror the bracketed-tag terminal copy
from `App.tsx` (`[ERR]`/`[EMPTY]`/`[FILTER]` lines 107/119/151) and the `> streaming…`
status copy from `ArticleList.tsx:31–37`. Per CONTEXT specifics:
- No selection (`!selectedNaddr`): `> select an article to read` (READ-02, D-07)
- Cold-load (`selectedNaddr` set, `selectedArticle` null, `status === 'streaming'`):
  `> resolving article from relays…` (D-08)
- Not found (`selectedNaddr` set, `selectedArticle` null, `status !== 'streaming'`):
  `[404] article not found on connected relays` (D-09)
Style each like the existing status lines — `font-mono text-sm`, `text-terminal-muted` /
`crt-glow text-terminal-green-dim`, centered in the pane.

---

### `src/components/ui/resizable.tsx` — shadcn add (config) — NO analog

CLI-generated, not hand-written. Run `npx shadcn@latest add resizable` (installs
`react-resizable-panels@4.11.2` — confirmed NOT yet in `package.json`). Exports
`ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` from `@/components/ui/resizable`.
Per CLAUDE.md "use existing shadcn components", this is the sanctioned primitive — do not
hand-roll a flex/grid split. Use `ResizableHandle withHandle` for a visible drag affordance.

## Shared Patterns

### nip19 subpath import (never root barrel)
**Source:** `src/components/ArticleCard.tsx:7`
**Apply to:** `src/lib/nostr.ts` (`articleNaddr`), reading-pane stub (`npubEncode`)
```typescript
import { npubEncode } from "nostr-tools/nip19"   // + naddrEncode in nostr.ts
```
CLAUDE.md "What NOT to Use": root `from 'nostr-tools'` defeats tree-shaking — use subpaths.

### nip19 encode try/catch fallback (03-01)
**Source:** `src/components/ArticleCard.tsx:20–24, 46–51`
**Apply to:** `articleNaddr` in `nostr.ts`, author-name fallback in the reading-pane stub
A bare encode can throw on malformed input; always wrap and fall back to a raw-string slice
or the stable `coordinate`.

### StrictMode-safe addEventListener cleanup (P16)
**Source:** `src/hooks/useClassification.ts:166–172`
**Apply to:** the `hashchange` `useEffect` in AppShell
```typescript
target.addEventListener(evt, handler)
return () => target.removeEventListener(evt, handler)
```
Every listener-attaching effect MUST return a cleanup — React 19 StrictMode double-mounts
in dev, and a missing cleanup attaches two listeners (double-fire / double-select).

### Local-UI-state-in-AppShell, never NostrContext (D-10 / P11)
**Source:** `src/App.tsx:18–28` (`selectedTags`, `matchMode`, `filterEnabled`)
**Apply to:** `selectedNaddr`
Keep selection in AppShell `useState`; deriving `selectedArticle` as a local `useMemo`
avoids the relay-streaming re-render storm (P11).

### Terminal bracketed-tag / `>` prompt status copy
**Source:** `src/App.tsx:107,119,151` (`[ERR]`/`[EMPTY]`/`[FILTER]`) and
`src/components/ArticleList.tsx:31,35` (`> streaming…`, `> ready —`)
**Apply to:** the reading-pane stub placeholder/loading/404 states
Match the convention: `>` for prompts, `[TAG]` for terminal states, `font-mono text-sm`,
`text-terminal-muted` / `crt-glow text-terminal-green-dim`.

### ResizablePanel inner-scroll wrapper (P4 / shadcn #3548)
**Source:** PITFALLS.md P4; no codebase analog (new layout)
**Apply to:** both panels in AppShell
Wrap each panel's scroll content in `<div className="flex-1 overflow-y-auto">` — the panel
itself gets `overflow:hidden` inline from the library, so scroll must live in a child.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/ui/resizable.tsx` | shadcn primitive | n/a | CLI-generated via `npx shadcn@latest add resizable`; no existing layout primitive to copy. Planner should use STACK.md + shadcn docs for the `ResizablePanelGroup`/`ResizableHandle` API. |

The 2-pane shell *structure* (h-screen flex chain, panel sizing, inner-scroll wrapper) has
no codebase analog either — follow ARCHITECTURE.md "Layout Structure" and PITFALLS P4/P9.

## Metadata

**Analog search scope:** `src/App.tsx`, `src/lib/nostr.ts`, `src/lib/formatTimestamp.ts`,
`src/components/{FilterBar,ContentFilterControls,ArticleCard,ArticleList}.tsx`,
`src/components/ui/avatar.tsx`, `src/hooks/useClassification.ts`, `src/types/nostr.ts`,
`src/components/ui/` (listing), `package.json` (resizable dep check)
**Files scanned:** 11
**Pattern extraction date:** 2026-06-09
