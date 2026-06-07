# Phase 3: Article List - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 5 (3 new, 1 modified, 1 added via CLI)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ArticleList.tsx` | component | request-response (render) | `src/components/BootSequence.tsx` | role-match |
| `src/components/ArticleCard.tsx` | component | request-response (render) | `src/components/BootSequence.tsx` | role-match |
| `src/lib/formatTimestamp.ts` | utility | transform | `src/lib/nostr.ts` (pure helpers) | exact |
| `src/components/ui/avatar.tsx` | ui-component | — | Added via `npx shadcn add avatar` — do not hand-roll | external |
| `src/App.tsx` (modified) | component | event-driven (status branch) | `src/App.tsx` itself | exact (in-place edit) |

---

## Pattern Assignments

### `src/components/ArticleList.tsx` (component, render)

**Analog:** `src/components/BootSequence.tsx`

**Imports pattern** (BootSequence.tsx lines 1-3):
```typescript
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
```

For ArticleList, replace the hook imports with:
```typescript
import { useNostr } from "@/context/NostrContext"
import type { Article, Profile } from "@/types/nostr"
import { ArticleCard } from "@/components/ArticleCard"
```

**Core render pattern** (BootSequence.tsx lines 52-78 — map over array, apply terminal tokens):
```tsx
return (
  <Card
    className={cn(
      "border-terminal-border bg-terminal-surface w-full max-w-2xl",
      className
    )}
  >
    <CardContent className="p-6 font-mono text-sm leading-relaxed">
      {lines.slice(0, visibleCount).map((line, i) => (
        <div
          key={`${i}-${line}`}
          className="line-reveal crt-glow text-terminal-green whitespace-pre"
        >
          ...
        </div>
      ))}
    </CardContent>
  </Card>
)
```

ArticleList replaces the inner map body with `<ArticleCard>` components. The wrapping
container does NOT need to be a Card itself — use a plain `<div>` or `<ul>` so each
ArticleCard is its own Card.

**Streaming status line pattern** (D-02, adapt from App.tsx lines 10-14 header pattern):
```tsx
// Slim terminal header above the list — shown while status === 'streaming'
<header className="w-full max-w-2xl mb-6">
  <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
    &gt; streaming… {articles.length}/21 received
  </p>
</header>
```
Replace with a `done` line once `status !== 'streaming'`:
```tsx
<p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
  &gt; ready — {articles.length} articles loaded
</p>
```

**Key prop signature:**
```typescript
interface ArticleListProps {
  articles: Article[]
  profiles: Map<string, Profile>
  status: NostrStatus
}
```

---

### `src/components/ArticleCard.tsx` (component, render)

**Analog:** `src/components/BootSequence.tsx` (Card + CardContent + terminal tokens)
**Secondary analog:** `src/components/ui/card.tsx` (all named exports to compose from)
**Types source:** `src/types/nostr.ts` (Article + Profile shapes)

**Imports pattern:**
```typescript
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Article, Profile } from "@/types/nostr"
import { formatTimestamp } from "@/lib/formatTimestamp"
```

**Card terminal styling pattern** (BootSequence.tsx lines 53-58):
```tsx
<Card
  className={cn(
    "border-terminal-border bg-terminal-surface w-full max-w-2xl",
    className
  )}
>
  <CardContent className="p-6 font-mono text-sm leading-relaxed">
```

ArticleCard adapts this to a compact metadata row layout:
- Title: `text-terminal-green crt-glow font-semibold`
- Author row (avatar + name + timestamp): `text-terminal-green-dim text-xs`
- Timestamp: `text-terminal-muted`

**Title fallback (D-01, DISP-01)** — derive display title inline:
```typescript
// Inline in ArticleCard render, not extracted to a util
const displayTitle =
  article.title?.trim() ||
  article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80) ||
  "(untitled)"
```

**Avatar (D-04, D-05, D-06) — shadcn Avatar component:**
```tsx
// Avatar image gets CSS filter for green-tint (exact values: tune visually)
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
```

CSS filter chain for green tint: `grayscale(1) brightness(0.75) sepia(1) hue-rotate(90deg) saturate(2)` —
these are Tailwind utility classes (`grayscale brightness-75 sepia hue-rotate-90 saturate-200`).
Tune the exact values visually; the pattern is established here.

