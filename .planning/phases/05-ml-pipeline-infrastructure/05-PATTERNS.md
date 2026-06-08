# Phase 5: ML Pipeline Infrastructure - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 10 (4 new, 4 modified, 2 new UI components implied by merged-in controls)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/workers/classifier.worker.ts` | worker | event-driven (postMessage) | `src/lib/pool.ts` (singleton) + `src/hooks/useArticleFetch.ts` (async collect pattern) | role-match (no existing worker) |
| `src/lib/classifierWorker.ts` | utility / singleton getter | request-response | `src/lib/pool.ts` | exact |
| `src/lib/languageDetect.ts` | utility | transform (sync) | `src/lib/facets.ts` (pure function, typed Article input) | role-match |
| `src/hooks/useClassification.ts` | hook | event-driven / streaming | `src/hooks/useArticleFetch.ts` (useEffect + dispatch pattern) | role-match |
| `src/types/nostr.ts` (modify) | model / type definitions | — | itself | exact (additive) |
| `src/App.tsx` (modify) | orchestrator | request-response / derived state | itself | exact (additive) |
| `vite.config.ts` (modify) | config | — | itself | exact (additive) |
| `src/components/FilterBar.tsx` (modify) | component | request-response | itself + shadcn `toggle.tsx` / `checkbox.tsx` | exact (extend) |
| `src/components/ContentFilterControls.tsx` (new) | component | request-response | `src/components/FilterBar.tsx` | role-match |
| `src/components/ui/` — new shadcn additions (`switch`, `slider`, `progress`, `badge`) | ui-primitive | — | existing `src/components/ui/checkbox.tsx`, `toggle-group.tsx` | shadcn-pattern |

---

## Pattern Assignments

### `src/lib/classifierWorker.ts` (utility, singleton getter)

**Analog:** `src/lib/pool.ts`

This is the highest-confidence match: identical reason (StrictMode safety), identical mechanism (module-level null-check, created once at module eval, never inside React).

**Full analog** (`src/lib/pool.ts`, lines 1–11):
```typescript
import { SimplePool } from "nostr-tools/pool"

export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
]

// Created ONCE at module evaluation time — never inside a React component or hook body
export const pool = new SimplePool()
```

**Pattern to copy:** Replace the exported constant with a lazy null-check getter — the Worker cannot be eagerly created at module load because `new Worker()` runs immediately and would fire in SSR/test contexts. Use the same module-level guard:

```typescript
// src/lib/classifierWorker.ts — mirrors pool.ts singleton pattern exactly
let _worker: Worker | null = null

// Created ONCE per page load — module-level guard is StrictMode-safe
// (second mount calls getClassifierWorker() and gets the existing instance)
export function getClassifierWorker(): Worker {
  if (!_worker) {
    // Use ?worker Vite import for full dependency bundling (PITFALLS.md — Vite worker)
    // The Worker is long-lived: terminating it would force re-downloading the ONNX model
    _worker = new Worker(
      new URL('../workers/classifier.worker.ts', import.meta.url),
      { type: 'module' }
    )
  }
  return _worker
}
```

**Key comment to preserve:** "Created ONCE at module evaluation time — never inside a React component or hook body" — adapt to the lazy-getter variant.

---

### `src/workers/classifier.worker.ts` (worker, event-driven)

**Analog:** `src/lib/pool.ts` (singleton pattern) + ARCHITECTURE.md Pattern 3 (ONNX pipeline singleton)

No direct worker-file analog exists. Mirror the pool.ts singleton pattern inside the Worker module: a module-level `let instance` variable, lazy-initialized on the first `onmessage` call.

**Singleton pattern from pool.ts** (lines 10–11):
```typescript
// Created ONCE at module evaluation time
export const pool = new SimplePool()
```

**Fail-open pattern from useArticleFetch.ts** (lines 39–46):
```typescript
// Idempotent via the `resolved` guard (CR-03)
const resolveStatus = (allError: boolean) => {
  if (resolved) return
  resolved = true
  frozen = true
  dispatch({
    type: "SET_STATUS",
    status: resolveArticleStatus(countRef.current, allError),
  })
}
```

