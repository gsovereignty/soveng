# Phase 4: Filtering & Inline Reader — Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 7 (new/modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/App.tsx` | component (shell) | request-response + derived state | `src/App.tsx` itself | self (modify) |
| `src/components/ArticleList.tsx` | component | transform + event-driven | `src/components/ArticleList.tsx` itself | self (modify) |
| `src/components/ArticleCard.tsx` | component | event-driven | `src/components/ArticleCard.tsx` itself | self (modify) |
| `src/components/FilterBar.tsx` | component | event-driven | `src/components/BootSequence.tsx` | role-match (terminal-aesthetic interactive component) |
| `src/components/ArticleBody.tsx` | component | transform | `src/components/ArticleCard.tsx` | role-match (renders untrusted Article data) |
| `src/lib/facets.ts` | utility | transform | `src/lib/nostr.ts` | role-match (pure transform helpers over Article[]) |
| `src/index.css` | config | — | `src/index.css` itself | self (modify — add Markdown prose rules) |

---

## Pattern Assignments

### `src/App.tsx` — MODIFY (component, derived state)

**Analog:** `src/App.tsx` (lines 1–65)

**Existing import pattern** (lines 1–5):
```typescript
import { BootSequence } from "@/components/BootSequence"
import { ArticleList } from "@/components/ArticleList"
import { NostrProvider } from "@/context/NostrContext"
import { useNostr } from "@/context/NostrContext"
```
Add `FilterBar` and `useState`/`useMemo` imports alongside these. New imports follow the `@/components/` alias pattern.

**Context consumption pattern** (lines 8–8):
```typescript
const { status, articles, profiles, refetch } = useNostr()
```
Filter state is local — do NOT add to `NostrContext`. Append after the `useNostr()` call:
```typescript
const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR')
const facets = useMemo(() => buildFacets(articles), [articles])
const dynamicCounts = useMemo(
  () => computeDynamicCounts(articles, selectedTags, matchMode),
  [articles, selectedTags, matchMode]
)
const filteredArticles = useMemo(() => {
  if (selectedTags.size === 0) return articles
  return articles.filter(article =>
    matchMode === 'OR'
      ? article.hashtags.some(t => selectedTags.has(t))
      : article.hashtags.every(t => selectedTags.has(t))  // AND: must carry ALL selected
  )
}, [articles, selectedTags, matchMode])
const isFilterEmpty = selectedTags.size > 0 && filteredArticles.length === 0
```

**Status branch pattern** (lines 19–47) — the existing `if/else` cascade. Add the empty-filter branch INSIDE the final `else` arm (after articles exist), NOT as a new top-level status:
```typescript
) : (
  /* articles.length > 0 — streaming with articles, or done */
  <>
    <FilterBar ... />
    {isFilterEmpty ? (
      <div className="font-mono text-sm">
        <p className="text-terminal-muted mb-4">
          [FILTER] no articles match the selected tags
        </p>
        <button
          onClick={() => setSelectedTags(new Set())}
          className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
        >
          &gt; clear filters
        </button>
      </div>
    ) : (
      <ArticleList articles={filteredArticles} profiles={profiles} status={status} />
    )}
  </>
)}
```

**Button pattern** (lines 27–32) — the existing retry buttons. The "clear filters" button copies this exact pattern: `crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer`. No variants, no shadcn Button component — raw `<button>` with terminal classes.

**Layout container** (line 11):
```typescript
<div className="crt-scanlines crt-flicker min-h-screen bg-terminal-bg flex flex-col items-center justify-center p-8">
```
The sticky `FilterBar` mounts inside `<main className="w-full max-w-2xl">` above `ArticleList`, inside the same `max-w-2xl` centred column.

---

### `src/components/ArticleList.tsx` — MODIFY (component, event-driven)

**Analog:** `src/components/ArticleList.tsx` (lines 1–39)

**Existing import pattern** (lines 1–3):
```typescript
import type { Article, Profile, NostrStatus } from "@/types/nostr"
import { ArticleCard } from "@/components/ArticleCard"
import { cn } from "@/lib/utils"
```
Add accordion imports alongside:
```typescript
import { useState, useEffect, useMemo } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
```

**Props interface pattern** (lines 5–9): the interface already accepts `articles`, `profiles`, `status`. No new props — `filteredArticles` replaces `articles` at the call site in `App.tsx`; `ArticleList` receives the pre-filtered array and does not know about filter state.