**Monogram fallback derivation:**
```typescript
import { npubEncode } from "nostr-tools/nip19"

function getMonogram(profile: Profile | undefined, pubkey: string): string {
  const name = profile?.displayName
  if (name) {
    const words = name.trim().split(/\s+/)
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  // Truncated npub fallback — nip19 subpath import (no barrel import)
  try {
    return npubEncode(pubkey).slice(0, 8)
  } catch {
    return pubkey.slice(0, 8)
  }
}
```

**Author name display (DISP-02 fallback chain):**
```typescript
const displayName =
  profile?.displayName ??
  (profile ? undefined : undefined) ??
  // No profile yet: show truncated npub
  npubEncode(pubkey).slice(0, 12) + "…"
```

**Prop signature:**
```typescript
interface ArticleCardProps {
  article: Article
  profile: Profile | undefined   // undefined while kind:0 not yet resolved
}
```

---

### `src/lib/formatTimestamp.ts` (utility, transform)

**Analog:** `src/lib/nostr.ts` — pure exported functions with no side effects, typed inputs/outputs.

**Pattern to copy** (nostr.ts lines 1-2, pure function structure):
```typescript
import type { Article, Profile } from "@/types/nostr"

export function parseArticle(event: Event): Article { ... }
```

**formatTimestamp implementation pattern** (D-07, D-08 — hand-rolled Intl, no date-fns):
```typescript
// src/lib/formatTimestamp.ts
// Input: ms epoch (Article.publishedAt is already ms)
// Output: "YYYY-MM-DD HH:MM" in UTC for log-line consistency

const _fmt = new Intl.DateTimeFormat("sv-SE", {
  // "sv-SE" locale naturally produces "YYYY-MM-DD HH:MM:SS" ISO-style output
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
})

export function formatTimestamp(ms: number): string {
  // Slice to "YYYY-MM-DD HH:MM" (drop the seconds)
  return _fmt.format(new Date(ms)).slice(0, 16)
}
```

Note: The `sv-SE` locale trick with `Intl.DateTimeFormat` produces the ISO-8601-like
format without manual zero-padding. The formatter instance is module-level (created once,
not per-call) — same singleton discipline as `src/lib/pool.ts`.

**Test file pattern** (follow `src/lib/nostr.test.ts` naming convention):
- Test file location: `src/lib/formatTimestamp.test.ts`
- Use Vitest (already in the project); import the function, test boundary values (Unix epoch 0, known date, ms vs seconds input guard).

---

### `src/components/ui/avatar.tsx` (ui-component)

**Source:** Added via `npx shadcn add avatar` — this is NOT hand-rolled.

**Add command:**
```bash
npx shadcn add avatar
```

This scaffolds `src/components/ui/avatar.tsx` with `Avatar`, `AvatarImage`, and
`AvatarFallback` components. The file follows the exact same pattern as
`src/components/ui/card.tsx`:

**Expected shape after add** (matches card.tsx pattern lines 1-16):
```typescript
import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
}
// ... AvatarImage, AvatarFallback follow same pattern
```

Do NOT write this file — run `npx shadcn add avatar` and let the CLI scaffold it. After
scaffolding, override the `rounded-full` default with `rounded-none` or `rounded-sm`
if the terminal aesthetic requires sharp corners (controlled via `--radius: 0rem` in index.css
which flows into shadcn tokens).

---

### `src/App.tsx` (modified — in-place edit)

**Analog:** `src/App.tsx` itself — this is a surgical modification to the existing branch logic.

**Current branch logic to replace** (App.tsx lines 17-46 — the full status switch):
```tsx
{status === "streaming" ? (
  <BootSequence />
) : status === "error" ? (
  <div className="font-mono text-sm">
    <p className="text-terminal-amber mb-4">
      [ERR] relay connection failed — all relays returned errors
    </p>
    <button
      onClick={refetch}
      className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
    >
      &gt; retry connection
    </button>
  </div>
) : status === "empty" ? (
  <div className="font-mono text-sm">
    <p className="text-terminal-muted mb-4">
      [EMPTY] relays responded but no articles found
    </p>
    <button
      onClick={refetch}
      className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
    >
      &gt; retry fetch
    </button>
  </div>
) : (
  <pre className="text-terminal-muted text-xs font-mono">
    {`status: ${status}\narticles: ${articles.length}`}
  </pre>
)}
```

