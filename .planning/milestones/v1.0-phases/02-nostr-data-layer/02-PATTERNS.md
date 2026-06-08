# Phase 2: Nostr Data Layer - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 7 new/modified files
**Analogs found:** 5 / 7 (2 have no close codebase analog — use RESEARCH.md patterns)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/pool.ts` | utility/singleton | event-driven | `src/lib/utils.ts` | partial (same lib/ role; different purpose) |
| `src/lib/nostr.ts` | utility/transform | transform | `src/lib/utils.ts` | role-match |
| `src/types/nostr.ts` | types/config | — | `src/vite-env.d.ts` | weak (both are type-only files) |
| `src/context/NostrContext.tsx` | provider/store | event-driven | `src/components/BootSequence.tsx` | partial (same hook+state pattern; different role) |
| `src/hooks/useArticleFetch.ts` | hook | event-driven | `src/components/BootSequence.tsx` | partial (same useEffect+timer+cleanup pattern) |
| `src/hooks/useProfileFetch.ts` | hook | event-driven | `src/components/BootSequence.tsx` | partial (same useEffect+cleanup pattern) |
| `src/App.tsx` | component | request-response | `src/App.tsx` (self — modify) | exact |

---

## Pattern Assignments

### `src/lib/pool.ts` (utility/singleton, event-driven)

**Analog:** `src/lib/utils.ts`

The project's only existing `lib/` file is a pure utility with a named export and no side effects. `pool.ts` follows the same file structure but exports a side-effectful singleton. The key convention to carry forward is the named export (no default export) and the `@/` path alias.

**Import pattern** (`src/lib/utils.ts` lines 1-2):
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
```

Translates to — use subpath imports, not root barrel:
```typescript
// src/lib/pool.ts — module-level singleton (NEVER inside a component/hook)
import { SimplePool } from 'nostr-tools/pool'
```

**Named export pattern** (`src/lib/utils.ts` lines 4-6):
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Translates to — named exports, no default export:
```typescript
export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
]

// Created ONCE at module evaluation time — never inside React state or useEffect
export const pool = new SimplePool()
```

**Critical constraint:** `nostr-tools` is NOT yet installed. The planner must add `npm install nostr-tools` as the first action before any import from `nostr-tools/*` can compile. Subpath imports (`nostr-tools/pool`, `nostr-tools/kinds`, `nostr-tools/nip19`) are mandatory per CLAUDE.md — the root barrel `import { ... } from 'nostr-tools'` defeats tree-shaking.

---

### `src/lib/nostr.ts` (utility/transform, transform)

**Analog:** `src/lib/utils.ts`

Pure functions, no React, named exports. Same `lib/` role.

**File layout pattern** (`src/lib/utils.ts` lines 1-6 — entire file):
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Translates to:
```typescript
// src/lib/nostr.ts
import type { Event } from 'nostr-tools/core'
import type { Article, Profile } from '@/types/nostr'

export function articleCoordinate(event: Event): string { ... }
export function parseArticle(event: Event): Article { ... }
export function parseProfile(event: Event): Profile { ... }
export function classifyRelayClose(reason: string): 'clean' | 'error' { ... }
```

All functions are pure transforms (no side effects, no async). Import types via `import type` per TypeScript strict mode. Use `@/types/nostr` path alias (same `@/*` → `./src/*` alias as the rest of the codebase — see `tsconfig.app.json` lines 26-28).

**Error handling pattern** — `parseProfile` needs a `try/catch` around `JSON.parse` (RESEARCH.md Pattern 7, security requirement):
```typescript
export function parseProfile(event: Event): Profile {
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(event.content)
  } catch {
    // Malformed JSON — fall through to empty object; all fields get undefined fallbacks
  }
  // ... extract fields with optional-chaining fallbacks
}
```

---

### `src/types/nostr.ts` (types, —)

**Analog:** `src/vite-env.d.ts` (weak — both are type-only declaration files)

No runtime code. Export all types as named type exports (not `export default`). The codebase uses `import type { ... }` for type-only imports in strict mode.

**Convention:** TypeScript strict mode is enabled (`"strict": true` in `tsconfig.app.json` line 20). All optional fields must be typed `T | undefined`, never left implicit.