**Pattern to implement:** Adapt both — class-static instance for the ONNX pipeline, `try/catch` on every inference call with fail-open `'error'` label reply:

```typescript
// src/workers/classifier.worker.ts
import { pipeline, env } from '@huggingface/transformers'

// GitHub Pages cannot set COOP/COEP headers → SharedArrayBuffer unavailable.
// numThreads=1 disables WASM threading. Must be set before any pipeline() call.
env.backends.onnx.wasm.numThreads = 1
env.allowLocalModels = false
// wasmPaths MUST be pinned to the exact onnxruntime-web version that
// @huggingface/transformers installs. Derive version from:
//   node_modules/onnxruntime-web/package.json → "version"
// Then set:
//   env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@<EXACT_VERSION>/dist/'

class SpamPipeline {
  static instance: ReturnType<typeof pipeline> | null = null

  static get(onProgress?: (x: unknown) => void) {
    this.instance ??= pipeline(
      'text-classification',
      'onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX',
      { dtype: 'q8', progress_callback: onProgress }
    )
    return this.instance
  }
}

self.addEventListener('message', async (e: MessageEvent<{ id: string; text: string }>) => {
  try {
    const classifier = await SpamPipeline.get((p) => self.postMessage({ type: 'progress', ...p }))
    const result = await (await classifier)(e.data.text)
    // Model labels: SPAM / NOT_SPAM (mrm8488/bert-tiny-finetuned-sms-spam-detection)
    const top = Array.isArray(result) ? result[0] : result
    self.postMessage({
      type: 'result',
      id: e.data.id,
      label: top.label === 'SPAM' ? 'spam' : 'ham',
      score: top.score ?? 0,
    })
  } catch {
    // Fail-open: worker error → article stays visible (mirrors useArticleFetch resolveStatus fail-open)
    self.postMessage({ type: 'result', id: e.data.id, label: 'error', score: 0 })
  }
})
```

---

### `src/lib/languageDetect.ts` (utility, sync transform)

**Analog:** `src/lib/facets.ts`

Both are pure functions: typed input, typed output, no side effects, no browser APIs, no React dependencies. The `buildFacets` export pattern is the closest structural analog.

**Imports and function signature pattern** (`src/lib/facets.ts`, lines 1–7):
```typescript
import type { Article } from "@/types/nostr"

/**
 * Build the static facet list: tags sorted by article count desc, alphabetical tie-break.
 * Used for display order in FilterBar (D-06). Counts are over all articles (unfiltered).
 */
export function buildFacets(articles: Article[]): { tag: string; count: number }[] {
```

**Pattern to copy:** Same JSDoc comment style (one-line summary + purpose note), named export (not default), typed input and return, `@/types/nostr` import path. Apply to `detectLanguage`:

```typescript
// src/lib/languageDetect.ts
import { francAll } from 'franc-min'

export type LanguageResult = 'english' | 'non-english' | 'undetermined'

// Minimum chars of stripped text required for reliable franc detection.
// Below this threshold → 'undetermined' (fail-open, article shown).
const MIN_DETECT_CHARS = 200
const MIN_CONFIDENCE = 0.75

/**
 * Detect article language using franc-min. Strips code blocks and hex-only
 * lines before detection to avoid mis-flagging code-heavy Nostr articles
 * (PITFALLS.md Pitfall 4). 'undetermined' and low-confidence results are
 * treated as English (fail-open per D-03).
 */
export function detectLanguage(text: string): LanguageResult {
  const stripped = stripNonNatural(text)
  if (stripped.length < MIN_DETECT_CHARS) return 'undetermined'
  const results = francAll(stripped, { minLength: 20 })
  const top = results[0]
  if (!top || top[1] < MIN_CONFIDENCE) return 'undetermined'
  return top[0] === 'eng' ? 'english' : 'non-english'
}

function stripNonNatural(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')          // strip triple-backtick code blocks
    .replace(/^[0-9a-f]{32,}\s*$/gim, '')    // strip hex-only lines (pubkeys, txids)
    .replace(/https?:\/\/\S+/g, '')          // strip URLs
    .trim()
}
```