**New branch logic (D-01, D-02):**
```tsx
// Phase 3: progressive boot-then-stream
// Boot screen only while streaming AND zero articles collected
{status === "streaming" && articles.length === 0 ? (
  <BootSequence />
) : status === "error" ? (
  // KEEP error branch exactly as-is (do not regress Phase 2 work)
  <div className="font-mono text-sm">
    <p className="text-terminal-amber mb-4">
      [ERR] relay connection failed — all relays returned errors
    </p>
    <button
      onClick={refetch}
      className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
    >
      &gt; retry connection
    </button>
  </div>
) : status === "empty" ? (
  // KEEP empty branch exactly as-is (do not regress Phase 2 work)
  <div className="font-mono text-sm">
    <p className="text-terminal-muted mb-4">
      [EMPTY] relays responded but no articles found
    </p>
    <button
      onClick={refetch}
      className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
    >
      &gt; retry fetch
    </button>
  </div>
) : (
  // articles.length > 0 (streaming with articles, or done)
  <ArticleList articles={articles} profiles={profiles} status={status} />
)}
```

**Import additions needed** (after line 3 of App.tsx):
```typescript
import { ArticleList } from "@/components/ArticleList"
```

The `profiles` value must also be destructured from `useNostr()` (line 7 of App.tsx):
```typescript
const { status, articles, profiles, refetch } = useNostr()
```

**Preserved unchanged:** The outer `<div>` with `crt-scanlines crt-flicker` (line 10),
the `<header>` block (lines 11-14), the `<footer>` block (lines 49-53). Only the `<main>`
content (the status branch) changes.

---

## Shared Patterns

### Terminal Card Styling
**Source:** `src/components/BootSequence.tsx` lines 53-59
**Apply to:** `ArticleList.tsx`, `ArticleCard.tsx`
```tsx
<Card className={cn("border-terminal-border bg-terminal-surface w-full", className)}>
  <CardContent className="p-6 font-mono text-sm leading-relaxed">
```

Override `bg-card` (the default) by using `bg-terminal-surface` explicitly — this ensures
article cards match the BootSequence surface, not shadcn's default card background.

### CRT Glow on Text
**Source:** `src/index.css` lines 61-66
**Apply to:** Title text in ArticleCard, status line in ArticleList
```tsx
className="crt-glow text-terminal-green"     // primary text (title)
className="crt-glow text-terminal-green-dim"  // secondary text (status line header)
```

### Terminal Color Token Reference
**Source:** `src/index.css` lines 7-15
**Apply to:** All new components

| Purpose | Token |
|---------|-------|
| Primary text | `text-terminal-green` |
| Secondary/dim | `text-terminal-green-dim` |
| Muted (timestamp) | `text-terminal-muted` |
| Amber (errors) | `text-terminal-amber` |
| Card border | `border-terminal-border` |
| Card surface | `bg-terminal-surface` |

### cn() Import
**Source:** `src/lib/utils.ts` lines 1-6 — every component uses this pattern:
**Apply to:** All new component files
```typescript
import { cn } from "@/lib/utils"
```

### Pure Helper Module Pattern
**Source:** `src/lib/nostr.ts` — module-level singletons, typed exports, no side-effects
**Apply to:** `src/lib/formatTimestamp.ts`

Pattern: single-responsibility module, formatter instance created at module level (not per-call), exported as named function.

### Nostr-Tools Subpath Imports
**Source:** `src/hooks/useArticleFetch.ts` line 3, `src/context/nostrReducer.ts` line 1
**Apply to:** Any file needing npubEncode
```typescript
import { npubEncode } from "nostr-tools/nip19"  // subpath import — not root barrel
```

### Context Consumption
**Source:** `src/context/NostrContext.tsx` lines 40-48
**Apply to:** `ArticleList.tsx` (reads articles + profiles + status from useNostr())
```typescript
const { status, articles, profiles } = useNostr()
```
Throw pattern: `if (!ctx) throw new Error("useNostr must be used inside <NostrProvider>")` —
already handled inside useNostr(); consumers just call the hook directly.

---

## No Analog Found

All Phase 3 files have close analogs in the existing codebase. No files require
falling back to RESEARCH.md patterns.

| File | Notes |
|------|-------|
| `src/lib/formatTimestamp.ts` | No existing date util — but the pure-helper module pattern from `src/lib/nostr.ts` is a complete structural analog. The `Intl.DateTimeFormat` API requires no new dependency. |

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/`, `src/context/`, `src/hooks/`, `src/types/`
**Files scanned:** 13 source files read
**Pattern extraction date:** 2026-06-07