```typescript
// src/types/nostr.ts — all named type exports
export type NostrStatus = 'streaming' | 'done' | 'empty' | 'error'
export type RelayOutcome = 'pending' | 'clean' | 'error'
export type Article = { ... }
export type Profile = { ... }
```

No analog in codebase for a domain types file — planner uses RESEARCH.md `## Code Examples / Complete TypeScript Types` as the authoritative shape definition.

---

### `src/context/NostrContext.tsx` (provider, event-driven)

**Analog:** `src/components/BootSequence.tsx`

This is the closest analog for React hooks + state + `useEffect` patterns in the existing codebase. `BootSequence.tsx` demonstrates the project's conventions for: file extension (`.tsx` for JSX-containing files), named exports (not default), `useEffect` with cleanup, `useState` for local state.

**Import pattern** (`src/components/BootSequence.tsx` lines 1-3):
```typescript
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
```

Translates to — same import ordering (React first, then `@/` aliases):
```typescript
import { createContext, useCallback, useContext, useMemo, useReducer } from "react"
import type { ReactNode } from "react"
import type { Article, NostrStatus, Profile } from '@/types/nostr'
import { useArticleFetch } from '@/hooks/useArticleFetch'
import { useProfileFetch } from '@/hooks/useProfileFetch'
```

**Named export pattern** (`src/components/BootSequence.tsx` line 24):
```typescript
export function BootSequence({ lines = DEFAULT_LINES, lineDelay = 180, className }: BootSequenceProps) {
```

Translates to — named exports for both provider and hook:
```typescript
export function NostrProvider({ children }: { children: ReactNode }) { ... }
export function useNostr() { ... }
```

**`useEffect` with cleanup pattern** (`src/components/BootSequence.tsx` lines 39-50):
```typescript
useEffect(() => {
  if (visibleCount < lines.length) {
    const timer = setTimeout(() => {
      setVisibleCount((n) => n + 1)
    }, lineDelay)
    return () => clearTimeout(timer)  // cleanup pattern
  } else {
    const timer = setTimeout(() => setDone(true), 400)
    return () => clearTimeout(timer)
  }
}, [visibleCount, lines, lineDelay])
```

This cleanup-return pattern is the model for all `useEffect` cleanups in new hooks: always return a cleanup function that closes subscriptions/timers.

**Context null-guard pattern** (no existing analog — use RESEARCH.md Pattern 6):
```typescript
export function useNostr() {
  const ctx = useContext(NostrContext)
  if (!ctx) throw new Error('useNostr must be used inside <NostrProvider>')
  return ctx
}
```

**File is `.tsx`** because it returns JSX (`<NostrContext.Provider>`). Hooks-only files use `.ts`.

---

### `src/hooks/useArticleFetch.ts` (hook, event-driven)

**Analog:** `src/components/BootSequence.tsx`

The `useEffect`-with-timer-and-cleanup pattern in `BootSequence.tsx` is the direct model. The hook pattern itself has no standalone hook file in the codebase yet — this is the first.

**Hook file extension:** `.ts` (not `.tsx`) — no JSX returned, pure logic. Follows TypeScript strict mode conventions.

**`useEffect` with timer cleanup** (`src/components/BootSequence.tsx` lines 39-50):
```typescript
useEffect(() => {
  // ... setup
  const timer = setTimeout(() => { ... }, lineDelay)
  return () => clearTimeout(timer)  // always clean up
}, [dependency])
```

Translates to — article fetch hook:
```typescript
// src/hooks/useArticleFetch.ts
import { useEffect, useRef } from "react"
import { LongFormArticle } from 'nostr-tools/kinds'
import { pool, RELAYS } from '@/lib/pool'
import { parseArticle, articleCoordinate, classifyRelayClose } from '@/lib/nostr'
import type { NostrAction } from '@/context/NostrContext'  // or from types/

export function useArticleFetch(
  fetchKey: number,
  dispatch: React.Dispatch<NostrAction>,
  articleCount: number
) {
  useEffect(() => {
    // ... subscription setup
    const sub = pool.subscribeMany(RELAYS, filter, { onevent, onclose, maxWait: 8000 })
    const timer = setTimeout(() => { sub.close('backstop timer fired') }, 9000)
    return () => {
      clearTimeout(timer)
      sub.close('effect cleanup')
    }
  }, [fetchKey])  // re-runs on refetch()
}
```

