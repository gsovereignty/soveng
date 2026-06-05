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
