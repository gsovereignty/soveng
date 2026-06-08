# Architecture Research

**Domain:** Client-only Nostr long-form article reader SPA
**Researched:** 2026-06-05
**Confidence:** HIGH (Nostr protocol structure), MEDIUM (React state wiring specifics)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Component Tree                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                        <App />                            │   │
│  │  Owns: nostrStore (articles, profiles, loading state)    │   │
│  │  Triggers: useFetchArticles() on mount                   │   │
│  └───────┬──────────────────────┬───────────────────────────┘   │
│          │                      │                                │
│  ┌───────▼──────────┐  ┌────────▼──────────────────────────┐   │
│  │  <HashtagPanel/> │  │         <ArticleList />            │   │
│  │  Props in:       │  │  Props in: filteredArticles        │   │
│  │    facets        │  │  ┌─────────────────────────────┐   │   │
│  │    selected      │  │  │      <ArticleCard />         │   │   │
│  │    filterMode    │  │  │  Props: article + profile    │   │   │
│  │  Emits:          │  │  │  State: expanded (local)     │   │   │
│  │    onSelect      │  │  │  ┌───────────────────────┐   │   │   │
│  │    onModeToggle  │  │  │  │  <ArticleBody />       │   │   │   │
│  └──────────────────┘  │  │  │  Renders: Markdown     │   │   │   │
│                        │  │  └───────────────────────┘   │   │   │
│                        │  └─────────────────────────────┘   │   │
│                        └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Data / Hook Layer                             │
│                                                                  │
│  useFetchArticles()          useProfiles(pubkeys)               │
│  ┌────────────────────┐      ┌─────────────────────────────┐   │
│  │ 1. subscribeMany   │      │ 1. subscribeMany             │   │
│  │    kinds:[30023]   │      │    kinds:[0], authors:[...]  │   │
│  │ 2. collect events  │ ───► │ 2. collect events            │   │
│  │ 3. dedup by coord  │      │ 3. parse content JSON        │   │
│  │ 4. sort+take 21    │      │ 4. store pubkey→profile map  │   │
│  │ 5. close on eose   │      │ 5. close on eose             │   │
│  └────────────────────┘      └─────────────────────────────┘   │
│                                                                  │
│  nostrStore (Zustand)                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  rawArticles: NostrEvent[]                               │   │
│  │  profiles: Map<pubkey, Profile>                          │   │
│  │  loadingArticles: boolean                                │   │
│  │  loadingProfiles: boolean                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   Relay / WebSocket Layer                        │
│                                                                  │
│  SimplePool (nostr-tools)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  relay.damus.io  │  nos.lol  │  relay.nostr.band  │     │   │
│  │  relay.primal.net                                        │   │
│  │                                                          │   │
│  │  Single pool instance, stable across app lifetime       │   │
│  │  (held in useRef, not recreated on renders)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| `<App />` | Orchestrates fetch lifecycle, holds filter state, computes derived state | nostrStore, useFetchArticles, child components via props |
| `<HashtagPanel />` | Renders facet checkboxes with counts, AND/OR toggle | App (props in, events out) |
| `<ArticleList />` | Renders filtered list, passes profile data to cards | App (receives filteredArticles) |
| `<ArticleCard />` | Shows title/author/timestamp, owns expand/collapse local state | ArticleBody (conditional render) |
| `<ArticleBody />` | Renders Markdown content via react-markdown | ArticleCard (receives content string) |
| `useFetchArticles()` | Opens WS subscriptions, collects events, dedupes, writes to store | SimplePool, nostrStore |
| `useProfiles(pubkeys)` | Batch-fetches kind:0 for given pubkeys, writes to store | SimplePool, nostrStore |
| `nostrStore` (Zustand) | Single source of truth for raw events and profiles | Both hooks write; App reads |

## Recommended Project Structure

```
src/
├── components/
│   ├── ArticleCard.tsx        # Card with local expand state
│   ├── ArticleBody.tsx        # Markdown renderer (react-markdown)
│   ├── ArticleList.tsx        # Renders filtered article array
│   └── HashtagPanel.tsx       # Facet sidebar, AND/OR toggle
├── hooks/
│   ├── useFetchArticles.ts    # Stage-1 relay fetch, writes rawArticles
│   └── useProfiles.ts         # Stage-2 relay fetch, writes profiles
├── store/
│   └── nostrStore.ts          # Zustand store: rawArticles, profiles, loading
├── lib/
│   ├── pool.ts                # Singleton SimplePool with RELAYS constant
│   ├── nostr.ts               # Pure helpers: parseArticle(), parseProfile(), dedup()
│   └── facets.ts              # Pure helper: buildFacets(articles) → facet counts
├── types/
│   └── nostr.ts               # Article, Profile, Facet TypeScript types
├── App.tsx                    # Root: calls hooks, computes derived state, routes props
├── main.tsx
└── index.css
```

### Structure Rationale

- **hooks/:** Fetch logic is pure side-effects; separating them from components makes testing and replacement easy without touching UI.
- **lib/pool.ts:** Pool is created once and exported as a singleton. This prevents multiple WebSocket connections being opened on React re-renders.
- **lib/nostr.ts:** Pure functions for parsing and dedup have no side-effects and are trivially testable.
- **lib/facets.ts:** Hashtag count derivation is pure and separated so App can call it inside `useMemo` with a single clear dependency (`rawArticles`).
- **store/:** Zustand store is the bridge between hooks (writers) and components (readers). No prop-drilling of raw event arrays.

## Architectural Patterns

### Pattern 1: One-Shot Subscription with oneose Close

**What:** Open a `subscribeMany` subscription, collect events into a mutable array via `onevent`, and close the subscription inside `oneose`. Apply a fallback timeout to handle relays that never send EOSE.