**`useRef` for mutable non-state** — BootSequence uses only `useState`. The hook needs `useRef` for the `subRef` (to call `sub.close()` from a freeze watcher) and for the `frozen` flag. No codebase analog exists for `useRef`; follow React docs convention.

---

### `src/hooks/useProfileFetch.ts` (hook, event-driven)

**Analog:** `src/components/BootSequence.tsx` (same useEffect+cleanup pattern)

Simpler than `useArticleFetch.ts` — no freeze guard, no status resolution.

**File extension:** `.ts` (no JSX).

**Import pattern** (same `@/` alias convention):
```typescript
import { useEffect } from "react"
import { Metadata } from 'nostr-tools/kinds'
import { pool, RELAYS } from '@/lib/pool'
import { parseProfile } from '@/lib/nostr'
import type { NostrAction } from '@/context/NostrContext'
```

**`useEffect` with early-return guard** — modeled on BootSequence's conditional effect pattern (`src/components/BootSequence.tsx` line 40: `if (visibleCount < lines.length)`):
```typescript
useEffect(() => {
  if (pubkeys.length === 0) return  // early-return guard — no cleanup needed
  const sub = pool.subscribeMany(RELAYS, { kinds: [Metadata], authors: pubkeys }, {
    onevent(event) { dispatch({ type: 'PROFILE_RECEIVED', event }) },
    maxWait: 5000,
  })
  return () => { sub.close('profile effect cleanup') }
}, [pubkeys.join(',')])  // stable string dependency; re-fires only if pubkey set changes
```

---

### `src/App.tsx` (component, request-response) — MODIFY

**Analog:** `src/App.tsx` (self — this file is being modified)

**Current file** (`src/App.tsx` lines 1-23 — entire file):
```typescript
import { BootSequence } from "@/components/BootSequence"

function App() {
  return (
    <div className="crt-scanlines crt-flicker min-h-screen bg-terminal-bg flex flex-col items-center justify-center p-8">
      <header className="w-full max-w-2xl mb-6">
        <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
          soveng // nostr long-form reader
        </p>
      </header>
      <main className="w-full max-w-2xl">
        <BootSequence />
      </main>
      <footer className="w-full max-w-2xl mt-6">
        <p className="text-terminal-muted text-xs">
          powered by nostr · built with react + vite · zero backend
        </p>
      </footer>
    </div>
  )
}

export default App
```

**Modification:** Wrap `<App>` render output with `<NostrProvider>` and wire `useNostr()` to pass `status` to `<BootSequence>`. The `default export` convention stays. Terminal class tokens (`crt-scanlines`, `crt-flicker`, `bg-terminal-bg`, `text-terminal-green-dim`, `crt-glow`, `text-terminal-muted`) are all preserved — no new CSS tokens in Phase 2.

**Provider wrapping convention** — the provider belongs either in `App.tsx` (wrapping the return) or in `main.tsx`. The existing `main.tsx` already wraps with `<StrictMode>`. Wrapping in `App.tsx` keeps `main.tsx` minimal:

```typescript
// src/App.tsx (after modification)
import { NostrProvider } from "@/context/NostrContext"
import { AppShell } from "@/components/AppShell"  // or inline

export default function App() {
  return (
    <NostrProvider>
      {/* existing div + header + main + footer */}
    </NostrProvider>
  )
}
```

---

## Shared Patterns

### Path Alias Convention
**Source:** `tsconfig.app.json` lines 26-28 + all existing source files
**Apply to:** All new files
```json
"paths": {
  "@/*": ["./src/*"]
}
```
All intra-project imports use `@/` prefix: `@/lib/pool`, `@/types/nostr`, `@/context/NostrContext`, `@/hooks/useArticleFetch`. Never use relative `../` paths.

### Named Export Convention (no default exports except App)
**Source:** `src/lib/utils.ts` line 4, `src/components/BootSequence.tsx` line 24, `src/components/ui/card.tsx` line 84
**Apply to:** All new files except `App.tsx` (which keeps `export default`)
```typescript
// All new modules use named exports:
export function useNostr() { ... }
export function NostrProvider(...) { ... }
export const pool = new SimplePool()
export type Article = { ... }
```