**Streaming status header** (lines 14–24) — keep as-is. It shows count of items passed in; with filtered articles this naturally reflects the filtered count.

**Article map** (lines 28–33) — replace the `div.flex.flex-col.gap-2` + `ArticleCard` map with an `Accordion`. The `openId` controlled state and the D-10 clear effect live here:
```typescript
const [openId, setOpenId] = useState<string>('')

// D-10: clear open article when filter changes and the open article is excluded
const articleIds = useMemo(() => new Set(articles.map(a => a.id)), [articles])
useEffect(() => {
  if (openId && !articleIds.has(openId)) setOpenId('')
}, [articleIds, openId])

// Render:
<Accordion
  type="single"
  collapsible
  value={openId}
  onValueChange={setOpenId}
  className="flex flex-col gap-2"
>
  {articles.map((article) => (
    <ArticleCard
      key={article.id}
      article={article}
      profile={profiles.get(article.pubkey)}
    />
  ))}
</Accordion>
```
Note: `ArticleCard` becomes an `AccordionItem` — see ArticleCard section below.

---

### `src/components/ArticleCard.tsx` — MODIFY (component, event-driven)

**Analog:** `src/components/ArticleCard.tsx` (lines 1–100)

**Existing import pattern** (lines 1–6):
```typescript
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Article, Profile } from "@/types/nostr"
import { formatTimestamp } from "@/lib/formatTimestamp"
import { npubEncode } from "nostr-tools/nip19"
```
Replace `Card`/`CardContent` imports with Accordion anatomy:
```typescript
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { ArticleBody } from "@/components/ArticleBody"
```
`Avatar`, `AvatarImage`, `AvatarFallback`, `cn`, `Article`, `Profile`, `formatTimestamp`, `npubEncode` — all kept unchanged.

**Title fallback** (lines 34–37) — keep exactly as-is:
```typescript
const displayTitle =
  article.title?.trim() ||
  article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80) ||
  "(untitled)"
```

**Author name fallback** (lines 39–50) — keep exactly as-is including the `try/catch` on `npubEncode`.

**Return value** — replace `<Card>/<CardContent>` wrapper with `<AccordionItem>`:
```typescript
return (
  <AccordionItem
    value={article.id}
    className={cn("border-terminal-border bg-terminal-surface w-full")}
  >
    <AccordionTrigger className="font-mono text-left hover:no-underline px-4 py-3 [&>svg]:shrink-0 [&>svg]:text-terminal-green-dim">
      {/* Title row — styled span not h3 (avoid nested heading; the AccordionTrigger already renders as h3 via AccordionPrimitive.Header) */}
      <div className="flex flex-col gap-2 flex-1 text-left">
        <div className="crt-glow text-terminal-green font-semibold leading-snug">
          {displayTitle}
        </div>
        {/* Metadata row — identical markup to existing lines 68–97 */}
        <div className="flex items-center gap-2 text-xs text-terminal-green-dim">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage ... />
            <AvatarFallback ... />
          </Avatar>
          <span className="truncate max-w-[12rem]">{displayName}</span>
          <span className="text-terminal-muted select-none">/</span>
          <span className="text-terminal-muted shrink-0">{formatTimestamp(article.publishedAt)}</span>
        </div>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4">
      <ArticleBody content={article.content} />
    </AccordionContent>
  </AccordionItem>
)
```

**Critical class for chevron:** `[&>svg]:shrink-0` prevents the Accordion's internal `ChevronDown` from compressing. The existing `ArticleCard` metadata markup (avatar, author name, separator, timestamp) copies verbatim from lines 68–97.

---

### `src/components/FilterBar.tsx` — NEW (component, event-driven)

**Analog:** `src/components/BootSequence.tsx` (terminal-aesthetic interactive component)

**Import pattern** — follow `BootSequence.tsx` (lines 1–3) for Card/cn imports, then add new shadcn controls:
```typescript
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { Article } from "@/types/nostr"
```
No `Card` wrapper here — the sticky bar is a plain `<div>` with terminal border, not a card surface.

**Props interface** — receives everything it needs to render; filter state callbacks stay in `App.tsx` (AppShell):
```typescript
interface FilterBarProps {
  facets: { tag: string; count: number }[]        // sorted by count desc, alpha tie-break
  dynamicCounts: Map<string, number>              // D-08 live counts per tag
  selectedTags: Set<string>
  matchMode: 'OR' | 'AND'
  onTagToggle: (tag: string) => void
  onMatchModeChange: (mode: 'OR' | 'AND') => void
}
```