---

### `src/hooks/useClassification.ts` (hook, event-driven/streaming)

**Analog:** `src/hooks/useArticleFetch.ts`

The closest structural match: a `useEffect` that opens a long-lived async resource, collects results via callbacks, and cleans up on unmount. The `useRef` for the live-value ref pattern (`countRef`) is directly reused for the classification Map.

**useRef live-value pattern** (`src/hooks/useArticleFetch.ts`, lines 20–21):
```typescript
const countRef = useRef(articleCount)
countRef.current = articleCount
```

**Effect with cleanup** (`src/hooks/useArticleFetch.ts`, lines 24–95):
```typescript
useEffect(() => {
  // ... setup ...
  return () => {
    clearTimeout(timer)
    sub.close("effect cleanup")
    frozen = true
    resolved = true
  }
}, [fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps
```

**Import pattern** (`src/hooks/useArticleFetch.ts`, lines 1–7):
```typescript
import { useEffect, useRef } from "react"
import type { Dispatch } from "react"
import { LongFormArticle } from "nostr-tools/kinds"
import { pool, RELAYS } from "@/lib/pool"
import { classifyRelayClose, resolveArticleStatus } from "@/lib/nostr"
import type { NostrAction } from "@/context/NostrContext"
import type { RelayOutcome } from "@/types/nostr"
```

**Pattern to copy for useClassification:**

```typescript
// src/hooks/useClassification.ts
import { useEffect, useRef, useState } from "react"
import type { Article } from "@/types/nostr"
import type { ClassificationLabel } from "@/types/nostr"
import { getClassifierWorker } from "@/lib/classifierWorker"
import { detectLanguage } from "@/lib/languageDetect"

// Conservative threshold — SMS-trained model domain-shifts on Bitcoin/Nostr corpus.
// ~60% accuracy on out-of-domain text at 0.50; raise to 0.90 to avoid false positives.
// Pin this value after the D-04 validation run against live relays.
const SPAM_THRESHOLD = 0.90

// Articles shorter than this word count bypass spam inference entirely.
// Short texts are where domain shift is worst; fail-open is safer.
const MIN_WORDS_FOR_SPAM = 100

export function useClassification(articles: Article[]) {
  const resultsRef = useRef<Map<string, ClassificationLabel>>(new Map())
  const [version, setVersion] = useState(0)

  // Register worker message handler once — worker singleton lives for page lifetime
  useEffect(() => {
    const worker = getClassifierWorker()
    const handle = (e: MessageEvent) => {
      if (e.data.type !== 'result') return
      resultsRef.current.set(e.data.id, e.data.label)
      setVersion(v => v + 1)
    }
    worker.addEventListener('message', handle)
    return () => worker.removeEventListener('message', handle)
  }, []) // runs once — mirrors pool.ts "never recreate" rule

  // Classify newly-seen articles
  useEffect(() => {
    const worker = getClassifierWorker()
    for (const article of articles) {
      if (resultsRef.current.has(article.id)) continue  // already classified (cache hit)

      const bodyText = `${article.title ?? ''} ${article.content.slice(0, 400)}`
      const lang = detectLanguage(bodyText)
      if (lang === 'non-english') {
        resultsRef.current.set(article.id, 'non-english')
        continue
      }

      const wordCount = article.content.trim().split(/\s+/).length
      if (wordCount < MIN_WORDS_FOR_SPAM) {
        // Below length gate — hide outright (D-05/D-06: always on, not ML)
        resultsRef.current.set(article.id, 'short')
        continue
      }

      // Mark pending; dispatch to ONNX worker
      resultsRef.current.set(article.id, 'pending')
      worker.postMessage({ id: article.id, text: article.content.slice(0, 512) })
    }
    setVersion(v => v + 1)
  }, [articles])

  return {
    map: resultsRef.current,
    version,
    spamThreshold: SPAM_THRESHOLD,
  }
}
```