**When to use:** Any fetch where you want "all stored events up to now" but not a live stream. Both the articles fetch and the profiles fetch follow this model.

**Trade-offs:** Simple and cheap; closes connections immediately after initial data. Loses any real-time updates published after load (acceptable for this v1 read-only reader).

**Example:**
```typescript
// lib/pool.ts
import { SimplePool } from 'nostr-tools'
export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
]
export const pool = new SimplePool()

// hooks/useFetchArticles.ts
import { useEffect } from 'react'
import { pool, RELAYS } from '../lib/pool'
import { useNostrStore } from '../store/nostrStore'
import { dedupeAddressable } from '../lib/nostr'

export function useFetchArticles() {
  const setArticles = useNostrStore(s => s.setArticles)
  const setLoading  = useNostrStore(s => s.setLoadingArticles)

  useEffect(() => {
    const collected: NostrEvent[] = []
    setLoading(true)

    // Fallback: close after 8 s even if EOSE never arrives
    const timeout = setTimeout(() => { sub.close(); finish() }, 8000)

    const sub = pool.subscribeMany(
      RELAYS,
      [{ kinds: [30023], limit: 100 }],
      {
        onevent(event) { collected.push(event) },
        oneose() {
          clearTimeout(timeout)
          sub.close()
          finish()
        },
      },
    )

    function finish() {
      const deduped = dedupeAddressable(collected)   // keep newest per pubkey+d
      const top21   = deduped
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 21)
      setArticles(top21)
      setLoading(false)
    }

    return () => { clearTimeout(timeout); sub.close() }
  }, [])
}
```

### Pattern 2: Two-Stage Fetch (Articles → Profiles)

**What:** Stage 1 fetches kind:30023 articles and stores them. A second `useEffect` watches `rawArticles` and fires Stage 2 only when articles are present, extracting unique `pubkey` values and opening a single `subscribeMany` for kind:0 with `authors: [pubkeys]`.

**When to use:** Whenever you need to resolve metadata about an entity whose identity only becomes known after an initial fetch.

**Trade-offs:** Two round-trips — unavoidable with Nostr's data model. Batching all pubkeys into a single subscription filter minimises round-trips (one subscription, not one per author).

**Example:**
```typescript
// hooks/useProfiles.ts — triggered after rawArticles are set
export function useProfiles(pubkeys: string[]) {
  const setProfiles = useNostrStore(s => s.setProfiles)
  const setLoading  = useNostrStore(s => s.setLoadingProfiles)

  useEffect(() => {
    if (!pubkeys.length) return
    const collected: NostrEvent[] = []
    setLoading(true)
    const timeout = setTimeout(() => { sub.close(); finish() }, 5000)

    const sub = pool.subscribeMany(
      RELAYS,
      [{ kinds: [0], authors: pubkeys }],
      {
        onevent(event) { collected.push(event) },
        oneose() { clearTimeout(timeout); sub.close(); finish() },
      },
    )

    function finish() {
      const profileMap = new Map<string, Profile>()
      for (const event of collected) {
        const existing = profileMap.get(event.pubkey)
        if (!existing || event.created_at > existing.created_at) {
          profileMap.set(event.pubkey, parseProfile(event))
        }
      }
      setProfiles(profileMap)
      setLoading(false)
    }

    return () => { clearTimeout(timeout); sub.close() }
  }, [pubkeys.join(',')])  // stable dependency: sorted pubkey string
}
```

### Pattern 3: Derived State via useMemo in App

**What:** All derived values — `parsedArticles`, `facets`, `filteredArticles` — are computed inside `useMemo` calls in `<App />`, never stored in state. Filter selections (`selectedTags`, `filterMode`) are the only additional state that lives in `<App />`.

**When to use:** Any value that is a pure function of other state. Storing derived state triggers synchronisation bugs.

**Trade-offs:** Recomputes on every render where dependencies change. With 21 articles this is instantaneous; `useMemo` is a correctness aid here, not an optimisation.

```typescript
// App.tsx (sketch)
const rawArticles     = useNostrStore(s => s.rawArticles)
const profiles        = useNostrStore(s => s.profiles)
const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
const [filterMode, setFilterMode]     = useState<'AND' | 'OR'>('OR')

const parsedArticles  = useMemo(() => rawArticles.map(parseArticle), [rawArticles])
const facets          = useMemo(() => buildFacets(parsedArticles),    [parsedArticles])
const filteredArticles = useMemo(() => {
  if (!selectedTags.size) return parsedArticles
  return parsedArticles.filter(article =>
    filterMode === 'OR'
      ? article.tags.some(t => selectedTags.has(t))
      : article.tags.every(t => selectedTags.has(t))
  )
}, [parsedArticles, selectedTags, filterMode])
```

## Data Flow

### Full Request Flow: Articles to Filtered View

```
App mounts
    │
    ▼
useFetchArticles() fires
    │  subscribeMany kinds:[30023] → 4 relays (parallel WebSockets)
    │  collect events as they arrive via onevent
    │  oneose received from all relays (or 8 s timeout)
    │  dedupeAddressable: keep newest event per "30023:<pubkey>:<d>"
    │  sort desc by created_at, slice 0..21
    ▼
nostrStore.rawArticles updated
    │
    ▼
useProfiles(uniquePubkeys) fires  [triggered by rawArticles change]
    │  subscribeMany kinds:[0], authors:[21 pubkeys] → 4 relays
    │  collect events, keep newest per pubkey
    ▼
nostrStore.profiles Map updated
    │
    ▼
App re-renders:
    useMemo → parsedArticles   (rawArticles mapped to Article type)
    useMemo → facets            (t-tag counts across parsedArticles)
    useMemo → filteredArticles  (apply selectedTags + filterMode)
    │
    ▼
<HashtagPanel facets={facets} …/>
<ArticleList articles={filteredArticles} profiles={profiles} />
```