**Sticky layout** — the bar uses `position: sticky` and `top-0`. In terminal theme, it gets the same `bg-terminal-bg` as the page so it covers scroll content:
```typescript
<div className="sticky top-0 z-20 bg-terminal-bg border-b border-terminal-border py-2 px-0 mb-4">
  <div className="font-mono text-xs text-terminal-green-dim mb-2 tracking-widest uppercase">
    &gt; filter by tag
  </div>
  {/* tag checkboxes + show-more toggle */}
  {/* AND/OR segmented control */}
</div>
```

**Checkbox pattern** — copied from RESEARCH.md Pattern examples, styled with `terminal-*` tokens:
```typescript
<div className="flex items-center gap-2">
  <Checkbox
    id={`tag-${tag}`}
    checked={selectedTags.has(tag)}
    onCheckedChange={(checked) => {
      if (checked !== 'indeterminate') onTagToggle(tag)
    }}
    className="border-terminal-border data-[state=checked]:bg-terminal-green data-[state=checked]:border-terminal-green rounded-none"
  />
  <label htmlFor={`tag-${tag}`} className="font-mono text-xs text-terminal-green-dim cursor-pointer select-none">
    #{tag}
    <span className="ml-1 text-terminal-muted">({dynamicCounts.get(tag) ?? 0})</span>
  </label>
</div>
```

**Show-more toggle** — plain `useState` boolean (not shadcn `Collapsible` — instant show/hide, no animation needed per open question resolution in RESEARCH.md):
```typescript
const CAP = 10
const [showAll, setShowAll] = useState(false)
const visibleFacets = showAll ? facets : facets.slice(0, CAP)
const hiddenCount = facets.length - CAP
// Render after visible checkboxes:
{!showAll && hiddenCount > 0 && (
  <button
    onClick={() => setShowAll(true)}
    className="font-mono text-xs text-terminal-muted hover:text-terminal-green-dim cursor-pointer"
  >
    &gt; more ({hiddenCount})
  </button>
)}
```

**ToggleGroup AND/OR** — with mandatory deselection guard from RESEARCH.md Pitfall 2:
```typescript
<ToggleGroup
  type="single"
  value={matchMode === 'OR' ? 'or' : 'all'}
  onValueChange={(val) => {
    if (val === 'or' || val === 'all') onMatchModeChange(val === 'or' ? 'OR' : 'AND')
    // Guard: ignore val === '' (user clicked already-selected item)
  }}
  className="font-mono text-xs border border-terminal-border rounded-none"
>
  <ToggleGroupItem
    value="or"
    className="px-3 py-1 text-xs font-mono rounded-none data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green"
  >
    Match ANY
  </ToggleGroupItem>
  <ToggleGroupItem
    value="all"
    className="px-3 py-1 text-xs font-mono rounded-none data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green"
  >
    Match ALL
  </ToggleGroupItem>
</ToggleGroup>
```

**Terminal-prompt header line** — copy the existing terminal-prompt pattern from `BootSequence.tsx` (line 66) and `App.tsx` (line 14):
```typescript
<p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
  &gt; filter by tag
</p>
```

---

### `src/components/ArticleBody.tsx` — NEW (component, transform)

**Analog:** `src/components/ArticleCard.tsx` — renders untrusted `Article` data fields as React elements using terminal tokens.

**Import pattern** — new external packages; use default import for `react-markdown` (Pitfall 5):
```typescript
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
```
No `@/` alias imports needed — this component receives `content: string` and renders it.

**Props interface:**
```typescript
interface ArticleBodyProps {
  content: string
}
```