---

### `src/types/nostr.ts` (modify — additive)

**Analog:** itself (lines 1–24 — existing type definitions)

**Existing file** (`src/types/nostr.ts`, full):
```typescript
export type NostrStatus = 'streaming' | 'done' | 'empty' | 'error'

export type RelayOutcome = 'pending' | 'clean' | 'error'

export type Article = {
  id: string
  pubkey: string
  coordinate: string       // "30023:pubkey:d"
  d: string                // d-tag value
  title: string | undefined
  summary: string | undefined
  image: string | undefined
  publishedAt: number      // ms epoch (from published_at or created_at)
  createdAt: number        // ms epoch (event.created_at × 1000)
  content: string          // raw Markdown body
  hashtags: string[]       // lowercased t-tag values
}

export type Profile = {
  pubkey: string
  displayName: string | undefined
  picture: string | undefined
  createdAt: number        // Unix seconds (for newest-profile tracking)
}
```

**Pattern: append** (do not restructure existing types). Add after the Profile type:

```typescript
// Classification labels for ML content filtering (Phase 5).
// 'pending'      — dispatched to worker, awaiting result (fail-open: show)
// 'ham'          — classified as not-spam (show)
// 'non-english'  — franc-min detected confident non-English (hide)
// 'short'        — below 500-word length gate, always on (hide, D-05/D-06)
// 'spam'         — ONNX score >= SPAM_THRESHOLD (hide)
// 'error'        — worker threw or model failed (fail-open: show)
export type ClassificationLabel =
  | 'pending'
  | 'ham'
  | 'non-english'
  | 'short'
  | 'spam'
  | 'error'

// Helper: returns true if an article with this label should be hidden.
// Explicit hide set — everything else (undefined, pending, ham, error) shows.
export function isHidden(label: ClassificationLabel | undefined): boolean {
  return label === 'spam' || label === 'non-english' || label === 'short'
}
```

Note: `'short'` is added to the union beyond what CONTEXT.md specified, because D-05's length gate produces a distinct hide-reason separate from ML spam. The planner should confirm this label name.

---

### `src/App.tsx` (modify — additive)

**Analog:** itself (full file, read above)

**Integration seam** (`src/App.tsx`, lines 20–41 — the memo pipeline):
```typescript
// Derived: reply-sorted articles — applied BEFORE faceting and filtering so the
// entire pipeline operates on the engagement-ranked list
const sortedArticles = useMemo(
  () => sortArticlesByReplies(articles, replyCounts),
  [articles, replyCounts]
)

// Derived: static facet list for display order (D-06)
const facets = useMemo(() => buildFacets(sortedArticles), [sortedArticles])

// Derived: dynamic counts per tag (D-08)
const dynamicCounts = useMemo(
  () => computeDynamicCounts(sortedArticles, selectedTags, matchMode),
  [sortedArticles, selectedTags, matchMode]
)

// Derived: filtered article list (D-10 — filter is source of truth)
const filteredArticles = useMemo(
  () => filterArticles(sortedArticles, selectedTags, matchMode),
  [sortedArticles, selectedTags, matchMode]
)
```

**Local UI state pattern** (`src/App.tsx`, lines 14–15):
```typescript
const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR') // D-09: default OR
```

**Pattern to insert in App.tsx:**

1. Add imports: `useClassification` from `@/hooks/useClassification`, `isHidden` from `@/types/nostr`.

2. Add ML filter UI state alongside existing local state (lines 14–15):
```typescript
// ML filter local state — no Zustand (D-11 pattern from Phase 2)
const [filterEnabled, setFilterEnabled] = useState<boolean>(() => {
  return localStorage.getItem('soveng:ml-filter-enabled') !== 'false'
})
const [spamThreshold, setSpamThreshold] = useState(0.90)
```