### Filter Interaction Flow

```
User clicks hashtag checkbox in <HashtagPanel />
    │  onSelect(tag) callback fires
    ▼
App: setSelectedTags(prev => toggle tag in Set)
    │
    ▼
filteredArticles useMemo recomputes (selectedTags changed)
    │
    ▼
<ArticleList /> re-renders with new filtered array

User clicks AND/OR toggle in <HashtagPanel />
    │  onModeToggle() callback fires
    ▼
App: setFilterMode(prev => prev === 'AND' ? 'OR' : 'AND')
    │  filteredArticles useMemo recomputes
    ▼
<ArticleList /> re-renders
```

### Expand/Collapse Flow (Local State)

```
User clicks <ArticleCard />
    │  local useState expanded toggle
    ▼
<ArticleBody /> mounts / unmounts (conditional render)
    No parent re-render; no store involvement.
```

## Addressable Event Deduplication

Kind:30023 is an addressable (parameterized replaceable) event. Its canonical coordinate is:

```
"30023:<pubkey>:<d-tag-value>"
```

Multiple relays may return multiple versions of the same article (same coordinate, different `created_at`). The dedup function must:
1. Build a `Map<coordinate, NostrEvent>`.
2. For each incoming event, insert only if the map has no entry for that coordinate, **or** the new event has a higher `created_at`.
3. Return `Array.from(map.values())` after processing all events.

This must run **before** the sort-and-slice-21 step. Running it after would silently discard valid articles.

## Scaling Considerations

This is a static SPA with no backend, so "scaling" applies only to the client experience under relay load.

| Concern | Approach |
|---------|----------|
| Slow relay | Timeout (8 s articles, 5 s profiles) ensures the UI renders with partial data rather than spinning forever |
| Unresponsive relay (no EOSE) | Same timeout path; `sub.close()` called regardless |
| Relay returns 0 events | Graceful: `deduped` is empty, UI shows empty state |
| Large `t` tag set | `buildFacets` is O(articles × tags), trivially fast for 21 articles |
| Pool memory leak | `useEffect` cleanup always calls `sub.close()`; pool singleton lives for app lifetime |

## Anti-Patterns

### Anti-Pattern 1: Pool Instance in Component State

**What people do:** `const [pool] = useState(() => new SimplePool())`

**Why it's wrong:** React StrictMode in development double-invokes effects; state initializers fire once but subscriptions open twice. Also makes it harder to share the pool across multiple hooks.

**Do this instead:** Create the pool once as a module-level singleton in `lib/pool.ts` and import it. It is never recreated.

---

### Anti-Pattern 2: Storing Derived State in nostrStore

**What people do:** Storing `parsedArticles`, `facets`, or `filteredArticles` in Zustand alongside raw events.

**Why it's wrong:** Creates synchronisation requirements — raw events change, derived slices must be updated atomically or reads observe stale data. Forces mutations in hooks rather than pure transformations.

**Do this instead:** Store only raw events and profiles in Zustand. Derive everything else in `useMemo` in `<App />`. Derived state is always consistent because it is computed, not stored.

---

### Anti-Pattern 3: One Subscription Per Profile

**What people do:** Fetching kind:0 per article inside `<ArticleCard />` using a separate subscription per pubkey.

**Why it's wrong:** 21 articles = 21 subscriptions × 4 relays = 84 simultaneous WebSocket messages. Relay rate-limiting likely; noisy on the network.

**Do this instead:** Collect all unique pubkeys from the resolved article list, open a **single** `subscribeMany` with `authors: [all pubkeys]` as a batch. One subscription across all relays.

---

### Anti-Pattern 4: Subscribing Without a Timeout

**What people do:** Rely solely on EOSE; never adding a fallback timeout.

**Why it's wrong:** Some relays never send EOSE for historical queries, or take 30+ seconds. The app will show a loading spinner indefinitely.

**Do this instead:** Always pair every one-shot subscription with a `setTimeout`. On timeout: close the subscription and call `finish()` with whatever has been collected.

---

### Anti-Pattern 5: Fetching Profiles Before Articles Settle

**What people do:** Fire both Stage 1 and Stage 2 fetches simultaneously on mount, guessing which pubkeys to fetch.

**Why it's wrong:** You do not know the author pubkeys until Stage 1 completes. Fetching kind:0 with an empty `authors` array returns nothing; fetching too early risks missing authors whose articles arrive after the premature profile fetch starts.

**Do this instead:** Trigger `useProfiles` only after `rawArticles` is non-empty (a `useEffect` with `[rawArticles]` dependency). Pass the extracted `pubkeys` array as a prop/argument.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Nostr relays (4 default) | `SimplePool.subscribeMany` over WSS | No auth required for read-only public events; pool manages reconnect with `enableReconnect: true` |
| GitHub Pages | Vite static build with `base: '/<repo>/'` in `vite.config.ts`; GitHub Actions workflow copies `dist/` | No SPA router needed (single page, no URL routing), so no 404.html fallback required |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Hooks → Store | Zustand setter calls (`setArticles`, `setProfiles`, `setLoading`) | Hooks write; components read. No two-way coupling. |
| Store → App | Zustand `useNostrStore(selector)` subscriptions | Fine-grained selectors prevent unnecessary re-renders |
| App → Components | Props (typed Article[], Profile map, facets, callbacks) | No context provider needed at this scale — 2 levels of prop depth maximum |
| ArticleCard → ArticleBody | Conditional render, passes `content: string` | Pure rendering, no data fetching inside card |