### Import Ordering Convention
**Source:** `src/components/BootSequence.tsx` lines 1-3
**Apply to:** All new `.ts`/`.tsx` files
Order: (1) React/framework imports, (2) third-party library imports, (3) `@/` internal imports, (4) `import type` statements last.
```typescript
import { useEffect, useState } from "react"       // 1. React
import { SimplePool } from 'nostr-tools/pool'     // 2. Third-party (subpath)
import { pool, RELAYS } from '@/lib/pool'         // 3. Internal @/ alias
import type { Article } from '@/types/nostr'      // 4. Type imports last
```

### `useEffect` Cleanup Pattern
**Source:** `src/components/BootSequence.tsx` lines 39-50
**Apply to:** `useArticleFetch.ts`, `useProfileFetch.ts`, `NostrContext.tsx`

Every `useEffect` that opens a subscription or timer MUST return a cleanup function:
```typescript
useEffect(() => {
  const timer = setTimeout(...)
  return () => clearTimeout(timer)  // ALWAYS clean up
}, [dependency])
```
This is especially critical for the Nostr hooks because React StrictMode (active in `main.tsx` line 5) mounts effects twice in development — cleanup prevents duplicate WebSocket subscriptions.

### Terminal Theme Token Usage
**Source:** `src/App.tsx` lines 5-19, `src/components/BootSequence.tsx` lines 53-78, `src/index.css` lines 6-42
**Apply to:** Any UI touched in `App.tsx` modification; not applicable to hook/lib/types files

Available tokens (defined in `src/index.css` `@theme inline` block):
- `bg-terminal-bg` — near-black background
- `bg-terminal-surface` — slightly lighter surface (used in Card)
- `text-terminal-green` — primary phosphor green
- `text-terminal-green-dim` — dimmer green for secondary text
- `text-terminal-amber` — amber accent
- `text-terminal-muted` — muted green for footer/metadata text
- `border-terminal-border` — card/element borders
- CRT utility classes: `crt-glow`, `crt-scanlines`, `crt-flicker`, `cursor-blink`, `line-reveal`

### nostr-tools Subpath Import Enforcement
**Source:** CLAUDE.md "What NOT to Use" table + RESEARCH.md Standard Stack
**Apply to:** `lib/pool.ts`, `lib/nostr.ts`, `hooks/useArticleFetch.ts`, `hooks/useProfileFetch.ts`

NEVER:
```typescript
import { SimplePool, LongFormArticle, npubEncode } from 'nostr-tools'  // root barrel — FORBIDDEN
```

ALWAYS:
```typescript
import { SimplePool } from 'nostr-tools/pool'
import { LongFormArticle, Metadata } from 'nostr-tools/kinds'
import { npubEncode } from 'nostr-tools/nip19'
import type { Event } from 'nostr-tools/core'
```

### TypeScript Strict Mode Conventions
**Source:** `tsconfig.app.json` lines 20-24 (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`)
**Apply to:** All new `.ts`/`.tsx` files

- Optional fields: `T | undefined`, not `T?` where the distinction matters
- No unused variables or parameters — every declared binding must be used
- `switch` statements over union types need exhaustive handling (or explicit `default`)
- `import type` for type-only imports (avoids emitting import statements)

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md patterns as primary reference):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/types/nostr.ts` | types | — | No domain type declaration files exist yet; only `src/vite-env.d.ts` (ambient env types — different purpose). Use RESEARCH.md `## Code Examples / Complete TypeScript Types` as the shape definition. |
| `src/context/NostrContext.tsx` | provider | event-driven | No React context or `useReducer` exists in the codebase. `BootSequence.tsx` provides the hook/effect conventions but not the context/reducer pattern. Use RESEARCH.md Pattern 6 as the primary reference. |

---

## Metadata

**Analog search scope:** `src/` directory (all 7 existing files examined)
**Files scanned:** 7 (`App.tsx`, `main.tsx`, `index.css`, `lib/utils.ts`, `components/BootSequence.tsx`, `components/ui/card.tsx`, `vite-env.d.ts`)
**Pattern extraction date:** 2026-06-06
**nostr-tools status:** NOT YET INSTALLED — planner must include `npm install nostr-tools` as step 1

### Codebase Maturity Note
The project has 7 source files total (Phase 1 scaffold only). There are no existing hooks, context, or multi-file lib patterns to draw from. The pattern conventions below are real and must be respected, but RESEARCH.md is the primary architecture reference for Phase 2's novel patterns (context/reducer, streaming hooks, pool singleton).