3. Insert `visibleArticles` memo BETWEEN `sortedArticles` (line 23) and `facets` (line 26):
```typescript
// Phase 5: ML classification — mirrors the countRef pattern from useArticleFetch
const { map: classificationMap, version: classificationVersion } =
  useClassification(sortedArticles)

// Derived: ML-filtered article list — the single insertion point for all content
// filtering. Facets and downstream memos switch from sortedArticles to visibleArticles.
// fail-open: undefined/pending/ham/error → show; spam/non-english/short → hide
const visibleArticles = useMemo(() => {
  if (!filterEnabled) {
    // Filter toggle OFF: show all except always-on length gate (D-06)
    return sortedArticles.filter(a => classificationMap.get(a.id) !== 'short')
  }
  return sortedArticles.filter(a => !isHidden(classificationMap.get(a.id)))
}, [sortedArticles, classificationVersion, filterEnabled])
// classificationVersion increments on each worker result → memo re-evaluates
```

4. Update all three downstream memos to use `visibleArticles` instead of `sortedArticles` — one-word change per memo, preserving exact structure:
```typescript
const facets = useMemo(() => buildFacets(visibleArticles), [visibleArticles])
const dynamicCounts = useMemo(
  () => computeDynamicCounts(visibleArticles, selectedTags, matchMode),
  [visibleArticles, selectedTags, matchMode]
)
const filteredArticles = useMemo(
  () => filterArticles(visibleArticles, selectedTags, matchMode),
  [visibleArticles, selectedTags, matchMode]
)
```

5. Thread `filterEnabled`, `setFilterEnabled`, `spamThreshold`, `setSpamThreshold`, `classificationMap`, and `classificationVersion` as props to `FilterBar` (or the new `ContentFilterControls` component placed alongside `FilterBar`).

---

### `vite.config.ts` (modify — additive)

**Analog:** itself (lines 1–17)

**Existing file:**
```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/soveng/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "build",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**Pattern: add two keys** inside `defineConfig({})`, preserving all existing fields:
```typescript
  // v1.1: prevent Vite esbuild pre-bundler from parsing ONNX/WASM imports
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  // v1.1: workers must be ES modules for dynamic import() inside them
  worker: {
    format: 'es',
  },
```

---

### `src/components/FilterBar.tsx` (modify — extend) and `src/components/ContentFilterControls.tsx` (new)

**Analog:** `src/components/FilterBar.tsx` (full file, read above)

**Existing shadcn component usage pattern** (`src/components/FilterBar.tsx`, lines 1–4):
```typescript
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
```

**Terminal styling pattern** (`src/components/FilterBar.tsx`, lines 30–31):
```typescript
<div className="sticky top-0 z-20 bg-terminal-bg border-b border-terminal-border py-2 px-0 mb-4">
  <div className="flex items-center justify-between mb-2">
```

**shadcn component class pattern for interactive elements** (`src/components/FilterBar.tsx`, lines 44–51):
```typescript
<ToggleGroupItem
  value="or"
  className="px-3 py-1 text-xs font-mono rounded-none data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green"
>
  Match ANY
</ToggleGroupItem>
```

**Label + count pattern** (`src/components/FilterBar.tsx`, lines 68–74):
```typescript
<label
  htmlFor={`tag-${tag}`}
  className="font-mono text-xs text-terminal-green-dim cursor-pointer select-none"
>
  #{tag}
  <span className="ml-1 text-terminal-muted">({dynamicCounts.get(tag) ?? 0})</span>