## Suggested Build Order

Build order follows the dependency graph bottom-up so GitHub Pages can serve a real URL from day one:

1. **Static shell + GitHub Actions deploy** — Vite scaffold, `base` config, Actions workflow. Confirms Pages works before any Nostr code exists. Validates the deployment pipeline independently.

2. **Relay connection + raw event fetch** — `lib/pool.ts`, `useFetchArticles` hook, store slice, and a bare `<pre>` dump of raw events. Confirms WebSocket connectivity, EOSE handling, and dedup logic in isolation.

3. **Article parsing + list rendering** — `lib/nostr.ts` parse helpers, `<ArticleList />`, `<ArticleCard />` (title/author pubkey/timestamp, no profile yet). Validates the 30023 event shape and top-21 sort.

4. **Profile resolution** — `useProfiles` hook wired to fire after articles load. `<ArticleCard />` shows name + picture once profiles resolve. Validates the two-stage fetch chain end to end.

5. **Hashtag facet panel + filter** — `lib/facets.ts`, `<HashtagPanel />`, filter logic in App `useMemo`. AND/OR toggle. Validates derived-state correctness against the live dataset.

6. **Markdown expansion** — `<ArticleBody />` with react-markdown, expand/collapse in ArticleCard local state. Validates Markdown rendering safety (no HTML injection per NIP-23).

7. **Terminal styling** — shadcn/ui theme tokens, Tailwind monospace + phosphor palette applied across all components. Polish pass; no new data logic.

## Sources