**Core render pattern** — `rehypeSanitize` in `rehypePlugins` (after remark), `remarkGfm` in `remarkPlugins`; `components` prop handles all styling and link behavior (no `rehype-raw`):
```typescript
export function ArticleBody({ content }: ArticleBodyProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        // All elements use terminal-* tokens from src/index.css @theme
        // Title rendered as styled span in AccordionTrigger; headings here are article body headings
        h1: ({ children }) => (
          <h1 className="crt-glow text-terminal-green font-mono text-lg font-bold mt-6 mb-3">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-terminal-green font-mono text-base font-semibold mt-5 mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-terminal-green-dim font-mono text-sm font-semibold mt-4 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="font-mono text-sm text-terminal-green-dim mb-3 leading-relaxed">{children}</p>
        ),
        // Code: inline uses terminal-amber for contrast; pre wraps in terminal-surface
        code: ({ children, className }) => (
          <code className={cn("font-mono text-terminal-amber bg-terminal-surface px-1 text-xs", className ?? '')}>
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-terminal-surface border border-terminal-border p-3 overflow-x-auto text-xs mb-3">
            {children}
          </pre>
        ),
        // Links: target="_blank" via React props (not schema extension) — see RESEARCH.md Pitfall 1
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
             className="text-terminal-green underline hover:text-terminal-amber">
            {children}
          </a>
        ),
        // Images: inline per D-05, constrained width, terminal border
        img: ({ src, alt }) => (
          <img src={src} alt={alt ?? ''} className="max-w-full h-auto my-3 border border-terminal-border" />
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-terminal-border pl-4 text-terminal-muted italic mb-3">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-terminal-green-dim text-sm mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-terminal-green-dim text-sm mb-3 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="font-mono">{children}</li>,
        hr: () => <hr className="border-terminal-border my-4" />,
        strong: ({ children }) => <strong className="text-terminal-green font-bold">{children}</strong>,
        em: ({ children }) => <em className="text-terminal-amber not-italic">{children}</em>,
        // Tables (remark-gfm extension)
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="font-mono text-xs border-collapse border border-terminal-border w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-terminal-border px-2 py-1 text-terminal-green text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-terminal-border px-2 py-1 text-terminal-green-dim">{children}</td>
        ),
      }}
    >
      {content}
    </Markdown>
  )
}
```

**Security note** (mandatory comment in file): `rehype-sanitize` with default schema strips `<script>`, event handlers, and `javascript:` hrefs. Do NOT add `rehype-raw` — explicitly forbidden by CLAUDE.md. The `components.a` override adds `target="_blank"` via React props after sanitization, not via schema extension.

**Token reference** — all `terminal-*` classes are defined in `src/index.css` lines 7–15 (`@theme inline` block). The `cn()` utility is from `@/lib/utils`.

---

### `src/lib/facets.ts` — NEW (utility, transform)

**Analog:** `src/lib/nostr.ts` (pure transform helpers over `Article[]`)

**Import pattern** (from `nostr.ts` lines 1–2):
```typescript
import type { Article } from "@/types/nostr"
```
No other imports needed — pure computation, no React, no nostr-tools.

**Module structure** — follow `nostr.ts` pattern: named exports only, no default export, pure functions with JSDoc:

```typescript
/**
 * Build the static facet list: tags sorted by article count desc, alphabetical tie-break.
 * Used for display order in FilterBar (D-06). Counts are over all articles (unfiltered).
 */
export function buildFacets(articles: Article[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    for (const tag of article.hashtags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Compute dynamic faceted counts (D-08).
 * OR mode: count of all articles carrying each tag (independent of current selection).
 * AND mode: count of articles that carry the tag AND all other currently-selected tags.
 * A selected tag always shows count >= 1 (never misleading zero) under these semantics.
 */
export function computeDynamicCounts(
  articles: Article[],
  selectedTags: Set<string>,
  matchMode: 'OR' | 'AND',
): Map<string, number> {
  const counts = new Map<string, number>()
  const allTags = new Set(articles.flatMap(a => a.hashtags))

  for (const tag of allTags) {
    if (matchMode === 'OR') {
      counts.set(tag, articles.filter(a => a.hashtags.includes(tag)).length)
    } else {
      const otherSelected = new Set([...selectedTags].filter(t => t !== tag))
      const base = otherSelected.size > 0
        ? articles.filter(a => [...otherSelected].every(t => a.hashtags.includes(t)))
        : articles
      counts.set(tag, base.filter(a => a.hashtags.includes(tag)).length)
    }
  }
  return counts
}
```

**Test file pattern** — follow `src/lib/nostr.test.ts` and `src/lib/formatTimestamp.test.ts` conventions: Vitest, named imports, plain `describe`/`it` blocks, no mocks needed (pure functions).

---

### `src/index.css` — MODIFY (config)

**Analog:** `src/index.css` itself (lines 1–125)