</label>
```

**Pattern for new ContentFilterControls component:** Mirror the FilterBar structure — typed props interface, shadcn-only components, terminal Tailwind tokens, `font-mono text-xs`, `rounded-none`, `border-terminal-border`. New shadcn components needed:

- `Switch` (for filter toggle CTRL-04) — `npx shadcn add switch`
- `Slider` (for spam threshold CTRL-05) — `npx shadcn add slider`
- `Progress` (for model download CTRL-02) — `npx shadcn add progress`
- `Badge` (for filtered count CTRL-03) — `npx shadcn add badge`

```typescript
// src/components/ContentFilterControls.tsx
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ContentFilterControlsProps {
  filterEnabled: boolean
  onFilterEnabledChange: (enabled: boolean) => void
  spamThreshold: number
  onSpamThresholdChange: (threshold: number) => void
  filteredCount: number         // articles hidden by ML filter
  downloadProgress: number | null  // 0-100, null if not downloading
  modelFailed: boolean
}

export function ContentFilterControls({
  filterEnabled,
  onFilterEnabledChange,
  spamThreshold,
  onSpamThresholdChange,
  filteredCount,
  downloadProgress,
  modelFailed,
}: ContentFilterControlsProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-terminal-border py-2 mb-2">
      {/* Row 1: toggle + filtered count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={filterEnabled}
            onCheckedChange={onFilterEnabledChange}
            className="data-[state=checked]:bg-terminal-green"
          />
          <span className="font-mono text-xs text-terminal-green-dim">content filter</span>
        </div>
        {filteredCount > 0 && filterEnabled && (
          <Badge
            variant="outline"
            className="font-mono text-xs rounded-none border-terminal-border text-terminal-muted"
          >
            {filteredCount} hidden
          </Badge>
        )}
      </div>
      {/* Row 2: spam threshold slider (only when filter on) */}
      {filterEnabled && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-terminal-muted w-24">spam gate</span>
          <Slider
            min={50}
            max={99}
            step={1}
            value={[Math.round(spamThreshold * 100)]}
            onValueChange={([v]) => onSpamThresholdChange(v / 100)}
            className="flex-1"
          />
          <span className="font-mono text-xs text-terminal-muted w-10 text-right">
            {Math.round(spamThreshold * 100)}%
          </span>
        </div>
      )}
      {/* Row 3: model download progress */}
      {downloadProgress !== null && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-terminal-muted">loading model</span>
          <Progress value={downloadProgress} className="flex-1 h-1" />
          <span className="font-mono text-xs text-terminal-muted">{downloadProgress}%</span>
        </div>
      )}
      {/* Row 4: model failure notice (non-blocking) */}
      {modelFailed && (
        <p className="font-mono text-xs text-terminal-amber">
          [WARN] content filter unavailable — all articles shown
        </p>
      )}
    </div>
  )
}
```

---

## Shared Patterns

### Module-Level Singleton (no React state)
**Source:** `src/lib/pool.ts` lines 10–11
**Apply to:** `src/lib/classifierWorker.ts`, `src/workers/classifier.worker.ts` (SpamPipeline class)
```typescript
// Created ONCE at module evaluation time — never inside a React component or hook body
export const pool = new SimplePool()
```
The Worker equivalent uses a lazy null-check getter (same intent, deferred instantiation).

### useRef for Mutable Values That Must Survive Re-renders
**Source:** `src/hooks/useArticleFetch.ts` lines 20–21
**Apply to:** `src/hooks/useClassification.ts` (the classification Map)
```typescript
const countRef = useRef(articleCount)
countRef.current = articleCount
```
In useClassification: `resultsRef = useRef(new Map())` — Map is mutated in place; version counter triggers re-renders.

### useEffect Cleanup Pattern
**Source:** `src/hooks/useArticleFetch.ts` lines 87–95
**Apply to:** `src/hooks/useClassification.ts`
```typescript
return () => {
  clearTimeout(timer)
  sub.close("effect cleanup")
  frozen = true
  resolved = true
}
```
In useClassification: remove the `message` event listener in cleanup (never terminate the Worker — mirrors "never close the pool" rule).

### Derived State via useMemo (never stored in reducer)
**Source:** `src/App.tsx` lines 20–41
**Apply to:** `visibleArticles` insertion in `src/App.tsx`
```typescript
const sortedArticles = useMemo(
  () => sortArticlesByReplies(articles, replyCounts),
  [articles, replyCounts]
)
```
`visibleArticles` inserts between `sortedArticles` and the three downstream memos — same useMemo shape, explicit `[sortedArticles, classificationVersion]` dependency list.

### Terminal Styling Tokens
**Source:** `src/index.css` lines 6–42 and `src/components/FilterBar.tsx` lines 30–86
**Apply to:** `src/components/ContentFilterControls.tsx` and any new shadcn additions
```
font-mono text-xs           // all label/status text
text-terminal-green-dim     // secondary labels
text-terminal-muted         // counts, status notes
text-terminal-amber         // warnings/errors (used in App.tsx error state)
border-terminal-border      // all borders
rounded-none                // zero radius throughout (terminal aesthetic)
bg-terminal-surface         // active/selected state backgrounds
data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green  // shadcn state styling
```

### Fail-Open Operator
**Source:** `src/hooks/useArticleFetch.ts` lines 39–46 (resolveStatus never panics)
**Apply to:** `src/workers/classifier.worker.ts` catch block, `useClassification` language gate, `visibleArticles` filter
```typescript
// In visibleArticles useMemo:
// fail-open: undefined/pending/ham/error → show; spam/non-english/short → hide
return label !== 'spam' && label !== 'non-english' && label !== 'short'
```
The explicit-hide allowlist (only 3 values hide) is safer than an explicit-show allowlist.

### localStorage Persistence for UI Toggle State
**Source:** Phase 4 pattern (per CONTEXT.md § "Phase 4 established patterns") — not yet present in codebase for toggles, but the pattern is the standard React lazy-initializer:
```typescript
// Mirrors the "local UI state — NOT in NostrContext" pattern from App.tsx lines 14-15
const [filterEnabled, setFilterEnabled] = useState<boolean>(() => {
  return localStorage.getItem('soveng:ml-filter-enabled') !== 'false'
})
// Persist on change:
useEffect(() => {
  localStorage.setItem('soveng:ml-filter-enabled', String(filterEnabled))
}, [filterEnabled])
```

### @/ Alias Imports
**Source:** Every existing file in `src/`
**Apply to:** All new files
```typescript
import type { Article } from "@/types/nostr"
import { getClassifierWorker } from "@/lib/classifierWorker"
import { detectLanguage } from "@/lib/languageDetect"
```
Never use relative `../` paths from within `src/`. Exception: `src/lib/classifierWorker.ts` uses `new URL('../workers/classifier.worker.ts', import.meta.url)` because Vite's worker URL resolution requires a relative path for the `new URL()` pattern.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/workers/classifier.worker.ts` | worker | event-driven | No worker files exist in the codebase. Partial analog from pool.ts singleton + useArticleFetch fail-open. ARCHITECTURE.md Pattern 3 provides the ONNX-specific template. |

---

## shadcn Components to Install Before Planning/Implementation

Run these before implementing `ContentFilterControls`:
```bash
npx shadcn add switch
npx shadcn add slider
npx shadcn add progress
npx shadcn add badge
```

Currently installed (in `src/components/ui/`): `accordion`, `avatar`, `card`, `checkbox`, `toggle-group`, `toggle`.

---

## Implementation-Time Derivations (Cannot Be Pre-Committed)

These two values must be resolved at implementation time, not pre-specified here:

1. **`wasmPaths` CDN version pin** — run `cat node_modules/onnxruntime-web/package.json | grep '"version"'` after `npm install @huggingface/transformers`. The CDN URL in `classifier.worker.ts` must match this exact version.

2. **`SPAM_THRESHOLD` final value** — start at `0.90` per D-02, then pin after the D-04 validation run (dev-console score logging against 20+ live Nostr articles). The constant lives in `useClassification.ts` with a comment referencing this derivation.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/hooks/`, `src/components/`, `src/context/`, `src/types/`, `vite.config.ts`, `src/index.css`
**Files scanned:** 10 source files read in full
**Pattern extraction date:** 2026-06-08