- [NIP-23 Long-form Content specification](https://nips.nostr.com/23)
- [Kind 30023 event structure — Nostrbook](https://nostrbook.dev/kinds/30023)
- [nostr-tools SimplePool — GitHub](https://github.com/nbd-wtf/nostr-tools)
- [Nostrify Relay Pool — EOSE and timeout patterns](https://nostrify.dev/relay/pool)
- [Nostrify React integration — useQuery pattern](https://nostrify.dev/react)
- [Nostr Series Part 4: First Client — React useEffect/cleanup pattern](https://medium.com/@michael.leigh.stewart/nostr-series-part-4-my-first-client-22fa3d31472a)
- [React useMemo — official docs](https://react.dev/reference/react/useMemo)
- [Vite static deploy to GitHub Pages](https://vite.dev/guide/static-deploy)
- [NIP-33 Parameterized Replaceable Events — dedup semantics](https://nostr.co.uk/nips/nip-33/)

---
*Architecture research for: Nostr long-form article reader SPA (client-only)*
*Researched: 2026-06-05*

---

# v1.1 Architecture: In-Browser ML Content Filtering Integration

**Domain:** Adding spam classification + language detection to an existing shipped SPA
**Researched:** 2026-06-07
**Confidence:** HIGH (grounded in actual codebase inspection + verified library documentation)

## Context: The Existing v1.0 Pipeline

v1.0 is shipped at https://gsovereignty.github.io/soveng/. The actual pipeline (from inspecting the codebase):

```
Relay WebSocket events
    ↓
useArticleFetch (pool.subscribeMany, EOSE/9s backstop)   [hooks/useArticleFetch.ts]
    ↓ dispatch ARTICLE_RECEIVED
nostrReducer (dedup-by-coordinate, appends to articles[])  [context/nostrReducer.ts]
    ↓ state.articles (grows as events stream in)
NostrContext consumers
    ↓ useMemo: sortArticlesByReplies
sortedArticles                                              [App.tsx line 20-22]
    ↓ useMemo (two independent)
buildFacets(sortedArticles) → facets[]                    [App.tsx line 26]
filterArticles(sortedArticles, selectedTags, matchMode)   [App.tsx line 38-41]
    ↓
FilterBar (facets + dynamicCounts)    ArticleList → ArticleCard[]
```

Key constraint: `lib/pool.ts` exports a module-level singleton `pool` — never in React state. This is the established pattern for infrastructure singletons in this codebase.

## System Overview: v1.1 Extended Pipeline

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Main Thread                                                              │
│                                                                           │
│  Relay events → nostrReducer → state.articles[]                           │
│                                        │                                 │
│                      ┌─────────────────▼──────────────────────┐          │
│                      │  useClassification(sortedArticles)     │          │
│                      │                                        │          │
│                      │  1. franc-min (sync, per new article): │          │
│                      │     detectLanguage(title + content)    │          │
│                      │     non-english → label immediately    │          │
│                      │                                        │          │
│                      │  2. still pending → postMessage to     │          │
│                      │     Worker: { id, text: first 512 ch } │          │
│                      │                                        │          │
│                      │  resultsRef: Map<id, ClassLabel>       │          │
│                      │  version: number (render trigger)      │          │
│                      └─────────────────┬──────────────────────┘          │
│                                        │ { map, version }                │
│                      ┌─────────────────▼──────────────────────┐          │
│                      │  AppShell useMemos (modified)          │          │
│                      │                                        │          │
│                      │  visibleArticles = sortedArticles      │          │
│                      │    .filter(a => label not spam/non-en) │          │
│                      │    [dep: sortedArticles, version]      │          │
│                      │                                        │          │
│                      │  buildFacets(visibleArticles)  ← KEY   │          │
│                      │  computeDynamicCounts(visibleArticles) │          │
│                      │  filterArticles(visibleArticles, ...)  │          │
│                      └────────────────────────────────────────┘          │
│                                                                           │
│  getClassifierWorker() — module-level singleton (lib/classifierWorker.ts)│
│                      │  postMessage / onmessage                          │
└──────────────────────┼────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────────────────────┐
│  Web Worker (src/workers/classifier.worker.ts)                            │
│                                                                           │
│  env.backends.onnx.wasm.numThreads = 1  (GitHub Pages: no COOP/COEP)     │
│                                                                           │
│  ClassifierPipeline singleton (module-level, lazy init on first message) │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  static instance: Promise<pipeline> | null                       │   │
│  │  static getInstance() → pipeline('text-classification', model,   │   │
│  │                                   { dtype: 'q8' })               │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  onmessage({ id, text })                                                  │
│    → await ClassifierPipeline.getInstance()                               │
│    → result = await pipeline(text)                                        │
│    → postMessage({ id, label: 'ham' | 'spam' | 'error', score })         │
│                                                                           │
│  Cache API — ONNX model artifacts cached automatically after first fetch  │
└───────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decision: Facet Counts vs Hidden Articles

**Decision: Facets derive from `visibleArticles` (post-ML-filter), not from all fetched articles.**

Rationale:
- A facet count "bitcoin (7)" that silently hides 4 spam articles is confusing — users expect counts to match what they will see.
- The existing `buildFacets` call already takes `sortedArticles` as input (App.tsx line 26). Changing the input to `visibleArticles` is a one-line change and is consistent with the existing behavior: facets already update dynamically when hashtag filters are applied.
- Including spam in facet counts while hiding spam from the list creates a UX where counts and results permanently diverge as ML results stream in. Reject.
- While classification is `pending`, articles are treated as visible (fail-open). Only confirmed `spam` and `non-english` labels hide articles. So facets start complete and shrink as ML results arrive — no jarring count jumps.

## New Files and Modified Files

### New Files

| File | Purpose |
|------|---------|
| `src/workers/classifier.worker.ts` | ONNX pipeline singleton, onmessage handler, numThreads=1 config |
| `src/lib/classifierWorker.ts` | Module-level Worker getter (mirrors pool.ts singleton pattern) |
| `src/lib/languageDetect.ts` | franc-min wrapper returning `'english' \| 'non-english' \| 'undetermined'` |
| `src/hooks/useClassification.ts` | Orchestrates franc-min + worker, maintains result Map + version counter |

### Modified Files

| File | Change |
|------|--------|
| `src/types/nostr.ts` | Add `ClassificationLabel` type: `'pending' \| 'ham' \| 'spam' \| 'non-english' \| 'error'` |
| `src/App.tsx` | Wire `useClassification`; add `visibleArticles` memo; update 3 downstream memo inputs |

### Unchanged Files

Everything else: `nostrReducer.ts`, `NostrContext.tsx`, `useArticleFetch.ts`, `useProfileFetch.ts`, `useReplyFetch.ts`, `lib/pool.ts`, `lib/facets.ts`, `lib/nostr.ts`, all components.

## Recommended v1.1 Project Structure (additions only)

```
src/
├── workers/
│   └── classifier.worker.ts       # ONNX worker: singleton pipeline, message handler
├── lib/
│   ├── classifierWorker.ts        # Module-level Worker getter (mirrors pool.ts)
│   ├── languageDetect.ts          # franc-min wrapper, sync, pure function
│   ├── facets.ts                  # UNCHANGED
│   ├── nostr.ts                   # UNCHANGED
│   └── pool.ts                    # UNCHANGED
├── hooks/
│   ├── useClassification.ts       # Worker + franc-min orchestration, result Map
│   ├── useArticleFetch.ts         # UNCHANGED
│   ├── useProfileFetch.ts         # UNCHANGED
│   └── useReplyFetch.ts           # UNCHANGED
├── types/
│   └── nostr.ts                   # Add ClassificationLabel type
└── App.tsx                        # Add visibleArticles memo; wire useClassification
```

## Architectural Patterns

### Pattern 1: Module-Level Worker Singleton (mirrors pool.ts)

**What:** The classifier Worker is created exactly once using a module-level null-check getter, identical to how `lib/pool.ts` exports the SimplePool singleton. This is the strongest StrictMode guard available — the module is evaluated once per page load, regardless of how many times React mounts/unmounts components.

**When to use:** Any stateful browser resource that must not be re-created on React re-renders. The existing codebase uses this for WebSocket connections; the same rule applies to the Worker.

**Trade-offs:** The Worker lives for the entire page lifetime. This is correct — terminating and recreating the Worker would force re-downloading the ONNX model from Cache API on each recreation.

**Example:**
```typescript
// src/lib/classifierWorker.ts
let _worker: Worker | null = null

export function getClassifierWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL('../workers/classifier.worker.ts', import.meta.url),
      { type: 'module' }
    )
  }
  return _worker
}
```

### Pattern 2: Classification State in useRef Map + Version Counter

**What:** `useClassification` maintains a `useRef<Map<string, ClassificationLabel>>` that is mutated by worker callbacks. A companion `useState` version counter is incremented on each mutation to trigger re-renders. The Map itself never becomes React state (never causes React to diff it).

**When to use:** Progressive update scenarios where many async results stream in and each result should cause a re-render, but the data structure itself is too large/complex to be immutably replaced on each update.

**Trade-offs:** The version counter is an indirect dependency — `visibleArticles` memo must depend on `version` not on the Map reference. This is a small conceptual overhead.

**Example:**
```typescript
// src/hooks/useClassification.ts
export type ClassificationLabel = 'pending' | 'ham' | 'spam' | 'non-english' | 'error'

export function useClassification(articles: Article[]) {
  const resultsRef = useRef<Map<string, ClassificationLabel>>(new Map())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const worker = getClassifierWorker()

    // Register result handler once
    const handleMessage = (e: MessageEvent<{ id: string; label: 'ham' | 'spam' | 'error' }>) => {
      resultsRef.current.set(e.data.id, e.data.label)
      setVersion(v => v + 1)
    }
    worker.addEventListener('message', handleMessage)

    return () => worker.removeEventListener('message', handleMessage)
  }, []) // runs once — worker singleton lives for page lifetime

  useEffect(() => {
    const worker = getClassifierWorker()

    for (const article of articles) {
      if (resultsRef.current.has(article.id)) continue  // already classified

      // 1. Synchronous language gate (franc-min)
      const sampleText = `${article.title ?? ''} ${article.content.slice(0, 400)}`
      const lang = detectLanguage(sampleText)

      if (lang === 'non-english') {
        resultsRef.current.set(article.id, 'non-english')
        continue
      }

      // 2. Mark pending, dispatch to ONNX worker
      resultsRef.current.set(article.id, 'pending')
      worker.postMessage({ id: article.id, text: article.content.slice(0, 512) })
    }

    setVersion(v => v + 1)
  }, [articles])

  return { map: resultsRef.current, version }
}
```

### Pattern 3: ONNX Pipeline Singleton Inside the Worker

**What:** The pipeline is held in a static class property inside the worker module. The worker module is evaluated once per Worker instantiation. On first message, `getInstance()` is called; it sets `this.instance` to the pending Promise and returns it. All subsequent messages await the same Promise.

**When to use:** Always — repeated `pipeline()` calls re-download the model. The singleton ensures the model loads once.

**Trade-offs:** First classification request incurs full model load latency (2-10 seconds). Subsequent requests are fast (50-200ms for short text). The model artifacts are cached in the browser's Cache API after first download.

**Example:**
```typescript
// src/workers/classifier.worker.ts
import { pipeline, env } from '@huggingface/transformers'

// GitHub Pages cannot set COOP/COEP headers, so SharedArrayBuffer is unavailable.
// numThreads=1 disables WASM threading, which requires SharedArrayBuffer.
// Performance is adequate for 21 short texts in single-threaded WASM.
env.backends.onnx.wasm.numThreads = 1

class ClassifierPipeline {
  static task = 'text-classification' as const
  // q8 quantization: ~67MB for DistilBERT. Cached by Cache API after first download.
  // Replace with a purpose-built spam model if one exists with the transformers.js library tag.
  static model = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
  static instance: ReturnType<typeof pipeline> | null = null

  static getInstance() {
    this.instance ??= pipeline(this.task, this.model, { dtype: 'q8' })
    return this.instance
  }
}

type ClassifyRequest = { id: string; text: string }

self.addEventListener('message', async (e: MessageEvent<ClassifyRequest>) => {
  try {
    const classifier = await ClassifierPipeline.getInstance()
    const result = await (classifier as Function)(e.data.text, { topk: 1 })
    const label = mapResultToLabel(result)
    self.postMessage({ id: e.data.id, label, score: result[0]?.score ?? 0 })
  } catch {
    // Fail-open: error means the article stays visible
    self.postMessage({ id: e.data.id, label: 'error', score: 0 })
  }
})

function mapResultToLabel(result: Array<{ label: string; score: number }>): 'ham' | 'spam' {
  // DistilBERT SST-2 returns POSITIVE/NEGATIVE — map to ham/spam heuristically.
  // A purpose-built spam model would return SPAM/HAM directly.
  // This mapping is a placeholder; replace with model-specific logic.
  const top = result[0]
  return top?.label === 'NEGATIVE' ? 'spam' : 'ham'
}
```

### Pattern 4: franc-min as Synchronous Pre-filter

**What:** `franc-min` is called synchronously in the main thread before dispatching to the Worker. Articles detected as non-English are labeled immediately and never sent to ONNX inference. franc-min supports 82 languages, is ESM-only, ~20KB, and requires no model download.

**When to use:** Always — franc-min is the cheap gate before the expensive ONNX inference. A non-English article costs a few microseconds to detect vs 50-200ms for ONNX.

**Trade-offs:** franc-min needs ~100+ characters for reliable detection. For very short articles (< 50 characters), `franc` returns `'und'` (undetermined) — treat `undetermined` as English (fail-open) and let ONNX classify the body instead.

**Example:**
```typescript
// src/lib/languageDetect.ts
import { franc } from 'franc-min'

export type LanguageDetectionResult = 'english' | 'non-english' | 'undetermined'

export function detectLanguage(text: string): LanguageDetectionResult {
  if (text.trim().length < 20) return 'undetermined'
  const code = franc(text, { minLength: 20 })
  if (code === 'und') return 'undetermined'
  if (code === 'eng') return 'english'
  return 'non-english'
}
```

### Pattern 5: visibleArticles as the Single ML-Filter Insertion Point

**What:** A single `visibleArticles` memo is inserted between `sortedArticles` and all existing downstream memos in AppShell. This is the only place the ML filter is applied. All downstream code (`buildFacets`, `computeDynamicCounts`, `filterArticles`) is unchanged.

**When to use:** This is the minimum-change integration. The entire ML filter is one memo.

**Trade-offs:** The `version` dep from `useClassification` must be listed explicitly so React knows to re-evaluate this memo when new results arrive.

**Example:**
```typescript
// App.tsx — AppShell, after sortedArticles memo
const { map: classificationMap, version: classificationVersion } = useClassification(sortedArticles)

const visibleArticles = useMemo(
  () => sortedArticles.filter(a => {
    const label = classificationMap.get(a.id)
    // fail-open: undefined, pending, error → show the article
    return label !== 'spam' && label !== 'non-english'
  }),
  [sortedArticles, classificationVersion]
  // classificationVersion increments on each worker result → memo re-evaluates
)

// Replace sortedArticles with visibleArticles in all three downstream memos:
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

## Data Flow: v1.1 Extended Article Pipeline

```
Relay WebSocket events
    ↓ ARTICLE_RECEIVED dispatch
nostrReducer: append to articles[], dedup by coordinate
    ↓ state.articles (grows as events stream in)
NostrContext.state.articles
    ↓ useMemo: sortArticlesByReplies
sortedArticles (reply-count sorted)
    ↓ useClassification(sortedArticles) — runs on each sortedArticles change
      ├── [sync] franc-min: detect non-English → label immediately, skip worker
      └── [async] postMessage({ id, text: content.slice(0,512) }) to Worker
            Worker: await ONNX pipeline → postMessage({ id, label, score })
            → onmessage: resultsRef.current.set(id, label); setVersion(v+1)
    ↓ { map: classificationMap, version } — version changes on each result
visibleArticles = sortedArticles.filter(not spam, not non-english)
    [useMemo on sortedArticles + version]
    ├── buildFacets(visibleArticles)              [useMemo on visibleArticles]
    ├── computeDynamicCounts(visibleArticles, ...) [useMemo]
    └── filterArticles(visibleArticles, ...)       [useMemo]
         ↓
ArticleList → ArticleCard[]
```

### Worker Message Protocol

Main → Worker:
```typescript
type ClassifyRequest = { id: string; text: string }
// text = article.content.slice(0, 512) — BERT max is 512 tokens; char slice is a safe proxy
```

Worker → Main:
```typescript
type ClassifyResult = { id: string; label: 'ham' | 'spam' | 'error'; score: number }
// score reserved for future use (confidence threshold tuning)
```

### Fail-Open Path

```
Article id arrives in articles[]
    ↓
classificationMap.get(id) → ?
    undefined      → show (not yet submitted, e.g. worker not started)
    'pending'      → show (awaiting result)
    'error'        → show (worker threw, model load failed, timeout)
    'ham'          → show
    'non-english'  → HIDE
    'spam'         → HIDE
```

No error in franc-min, the Worker, or the model loader causes an article to disappear unless explicitly classified as spam or non-english. All failure modes fall through to visible.

## StrictMode and Worker Singleton Interaction

**The problem:** React StrictMode in development mounts components, runs effects, unmounts, then mounts again. If the Worker is created inside a `useEffect`, the cleanup on unmount terminates the Worker; the second mount creates a new one and triggers ONNX model re-initialization (re-download from Cache API or at minimum re-parsing).

**Solution:** The module-level singleton pattern (`lib/classifierWorker.ts`) mirrors `lib/pool.ts` exactly. The Worker is created when `getClassifierWorker()` is first called. Subsequent calls return the same instance. No `useEffect` creates or terminates the Worker. StrictMode double-mount has no effect — the second mount calls `getClassifierWorker()` and gets back the already-created Worker. This is the same reason `lib/pool.ts` was written as a module-level export: it was explicitly chosen for StrictMode safety.

The `addEventListener('message', handler)` + cleanup `removeEventListener` pattern in the hook is safe for StrictMode double-mount because adding and removing event listeners is idempotent — the Worker itself is unaffected.

## Caching Layers

| Layer | What | Mechanism | Persistence |
|-------|------|-----------|-------------|
| ONNX model artifacts | Model weights, tokenizer config (~67MB q8 DistilBERT) | Cache API — automatic in `@huggingface/transformers`; controlled by `env.useBrowserCache` (default `true`) | Survives page reload; evictable by browser under storage pressure |
| Classification results (in-memory) | `resultsRef.current: Map<id, label>` | Module-level through `useRef` in hook | Session only — lost on page reload. Re-classification runs on next load, but model is cached so it's fast |
| Classification results (cross-session, optional) | Same Map, serialized | `localStorage` keyed by event id | Survives reload; requires pruning logic. Defer to v1.2. |

**Recommendation for v1.1:** In-memory only. localStorage cross-session caching is a worthwhile future optimization but adds serialization, quota management, and stale-entry pruning complexity that is not needed for the initial feature.

## Build Order (Dependency-Respecting)

Each step is independently testable before the next:

**Step 1 — `src/types/nostr.ts`**
Add `ClassificationLabel = 'pending' | 'ham' | 'spam' | 'non-english' | 'error'`. Zero dependencies. Unblocks all subsequent steps.

**Step 2 — `src/lib/languageDetect.ts`**
Thin franc-min wrapper. Pure function, no browser APIs. Write Vitest unit tests immediately (test English, non-English, and short-text/undetermined cases). Install `franc-min` at this step.

**Step 3 — `src/workers/classifier.worker.ts`**
ONNX pipeline singleton. Set `numThreads = 1`. Implement `try/catch` error reply. Install `@huggingface/transformers`. Cannot be unit tested with Vitest (worker context) — manual browser test is sufficient at this step.

**Step 4 — `src/lib/classifierWorker.ts`**
Module-level Worker getter. Depends on the worker file existing (for the `new URL(...)` path). Trivial to implement; no tests needed.

**Step 5 — `src/hooks/useClassification.ts`**
Ties franc-min + Worker together. Depends on steps 1-4. Returns `{ map, version }`. Unit testable with a mock worker; Vitest can mock the `getClassifierWorker` export.

**Step 6 — `src/App.tsx`**
Wire `useClassification` into AppShell. Add `visibleArticles` memo. Update three downstream memo inputs. This is the final integration step — verify in browser that articles are progressively hidden as results arrive.

**Step 7 — Tests and edge cases**
Test: franc-min on Arabic/Chinese/Russian titles. Test: empty content. Test: worker error path (articles stay visible). Test: refetch (RESET action) clears articles[] — confirm `useClassification` re-classifies the new set (it does, because new article IDs won't be in the Map).

## Anti-Patterns

### Anti-Pattern 1: Classification State in the nostrReducer

**What people do:** Add `classificationMap: Map<string, ClassificationLabel>` to `NostrState` and a `CLASSIFICATION_RECEIVED` action to the reducer.

**Why it's wrong:** Every worker message would dispatch a reducer action. With 21 articles, that is 21 extra dispatch cycles through the reducer. The reducer is pure Nostr protocol state — mixing in ML inference results couples two unrelated concerns. The existing "no derived/external state in the reducer" rule (parallel to "pool singleton never in React state") should be maintained.

**Do this instead:** Keep classification state in a `useRef` Map in `useClassification`. The reducer stays pure.

### Anti-Pattern 2: Blocking Article Render Until Classification Completes

**What people do:** Show a placeholder or spinner until all articles have a final classification label.

**Why it's wrong:** ONNX model load takes 2-10 seconds on first visit. Blocking render that long means users see nothing for 10+ seconds. This contradicts the existing progressive rendering behavior (articles appear as they stream from relays).

**Do this instead:** Fail-open immediately — all articles start visible (`pending`), then spam/non-English articles disappear progressively as results arrive. Users see the full list immediately; quality improves in the background.

### Anti-Pattern 3: Sending Full Article Bodies to the Worker

**What people do:** `worker.postMessage({ id, text: article.content })` without truncation.

**Why it's wrong:** BERT-family models have a 512-token hard cap. Content beyond 512 tokens is silently truncated by the tokenizer anyway. Sending a 10KB article body wastes postMessage serialization time and worker memory.

**Do this instead:** `article.content.slice(0, 512)` before postMessage. 512 characters is a conservative proxy for 512 tokens (most English tokens are 4-6 characters).

### Anti-Pattern 4: Creating the Worker Inside useEffect

**What people do:** `useEffect(() => { const w = new Worker(...); return () => w.terminate() }, [])`

**Why it's wrong:** In React StrictMode (development), this creates the worker, terminates it (cleanup), then creates it again. The second Worker has to re-initialize the ONNX pipeline. Any pending messages sent to the first Worker are lost. Behavior diverges between development and production.

**Do this instead:** Use the module-level singleton pattern (`classifierWorker.ts`). The Worker is created exactly once per page load, regardless of React lifecycle.

### Anti-Pattern 5: Applying ML Filter After Hashtag Filter

**What people do:** Apply ML classification as a post-processing step on `filteredArticles` (after hashtag tag filter).

**Why it's wrong:** Facet counts would include spam articles, dynamic counts would shift as ML results arrive in a confusing way, and the pipeline order would be inverted from the correct dependency graph.

**Do this instead:** ML filter produces `visibleArticles` from `sortedArticles`. Hashtag filter and facets operate on `visibleArticles`. The invariant: every article visible anywhere in the UI has passed the ML filter.

### Anti-Pattern 6: Using Zero-Shot Classification for Spam Detection

**What people do:** Use `pipeline('zero-shot-classification', model)` with labels `['spam', 'ham']`.

**Why it's wrong:** Zero-shot classification with BERT MNLI models is 3-10x slower than fine-tuned text classification (1-3 seconds per article vs 50-200ms). For 21 articles, that is 20-60 seconds of classification latency. Zero-shot also requires sending two forward passes (one per label).

**Do this instead:** Use `pipeline('text-classification', model)` with a fine-tuned spam/ham model, or a fine-tuned sentiment model as a proxy. A purpose-built spam detection model with the `transformers.js` library tag on HuggingFace Hub is the ideal choice; check the Hub for available options.

## Integration Points

### New Files and Their Dependencies

| File | Depends On | Consumed By |
|------|-----------|-------------|
| `src/workers/classifier.worker.ts` | `@huggingface/transformers` | `lib/classifierWorker.ts` |
| `src/lib/classifierWorker.ts` | `classifier.worker.ts` (URL reference) | `hooks/useClassification.ts` |
| `src/lib/languageDetect.ts` | `franc-min` | `hooks/useClassification.ts` |
| `src/hooks/useClassification.ts` | `classifierWorker.ts`, `languageDetect.ts`, `types/nostr.ts` | `App.tsx` (AppShell) |

### Modified Files

| File | Change | Scope |
|------|--------|-------|
| `src/types/nostr.ts` | Add `ClassificationLabel` type | 3 lines |
| `src/App.tsx` | Add `useClassification` call; add `visibleArticles` memo; update 3 memo inputs | ~15 lines |

### Vite Configuration Note

Vite natively supports `new Worker(new URL('./path/to/worker.ts', import.meta.url), { type: 'module' })` — no additional Vite config is needed. The `@vitejs/plugin-react` already installed handles the TypeScript compilation of the worker file.

## Sources

- Hugging Face transformers.js React tutorial (official, verified): https://huggingface.co/docs/transformers.js/tutorials/react
- transformers.js `env.backends.onnx.wasm.numThreads` = 1 for GitHub Pages (COOP/COEP unavailable): multiple sources confirm, MEDIUM confidence
- GitHub Pages COOP/COEP limitation (no SharedArrayBuffer): https://github.com/orgs/community/discussions/13309
- franc GitHub (verified): https://github.com/wooorm/franc — ESM only, ISO 639-3 codes, `franc()` API, browser-compatible
- transformers.js Cache API automatic caching (`env.useBrowserCache = true` default): multiple sources confirm
- Real codebase inspection (HIGH confidence): `src/App.tsx`, `src/context/nostrReducer.ts`, `src/context/NostrContext.tsx`, `src/lib/pool.ts`, `src/lib/facets.ts`, `src/hooks/useArticleFetch.ts`, `src/types/nostr.ts`

---
*v1.1 ML integration architecture for: Soveng in-browser spam classification + language detection*
*Researched: 2026-06-07*