**Token section** (lines 6–42) — `@theme inline` block. No new tokens needed for Phase 4: all Markdown element styling uses the existing `terminal-*` tokens. The `ArticleBody` component uses `terminal-green`, `terminal-green-dim`, `terminal-amber`, `terminal-surface`, `terminal-border`, `terminal-muted` — all defined at lines 7–14.

**CRT helper classes** (lines 60–125) — `crt-glow`, `crt-scanlines`, `crt-flicker`, `cursor-blink`, `line-reveal`. These apply to the article body per D-04 (full CRT on body text). The `AccordionContent` wrapper can receive `crt-glow` class; the outer page `crt-scanlines crt-flicker` (line 11 of `App.tsx`) already covers the body.

**No new CSS rules needed** — all prose/Markdown styling is delivered via the `components` prop in `ArticleBody.tsx` using Tailwind utility classes. The `@theme inline` CSS-variable approach means terminal tokens are available to all Tailwind utilities without any additional CSS rules.

---

## Shared Patterns

### Terminal Token Usage
**Source:** `src/index.css` lines 7–14 (`@theme inline` block) + `src/components/ArticleCard.tsx` (all className values)
**Apply to:** `FilterBar.tsx`, `ArticleBody.tsx`, all className props in accordion anatomy

Available tokens: `text-terminal-green`, `text-terminal-green-dim`, `text-terminal-amber`, `text-terminal-muted`, `bg-terminal-bg`, `bg-terminal-surface`, `border-terminal-border`

CRT classes: `crt-glow` (phosphor text shadow), `crt-scanlines`, `crt-flicker` — applied at `AppShell` level, so all descendants inherit the effect.

### Path Alias Convention
**Source:** `src/components/ArticleCard.tsx` lines 1–6
**Apply to:** All new files
Always use `@/` alias for project-local imports (`@/components/`, `@/lib/`, `@/types/`). External packages use bare specifiers (`nostr-tools/nip19`, `react-markdown`, `remark-gfm`, `rehype-sanitize`).

### `cn()` Utility
**Source:** `src/lib/utils.ts` (lines 1–6) + every component file
**Apply to:** All new component files with conditional/merged classNames
```typescript
import { cn } from "@/lib/utils"
// Usage: className={cn("base-classes", conditionalClass && "extra")}
```

### Radix/shadcn Import Pattern
**Source:** `src/components/ui/avatar.tsx` line 2
```typescript
import { Avatar as AvatarPrimitive } from "radix-ui"
```
shadcn CLI scaffolds components using the unified `radix-ui` package (NOT `@radix-ui/react-*` sub-packages). Accordion, Checkbox, ToggleGroup scaffolded by `npx shadcn add` will follow this same pattern. Do not import from `@radix-ui/react-accordion` directly — use the generated `@/components/ui/accordion` wrapper.

### Terminal-Styled Interactive Button
**Source:** `src/App.tsx` lines 27–32 and 38–43
**Apply to:** "clear filters" button in App.tsx empty-filter state; "show more" toggle in FilterBar.tsx
```typescript
<button
  onClick={handler}
  className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
>
  &gt; {label}
</button>
```
The `> more (N)` show-more toggle in FilterBar uses a lighter variant (no border/padding) — `font-mono text-xs text-terminal-muted hover:text-terminal-green-dim cursor-pointer`.

### Set Mutation Guard
**Source:** RESEARCH.md Pitfall 6 — applies to all `setSelectedTags` call sites
**Apply to:** `FilterBar.tsx` `onCheckedChange`, `App.tsx` `onTagToggle` handler
Always create a new Set on update — never mutate the existing reference:
```typescript
setSelectedTags(prev => {
  const next = new Set(prev)
  if (next.has(tag)) next.delete(tag) else next.add(tag)
  return next
})
```

### useMemo Dependency Correctness
**Source:** `src/context/NostrContext.tsx` lines 24–26 (stable memo keyed on array identity)
**Apply to:** `filteredArticles`, `facets`, `dynamicCounts` memos in `App.tsx`
Use `[articles, selectedTags, matchMode]` as deps. `selectedTags` is a `Set` — the new-Set-on-update pattern above ensures reference changes correctly on every toggle, making the `useMemo` recompute as expected.

---

## No Analog Found

All files have analogs. No files require fallback to external patterns only.

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/`, `src/context/`, `src/index.css`
**Files scanned:** 13
**Pattern extraction date:** 2026-06-07
