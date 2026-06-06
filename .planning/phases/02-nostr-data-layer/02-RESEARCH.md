# Phase 2: Nostr Data Layer - Research

**Researched:** 2026-06-06
**Domain:** nostr-tools SimplePool streaming API, plain-React streaming state, NIP-23 parsing
**Confidence:** HIGH (API verified from extracted source; architecture patterns verified against actual code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Render-on-arrival. `onevent` surfaces data immediately — no EOSE wait.
- **D-02** Hard-freeze at first 21 distinct articles (by coordinate). Later events ignored.
- **D-03** Dedup-by-coordinate during streaming; first-arriving version wins.
- **D-04** Timer is cleanup-only: closes subscriptions, resolves empty/error status. Does NOT gate rendering.
- **D-05** Close article subscription proactively once 21 articles are accumulated.
- **D-06** Status surface: `streaming → done | empty | error`.
- **D-07** Track per-relay outcome (events-received / EOSE-with-zero / connection-error) to compute empty vs error.
- **D-08** Per-article optional `profile?: Profile`; cards upgrade in place — no global loadingProfiles gate.
- **D-09** Batch pubkeys into as few subscriptions as possible; no one-sub-per-author.
- **D-10** NIP-23 parse with fallbacks everywhere. Only `d` is guaranteed. No crash on missing tags.
- **D-11** Plain React (hooks + context + reducer). No Zustand.
- **D-12** Expose `refetch()` — resets state, re-opens the stream.
- Singleton `SimplePool` at module level (not in React state, StrictMode-safe).
- Subpath imports: `nostr-tools/pool`, `nostr-tools/kinds`, `nostr-tools/nip19`.
- Default relays: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`, `wss://relay.primal.net`.
- `t` tag values lowercased/normalized in the parsed model.
- Per-relay `limit` over-fetch (research used 100; exact value Claude's discretion).

### Claude's Discretion

- Exact fallback-timer duration(s) and per-stage tuning.
- Per-relay `limit` value for the article filter.
- Exact module/file layout (adapt ARCHITECTURE.md's `lib/`/`hooks/` structure to plain-React-context; `store/nostrStore.ts` becomes a context/provider).
- Precise batching mechanism for the kind:0 profile subscription.
- Concrete TypeScript shapes for `Article`, `Profile`, and the status object.

### Deferred Ideas (OUT OF SCOPE)

- Per-relay connection status indicator (v2 ENRICH-03).
- Live updates / newer-article bumping (hard-freeze chosen).
- User-configurable relay set and adjustable feed length (v2 CONF-01/CONF-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | App connects to fixed default relay set over WebSocket | Pool singleton + subscribeMany API verified |
| DATA-02 | 21 most recent articles (relaxed: first 21 to arrive, in arrival order) | Streaming D-01/D-02 pattern; limit over-fetch guidance |
| DATA-03 | Dedup by `kind:pubkey:d` coordinate, first-arriving wins (relaxed from newest-wins) | dedupeAddressable function pattern with Set; coordinate construction |
| DATA-04 | EOSE/response timeout never blocks rendering | Fallback timer as cleanup-only; eoseTimeout mechanics verified |
| DATA-05 | Batch kind:0 profile resolution | Single batched subscribeMany with `authors: [pubkeys]` |
| DATA-06 | NIP-23 parse with fallbacks for all optional tags | Tag optionality rules per NIP-23; safe extraction patterns |
</phase_requirements>

---

## Summary

Phase 2 is the highest-risk layer in the project. The primary technical challenge is adapting the nostr-tools SimplePool API to a streaming, render-on-arrival model (D-01) rather than the collect-then-render pattern shown in prior research. All API findings in this document are verified against the actual extracted nostr-tools 2.23.5 source (`abstract-pool.js`, `abstract-relay.js`, `pool.js`).

The streaming model works by wiring `onevent` to a React reducer that appends articles to state immediately, with a coordinate-keyed `Set` guarding the hard-freeze at 21. The pool's `onclose` callback (which receives a `string[]` of per-relay close reasons) is the primary mechanism for per-relay outcome tracking (D-07) and the empty-vs-error determination (D-06).

Profile batching (D-09) is straightforward: once rendered articles exist, open a single `subscribeMany` with `{ kinds: [0], authors: [all rendered pubkeys] }` and patch the profile map as events arrive. The profile subscription uses `maxWait` rather than manual teardown since the article set freezes at most 21 authors.

The largest implementation subtlety is StrictMode safety for the module-level pool singleton. Plain module scope — not React state, not `useRef` — is the correct pattern. The pool is created once when the module is evaluated and shared across all hook invocations.

**Primary recommendation:** Use `pool.subscribeMany(RELAYS, filter, { onevent, onclose, maxWait })` for streaming with `maxWait` as the EOSE backstop; build per-relay tracking via a `relayOutcomes` ref keyed by relay URL; use a React `useReducer` dispatching `ARTICLE_RECEIVED` and `PROFILE_RECEIVED` actions; expose state via a `NostrContext`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WebSocket relay connections | Browser (client) | — | All fetching is client-side; no backend exists |
| Event deduplication | Browser (lib/nostr.ts) | — | Pure computation on received events |
| Streaming state (articles, profiles, status) | Browser (React context) | — | No server; context is the single source of truth |
| Fallback timer / subscription cleanup | Browser (hook effect cleanup) | — | Must fire in the browser; tied to component lifecycle |
| NIP-23 tag parsing | Browser (lib/nostr.ts) | — | Pure transformation of raw Nostr events |
| Profile batch resolution | Browser (hook) | — | Triggered after first article arrives; same relay pool |
| `refetch()` | Browser (hook) | — | Resets React state and re-opens subscriptions |

---

## Standard Stack

### Core (for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nostr-tools | 2.23.5 | `SimplePool` for multi-relay WebSocket; kind constants; nip19 encode | Locked decision; smallest viable surface for read-only relay fetch; source verified |
| React 19 | 19.x | `useReducer`, `useContext`, `useEffect`, `useRef` | Locked decision; streaming model maps naturally to reducer dispatch |
| TypeScript 5 | 5.x | Type-safe event shapes, `Article`, `Profile`, status union | Already installed; nostr-tools exports full types |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nostr-tools/pool | (subpath of 2.23.5) | `SimplePool` class import | Article fetch and profile fetch |
| nostr-tools/kinds | (subpath of 2.23.5) | `LongFormArticle = 30023`, `Metadata = 0` constants | Filter construction |
| nostr-tools/nip19 | (subpath of 2.23.5) | `npubEncode(pubkey)` for display fallback | Profile display name fallback |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain React context + useReducer | Zustand | Zustand is superseded by D-11; context is sufficient for a two-consumer tree |
| subscribeMany streaming | querySync | querySync is collect-then-resolve; superseded by D-01 streaming requirement |
| Module-level pool singleton | pool in useRef | useRef requires the pool to be created inside the first hook invocation; module-level is cleaner for sharing across hook files |

**Installation:**
```bash
npm install nostr-tools
```

nostr-tools is the only new runtime dependency this phase adds.

---

## Package Legitimacy Audit

slopcheck was not available at research time (install failed). Manual verification performed instead.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| nostr-tools | npm | 5+ yrs (created 2021-01-04) | — | github.com/nbd-wtf/nostr-tools | unavailable | Approved — well-known project; maintained by fiatjaf (Nostr protocol co-author); last publish 2026-05-18; no postinstall script |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. The package above is tagged `[VERIFIED: npm registry + official GitHub]` based on manual cross-check: correct registry name, correct maintainer (fiatjaf), correct GitHub repo, no suspicious scripts, 5-year publication history.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser: User visits page
    │
    ▼
<NostrProvider> mounts
    │  Creates AbortController for this fetch session
    │  Dispatches RESET to useReducer
    ▼
useArticleFetch() — Effect 1: Article stream
    │
    │  pool.subscribeMany(RELAYS, { kinds:[30023], limit:100 }, {
    │    onevent(event) ──────────────────────────────────────────────►
    │    onclose(reasons[]) → per-relay outcome tracking              │
    │    maxWait: 8000                                                │
    │  })                                                             │
    │                                                              reducer
    │  relayOutcomes Map<url, 'ok'|'error'> updated per relay        │
    │                                                              dispatch(ARTICLE_RECEIVED)
    │  articleCount ref reaches 21                                    │
    │     └─► sub.close() [D-05]                                      │
    │                                                                  │
    │  fallbackTimer fires (8000ms)                                    │
    │     └─► sub.close() + resolve status                            │
    │                                                                  ▼
    │                                                          state.articles grows
    │                                                          (≤21, frozen on 21st)
    │
    ├─► useProfileFetch() — Effect 2: Profile stream
    │       Triggered when state.articles.length > 0
    │       Collects unique pubkeys from rendered articles
    │       pool.subscribeMany(RELAYS, { kinds:[0], authors:[pubkeys] }, {
    │         onevent(event) → dispatch(PROFILE_RECEIVED)
    │         maxWait: 5000
    │       })
    │
    ▼
<App /> reads context:
    articles[]    — Article[] up to 21, in arrival order
    profiles      — Map<pubkey, Profile>  (grows as events arrive)
    status        — 'streaming' | 'done' | 'empty' | 'error'
    refetch()     — resets + re-opens

Phase 3 consumers:
    <BootSequence lines={streamingLines} />  when status === 'streaming'
    <ArticleList articles={articles} profiles={profiles} />
    relay-error / empty states on status === 'error' / 'empty'
```

### Recommended Project Structure

```
src/
├── components/
│   └── BootSequence.tsx      # Already exists — reused for streaming state
├── context/
│   └── NostrContext.tsx      # createContext + NostrProvider + useNostr hook
├── hooks/
│   ├── useArticleFetch.ts    # Stage-1: streaming kind:30023 events
│   └── useProfileFetch.ts    # Stage-2: batch kind:0, triggered by article pubkeys
├── lib/
│   ├── pool.ts               # Module-level SimplePool singleton + RELAYS constant
│   └── nostr.ts              # Pure helpers: parseArticle(), parseProfile(), dedupeArticle()
├── types/
│   └── nostr.ts              # Article, Profile, NostrStatus, RelayOutcome types
├── App.tsx                   # Wraps <NostrProvider>, reads context
├── main.tsx
└── index.css
```

**Key adaptation from ARCHITECTURE.md:** `store/nostrStore.ts` (Zustand) is replaced by `context/NostrContext.tsx` (React context + useReducer). Everything else — the `lib/` split, the hooks split, the two-stage fetch — carries over from ARCHITECTURE.md unchanged.

---

### Pattern 1: Module-Level Pool Singleton (StrictMode-Safe)

**What:** Create `SimplePool` once at module evaluation time in `lib/pool.ts`. Never re-create.

**Why:** React StrictMode in development mounts effects twice. If the pool were created inside `useEffect` or `useState`, two pools (and thus duplicate subscriptions) would open. Module scope is evaluated once per module load — stable regardless of React's render cycle.

**When to use:** Always for the pool. Never put the pool in component state or `useEffect` body.

```typescript
// Source: verified from lib/esm/pool.js — SimplePool constructor calls super()
// with verifyEvent=verifyEvent and websocketImplementation=WebSocket
// [VERIFIED: nostr-tools 2.23.5 extracted source]

// src/lib/pool.ts
import { SimplePool } from 'nostr-tools/pool'

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
]

// Created ONCE at module level — never inside a React component or hook body
export const pool = new SimplePool()
```

**StrictMode trap:** If a developer moves this into a hook:
```typescript
// WRONG — creates two pools in StrictMode dev
const [pool] = useState(() => new SimplePool())
```
Two pools = two subscriptions per relay = duplicate events in the reducer.

---

### Pattern 2: Streaming Article Subscription (D-01, D-02, D-03, D-05)

**What:** `pool.subscribeMany(relays, filter, params)` is the correct API for streaming.

**API verified from source (nostr-tools 2.23.5):**

```typescript
// From abstract-pool.d.ts [VERIFIED: extracted source]
subscribeMany(
  relays: string[],
  filter: Filter,
  params: SubscribeManyParams  // see below
): SubCloser  // { close(reason?: string): void }

type SubscribeManyParams = {
  onevent?: (evt: Event) => void
  oninvalidevent?: (evt: unknown) => void
  oneose?: () => void         // fires when ALL relays have EOSEd
  onclose?: (reasons: string[]) => void  // array[N] — one per relay, in relay-list order
  maxWait?: number            // passed as eoseTimeout to each per-relay Subscription
  abort?: AbortSignal
  id?: string
  label?: string
}
```

**Critical insight from source:** `subscribeMany` is literally an alias for `subscribe` in 2.23.5 (`subscribeMany(relays, filter, params) { return this.subscribe(relays, filter, params) }`). Both names are equivalent; `subscribeMany` is preferred for clarity.

**`maxWait` mechanics (verified from source):** When `maxWait` is passed, it becomes the `eoseTimeout` on each per-relay `Subscription`. At creation, `Subscription.fire()` starts a `setTimeout(receivedEose, eoseTimeout)`. When it fires, the subscription marks itself EOSE'd. Once all N relays have EOSE'd (via real EOSE or timeout), `params.oneose()` is called, then `subscribeEose` auto-closes all subs.

**`onclose` mechanics (verified from source):** `onclose` receives a `string[]` where `closesReceived[i]` is the close reason for relay at index `i` in the grouped-requests array. Connection failures have non-"eose" reason strings. This is the D-07 per-relay tracking surface.

**The streaming pattern for this phase:**

```typescript
// Source: verified API from abstract-pool.d.ts + pool.js source
// [VERIFIED: nostr-tools 2.23.5 extracted source]

import { LongFormArticle } from 'nostr-tools/kinds'
import { pool, RELAYS } from '../lib/pool'

// In useArticleFetch hook:
useEffect(() => {
  // Per-relay outcome tracking for D-07
  const relayOutcomes = new Map<string, 'pending' | 'ok-with-events' | 'ok-empty' | 'error'>()
  RELAYS.forEach(url => relayOutcomes.set(url, 'pending'))

  // Track events-received per relay to distinguish ok-empty vs ok-with-events
  const relayEventCounts = new Map<string, number>()
  RELAYS.forEach(url => relayEventCounts.set(url, 0))

  let frozen = false  // guard: once true, ignore further onevent calls

  const sub = pool.subscribeMany(
    RELAYS,
    { kinds: [LongFormArticle], limit: 100 },
    {
      onevent(event) {
        if (frozen) return
        dispatch({ type: 'ARTICLE_RECEIVED', event })
        // Track which relay this event came from via pool.seenOn (if trackRelays enabled)
        // Simpler: count all events received before freeze; relay attribution is a v2 concern
      },
      oneose() {
        // Fires when ALL relays have EOSE'd (or timed out via maxWait)
        // At this point onclose fires next; let onclose resolve status
      },
      onclose(reasons: string[]) {
        // reasons[i] is the close reason for RELAYS[i]
        // Distinguish: connection failure reason != "closed by caller" / "closed automatically on eose"
        RELAYS.forEach((url, i) => {
          const reason = reasons[i] ?? 'unknown'
          const isError = !reason.includes('eose') && !reason.includes('closed by caller')
          relayOutcomes.set(url, isError ? 'error' : 'ok-empty')
        })
        resolveStatus(relayOutcomes, dispatch)
        frozen = true
      },
      maxWait: 8000,
    },
  )

  // D-05: close early once 21 articles accumulated
  // (dispatched via ARTICLE_RECEIVED; checked in reducer; close triggered here via ref or callback)

  // D-04: backstop timer (redundant when maxWait is set, but belt-and-suspenders for sub.close)
  const timer = setTimeout(() => {
    sub.close('backstop timer fired')
  }, 9000)  // slightly longer than maxWait so maxWait fires first

  return () => {
    clearTimeout(timer)
    sub.close('effect cleanup')
    frozen = true
  }
}, [fetchKey])  // fetchKey increments on refetch() to re-run effect
```

**Important:** `sub.close()` is async internally (awaits `allOpened`) but returns `void` in practice for the close path. Calling it from a timer or the freeze guard is safe.

---

### Pattern 3: Per-Relay Outcome Tracking (D-07)

**What:** Use the `onclose(reasons: string[])` callback — where `reasons[i]` corresponds to `RELAYS[i]` — to determine per-relay outcome.

**Close reason strings from source (verified):**

| Situation | Reason string |
|-----------|---------------|
| EOSE received normally | `"closed automatically on eose"` (set by `subscribeEose`) |
| maxWait timeout triggered | `"closed automatically on eose"` (receivedEose is called by the timeout, same path) |
| Connection failed (WebSocket error/timeout) | `"connection failed"`, `"connection timed out"`, `"websocket closed"`, or `String(err)` |
| Caller closed subscription | `"closed by caller"` (passed to sub.close()) |
| Relay sent CLOSED message | The CLOSED reason string from the relay |

**Classification logic:**

```typescript
function classifyRelayClose(reason: string): 'clean' | 'error' {
  if (
    reason.includes('eose') ||
    reason.includes('closed by caller') ||
    reason.includes('effect cleanup') ||
    reason.includes('backstop timer')
  ) return 'clean'
  return 'error'
}
```

**D-06 empty vs error resolution:**

```typescript
function resolveStatus(
  relayOutcomes: Map<string, 'clean' | 'error'>,
  articleCount: number,
  dispatch: Dispatch
) {
  if (articleCount > 0) {
    dispatch({ type: 'SET_STATUS', status: 'done' })
    return
  }
  const outcomes = Array.from(relayOutcomes.values())
  const allError = outcomes.every(o => o === 'error')
  dispatch({ type: 'SET_STATUS', status: allError ? 'error' : 'empty' })
}
```

---

### Pattern 4: Hard-Freeze at 21 (D-02, D-05)

**What:** The reducer maintains a coordinate `Set`. Once size reaches 21, subsequent `ARTICLE_RECEIVED` dispatches are no-ops. The hook also closes the subscription proactively.

**Challenge:** The hook's closure over `frozen` must be kept in sync with the reducer's article count. Use a `useRef` that the hook can read without triggering re-renders.

```typescript
// In the reducer:
case 'ARTICLE_RECEIVED': {
  if (state.articles.length >= 21) return state  // freeze guard
  const coord = articleCoordinate(action.event)
  if (state.seenCoords.has(coord)) return state  // dedup guard
  return {
    ...state,
    articles: [...state.articles, parseArticle(action.event)],
    seenCoords: new Set([...state.seenCoords, coord]),
  }
}

// In the hook:
// Watch article count and close subscription when frozen:
useEffect(() => {
  if (articles.length >= 21 && subRef.current) {
    subRef.current.close('freeze-at-21')
    subRef.current = null
    dispatch({ type: 'SET_STATUS', status: 'done' })
  }
}, [articles.length])
```

**Coordinate construction:**

```typescript
function articleCoordinate(event: Event): string {
  const d = event.tags.find(t => t[0] === 'd')?.[1] ?? ''
  return `${event.kind}:${event.pubkey}:${d}`
  // e.g. "30023:abc123...64hex:my-article-slug"
}
```

---

### Pattern 5: Batched Profile Subscription (D-08, D-09)

**What:** After rendered articles exist, open a single `subscribeMany` with all rendered pubkeys in one `authors` filter. Patch the profile map as events arrive. Since the article list is frozen at 21 max, the profile set is also stable.

**Timing:** Trigger via a `useEffect` that depends on the article pubkeys. The debated "subscribe as articles render vs wait for freeze" question resolves naturally: since profiles appear optional and articles render immediately, subscribe once there is at least one pubkey, using the full rendered set. When new articles add new pubkeys (before the freeze), re-subscribe by updating the dependency.

**Practical approach — single subscription over the frozen set:**

```typescript
// src/hooks/useProfileFetch.ts
// [VERIFIED: subscribeMany API from abstract-pool.d.ts]

export function useProfileFetch(pubkeys: string[]) {
  const { dispatch } = useNostr()

  useEffect(() => {
    if (pubkeys.length === 0) return

    const sub = pool.subscribeMany(
      RELAYS,
      { kinds: [Metadata], authors: pubkeys },  // Metadata = 0 from nostr-tools/kinds
      {
        onevent(event) {
          dispatch({ type: 'PROFILE_RECEIVED', event })
        },
        maxWait: 5000,
      }
    )

    return () => { sub.close('profile effect cleanup') }
  }, [pubkeys.join(',')])  // stable dependency string; re-fires if pubkey set changes
}
```

**Profile reducer case — upgrade-in-place (D-08):**

```typescript
case 'PROFILE_RECEIVED': {
  const profile = parseProfile(action.event)
  const existing = state.profiles.get(action.event.pubkey)
  // Accept: no existing, or newer event
  if (!existing || action.event.created_at > existing.createdAt) {
    return {
      ...state,
      profiles: new Map([...state.profiles, [action.event.pubkey, profile]]),
    }
  }
  return state
}
```

**Relay limit for kind:0:** Relays accepting 21 authors in a single filter is well within normal relay limits. NIP-01 places no hard bound; all 4 default relays (damus, nos.lol, nostr.band, primal) are general-purpose and support multi-author queries. `[ASSUMED]` — confirm against live relays if profile resolution is incomplete.

---

### Pattern 6: Plain-React Context + Reducer (D-11)

**What:** A `NostrContext` provides `articles`, `profiles`, `status`, and `refetch()`. A `useReducer` handles all state transitions. A `NostrProvider` component wraps the app.

**High-frequency streaming concern:** With 21 articles arriving in rapid succession, each `dispatch(ARTICLE_RECEIVED)` triggers a re-render. React 19 batches `setState` calls from within a single synchronous handler (including event callbacks) via automatic batching. `onevent` callbacks are called one at a time by `_onmessage` on the WebSocket, so each fires a separate `dispatch`, which in React 19 is automatically batched across multiple rapid calls within the same microtask tick.

In practice with 21 articles, 21 re-renders is acceptable. React 19's concurrent renderer schedules these efficiently. No `unstable_batchedUpdates` wrapper needed.

**Context setup:**

```typescript
// src/context/NostrContext.tsx

type NostrState = {
  articles: Article[]
  seenCoords: Set<string>
  profiles: Map<string, Profile>
  status: 'streaming' | 'done' | 'empty' | 'error'
  fetchKey: number  // increments on refetch() to re-trigger useEffect
}

type NostrAction =
  | { type: 'ARTICLE_RECEIVED'; event: Event }
  | { type: 'PROFILE_RECEIVED'; event: Event }
  | { type: 'SET_STATUS'; status: NostrState['status'] }
  | { type: 'RESET' }

function nostrReducer(state: NostrState, action: NostrAction): NostrState {
  switch (action.type) {
    case 'RESET':
      return { ...initialState, fetchKey: state.fetchKey + 1 }
    case 'ARTICLE_RECEIVED': { /* Pattern 4 above */ }
    case 'PROFILE_RECEIVED': { /* Pattern 5 above */ }
    case 'SET_STATUS':
      return { ...state, status: action.status }
  }
}

type NostrContextValue = NostrState & { refetch: () => void }

const NostrContext = createContext<NostrContextValue | null>(null)

export function NostrProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(nostrReducer, initialState)
  const refetch = useCallback(() => dispatch({ type: 'RESET' }), [])

  // Hooks run inside Provider — they read dispatch and state from closure
  useArticleFetch(state.fetchKey, dispatch, state)
  useProfileFetch(
    useMemo(
      () => [...new Set(state.articles.map(a => a.pubkey))],
      [state.articles]
    ),
    dispatch
  )

  const value = useMemo(
    () => ({ ...state, refetch }),
    [state, refetch]
  )

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
}

export function useNostr() {
  const ctx = useContext(NostrContext)
  if (!ctx) throw new Error('useNostr must be used inside <NostrProvider>')
  return ctx
}
```

**Subscription teardown on refetch (D-12):**

`RESET` increments `fetchKey`. The `useArticleFetch` effect depends on `fetchKey`, so React runs the cleanup (calls `sub.close()`) and re-runs the effect with a new subscription. This is the correct React idiom — no need to manually track the previous subscription across re-renders.

---

### Pattern 7: NIP-23 Parsing with Fallbacks (D-10)

**NIP-23 tag guarantee level (from spec — ASSUMED; NIP-23 text not fetched in this session but consistent with prior research):**

| Tag | Required? | Notes |
|-----|-----------|-------|
| `d` | YES (implied by NIP-33 addressable events) | Missing `d` → cannot form coordinate → skip event |
| `title` | Optional | Display fallback: `'Untitled'` |
| `summary` | Optional | Display fallback: `''` |
| `image` | Optional | Display fallback: `undefined` |
| `published_at` | Optional | Display fallback: `event.created_at` |
| `t` | Optional, multi-value | Normalize to `string[]` lowercased |

**Safe extraction pattern:**

```typescript
// src/lib/nostr.ts
import type { Event } from 'nostr-tools/core'

export function articleCoordinate(event: Event): string {
  const d = event.tags.find(t => t[0] === 'd')?.[1] ?? ''
  return `${event.kind}:${event.pubkey}:${d}`
}

export function parseArticle(event: Event): Article {
  const tags = event.tags
  const d = tags.find(t => t[0] === 'd')?.[1] ?? ''
  const title = tags.find(t => t[0] === 'title')?.[1]?.trim() || undefined
  const summary = tags.find(t => t[0] === 'summary')?.[1]?.trim() || undefined
  const image = tags.find(t => t[0] === 'image')?.[1]?.trim() || undefined

  const publishedAtRaw = tags.find(t => t[0] === 'published_at')?.[1]
  const publishedAt = publishedAtRaw
    ? parseInt(publishedAtRaw, 10) * 1000  // NIP-23 stores Unix seconds
    : event.created_at * 1000

  const hashtags = tags
    .filter(t => t[0] === 't' && t[1])
    .map(t => t[1].toLowerCase().trim())
    .filter(Boolean)

  return {
    id: event.id,
    pubkey: event.pubkey,
    coordinate: articleCoordinate(event),
    d,
    title,         // undefined when absent — Phase 3 supplies display fallback
    summary,
    image,
    publishedAt,  // always a number (ms epoch)
    createdAt: event.created_at * 1000,
    content: event.content,
    hashtags,
  }
}

export function parseProfile(event: Event): Profile {
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(event.content)
  } catch {
    // Malformed JSON — use empty object, fallbacks apply
  }

  // NIP-24 field priority: display_name → name; also check camelCase variant
  const displayName =
    (data.display_name as string | undefined)?.trim() ||
    (data.displayName as string | undefined)?.trim() ||
    (data.name as string | undefined)?.trim() ||
    undefined

  const picture = (data.picture as string | undefined)?.trim() || undefined

  return {
    pubkey: event.pubkey,
    displayName,
    picture,
    createdAt: event.created_at,
  }
}
```

**`d`-tag absence:** If `d` is missing (malformed event), `articleCoordinate` returns `"30023:pubkey:"`. This creates a degenerate but non-crashing coordinate. In practice, skip events with empty `d` to avoid collisions. Add `if (!d) return` before `dispatch(ARTICLE_RECEIVED)` in the `onevent` handler.

---

### Anti-Patterns to Avoid

- **Pool in component state or useEffect body:** Creates duplicate subscriptions in StrictMode dev. Module-level only.
- **Derive status from loading flags rather than relay outcomes:** The `empty` vs `error` distinction requires per-relay outcome tracking. A simple `loading: boolean` is insufficient.
- **Calling `sub.close()` inside `onevent`:** The close handle is async (awaits `allOpened`). Safe to call but don't rely on it being synchronous. Set a `frozen` flag immediately; let the async close follow.
- **Opening one kind:0 subscription per article:** 21 authors × 4 relays = 84 WebSocket messages. Batch.
- **Forgetting to reset `seenCoords` on `RESET`:** On `refetch()`, the coordinate set must clear or previously-seen articles can never reappear in a fresh fetch.
- **`parseInt` without radix on `published_at`:** NIP-23 stores Unix seconds as a decimal string. Use `parseInt(str, 10)`.
- **Storing derived state (parsedArticles, facets) in the reducer:** Only raw/normalized data belongs in the reducer. `useMemo` derives everything else in Phase 3.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-relay WebSocket multiplexing | Custom WebSocket manager | `SimplePool` from `nostr-tools/pool` | Pool handles connection reuse, URL dedup, per-relay EOSE tracking, reconnect backoff |
| Event signature verification | Custom secp256k1 verify | Built into SimplePool (all events verified before `onevent` fires) | Pool silently drops invalid events via `oninvalidevent` path |
| NIP-19 npub encoding | Custom bech32 encoder | `npubEncode(pubkey)` from `nostr-tools/nip19` | Correct bech32m implementation, proper HRP |
| Per-relay EOSE timeout | Custom `Promise.race` | `maxWait` parameter in `subscribeMany` | `maxWait` is passed as `eoseTimeout` to each `Subscription`; fires `receivedEose()` which unblocks the EOSE aggregation cleanly |

**Key insight:** The pool handles the hardest parts of multi-relay Nostr: WebSocket lifecycle, message parsing, event verification, deduplication-by-id across relays, and per-relay EOSE coordination. Build only the application-layer logic on top.

---

## Fallback Timer Guidance (Claude's Discretion — D-04)

**Context:** Render no longer depends on the timer. The timer's only job is: (a) force-close subscriptions that never EOSE or never trigger `onclose` naturally, and (b) backstop the status transition to `empty`/`error` if zero events arrive.

**nostr-tools built-in timeout:** `Subscription.baseEoseTimeout` defaults to **4400ms** per relay. When `maxWait` is passed to `subscribeMany`, it overrides this with `eoseTimeout: params.maxWait` for each relay. So `maxWait` already handles the per-relay EOSE timeout.

**Recommendation:**

| Timer | Value | Rationale |
|-------|-------|-----------|
| `maxWait` for article subscription | `8000` ms | Gives all 4 relays up to 8s to EOSE. Covers slow relays. After this, `onclose` fires and status resolves. |
| `maxWait` for profile subscription | `5000` ms | Profiles are smaller; 5s is ample. Profiles are also non-blocking (D-08). |
| Backstop `setTimeout` in hook | `9000` ms | Only fires if `onclose` somehow never fires (e.g. partial allOpened failure). Calls `sub.close()` as last resort. |

**`[ASSUMED]`** — exact values need live validation against the 4 relays. The `maxWait` mechanism makes a separate explicit fallback timer mostly redundant for the status-resolution use case, but the 9s backstop is cheap insurance.

---

## Per-Relay `limit` Guidance (Claude's Discretion)

**Why over-fetch:** Relays interpret `limit` per-relay. With 4 relays each returning up to N events, the merged stream before dedup has up to 4N events. With the hard-freeze at 21, the goal is to ensure the stream provides enough candidates for 21 distinct coordinates.

**Tradeoff table:**

| `limit` value | Events in flight (pre-dedup) | Overhead | Risk |
|---------------|------------------------------|----------|------|
| 21 | ~84 | None | FAILS if relays have <21 unique articles or if one relay dominates with duplicates |
| 50 | ~200 | Low | May still under-deliver if articles are sparse across relays |
| 100 | ~400 | Moderate | Prior research recommendation; sufficient for most relay populations |
| 200 | ~800 | Higher | Overkill for 4 well-populated relays |

**Recommendation:** `limit: 100` per prior research. The hard-freeze stops processing once 21 articles are shown, so the additional candidates are discarded in the `frozen` guard — no rendering cost.

---

## Common Pitfalls

### Pitfall 1: EOSE Aggregation Semantics

**What goes wrong:** Developers assume `oneose` fires when the first relay EOSEs. It fires when ALL relays have EOSE'd (or their `maxWait` expired). If one relay never sends EOSE and `maxWait` is not set, `oneose` never fires.

**Root cause (verified from source):** `subscribeMap` maintains a boolean array `eosesReceived[]`. `handleEose(i)` sets `eosesReceived[i] = true`. `params.oneose?.()` fires only when `eosesReceived.filter(a => a).length === groupedRequests.length`.

**How to avoid:** Always pass `maxWait`. This sets `eoseTimeout` on each `Subscription`, which fires `receivedEose()` after the timeout regardless of whether the relay actually sent EOSE.

**Warning signs:** `oneose` and `onclose` never called; subscription remains open indefinitely.

---

### Pitfall 2: `onclose` Array Length vs RELAYS Length

**What goes wrong:** Developer checks `reasons[0]` to determine if "any relay errored" without knowing which index maps to which relay.

**Root cause:** `onclose(reasons)` array indices match `groupedRequests` array indices, which is derived from the relay URL dedup in `subscribe()`. Since RELAYS has no duplicates, `reasons[i]` maps to `RELAYS[i]`. But if a relay URL fails during `ensureRelay`, `handleClose(i, err.message)` is called and the corresponding index gets an error string.

**How to avoid:** Zip `RELAYS` with `reasons` to build the outcome map by URL, not by index:

```typescript
onclose(reasons: string[]) {
  RELAYS.forEach((url, i) => {
    const reason = reasons[i] ?? 'no reason'
    relayOutcomes.set(url, classifyRelayClose(reason))
  })
}
```

---

### Pitfall 3: Coordinate Set Not Reset on refetch()

**What goes wrong:** User clicks the retry button (`refetch()`). `RESET` action fires, but `seenCoords` is accidentally not cleared. All previously-seen articles are rejected by the dedup guard, resulting in 0 articles on the second attempt even if relays respond correctly.

**How to avoid:** The `RESET` action must return the full `initialState` (with empty `seenCoords` and `articles: []`). Increment `fetchKey` from the reset, not from initialState.

---

### Pitfall 4: Profile `createdAt` Logic Inverted

**What goes wrong:** Profile reducer keeps the oldest event rather than the newest, because the comparison is `>=` instead of `>`.

**Correct check:**
```typescript
if (!existing || action.event.created_at > existing.createdAt) {
  // Accept newer profile
}
```

---

### Pitfall 5: `sub.close()` Called Before `allOpened` Resolves

**What goes wrong:** The `SubCloser.close()` returned by `subscribeMany` is `async` — it awaits `allOpened` before calling `sub.close()` on each relay subscription. Calling it immediately on mount (e.g., in the same tick as the subscription is created) may result in close executing before any relay connection is established, silently doing nothing.

**Root cause (verified from source):** `subscribeMap` returns `{ async close(reason) { await allOpened; subs.forEach(s => s.close(reason)) } }`.

**How to avoid:** Only call `sub.close()` from the `useEffect` cleanup or from the freeze guard (which fires after `onevent` has already received events, so connections are open). Do not call it synchronously during setup.

---

## Code Examples

### Complete TypeScript Types

```typescript
// src/types/nostr.ts
// [ASSUMED] — types designed based on NIP-23 spec and project decisions

export type NostrStatus = 'streaming' | 'done' | 'empty' | 'error'

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

export type RelayOutcome = 'pending' | 'clean' | 'error'
```

### Subscription Filter

```typescript
// Source: verified Filter type from nostr-tools/filter
// [VERIFIED: nostr-tools 2.23.5 extracted source]

// Article filter
{ kinds: [30023], limit: 100 }

// Profile filter (post-article-freeze)
{ kinds: [0], authors: [...new Set(articles.map(a => a.pubkey))] }
```

### npub Fallback for Display Name

```typescript
// Source: nostr-tools/nip19 exports npubEncode
// [VERIFIED: nip19.d.ts extracted source]
import { npubEncode } from 'nostr-tools/nip19'

function displayName(profile: Profile | undefined, pubkey: string): string {
  return profile?.displayName ?? npubEncode(pubkey).slice(0, 12) + '...'
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `querySync` collect-then-render | `subscribeMany` streaming with `onevent` | D-01 user decision | Articles appear progressively; UX improvement |
| Zustand store | React context + useReducer | D-11 user decision | Fewer dependencies; simpler mental model for this scale |
| Sort-then-slice 21 | Hard-freeze at first 21 | D-02 user decision | No sorting needed; simpler implementation |
| `loadingProfiles: boolean` gate | Per-article optional `profile?` upgrade | D-08 user decision | Cards render immediately; profiles appear as they arrive |

**nostr-tools API note:** In 2.23.5, `subscribeMany` and `subscribe` are identical (one calls the other). Use `subscribeMany` for readability. `querySync` is still valid for the collect-then-render pattern but superseded by D-01. `subscribeManyEose` and `subscribeEose` are also identical aliases.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Close reason strings contain "eose" for clean closes | Pattern 3, Per-Relay Tracking | Wrong classification of clean vs error relays; wrong status resolution. Mitigation: check actual reason strings in dev console on first integration test |
| A2 | All 4 default relays accept `authors: [≤21 pubkeys]` in a single kind:0 filter | Pattern 5, Profile Batching | Profile resolution fails silently; cards show pubkey fallback forever. Mitigation: test live against all 4 relays |
| A3 | NIP-23 `published_at` stores Unix seconds (not ms) as a string | Pattern 7, NIP-23 Parsing | Off-by-1000 timestamp display. Consistent with NIP-23 spec and prior research |
| A4 | React 19 automatic batching handles rapid `onevent` dispatches without thrash | Pattern 6, Streaming State | Visible jank on article load. Mitigation: test in dev with actual relay traffic |
| A5 | `onclose(reasons)` array indices match `RELAYS` array order | Pattern 3, Per-Relay Tracking | Wrong relay attributed to outcome. Mitigated: source-verified that `subscribe()` preserves relay order via `uniqUrls` push order |
| A6 | Exact fallback timer values (8000ms, 5000ms) are appropriate for the 4 default relays | Fallback Timer Guidance | Either too aggressive (cuts off slow but healthy relays) or too conservative (delays empty/error state). Needs live relay testing |

---

## Open Questions

1. **`onclose` reason string content for connection failures**
   - What we know: Source shows `handleClose(i, err?.message || String(err))` for connection failures; `"connection failed"`, `"connection timed out"`, `"websocket closed"` are the relay-level reasons
   - What's unclear: Exact reason string when a relay sends a NIP-01 CLOSED message vs a WebSocket error — both arrive as non-"eose" strings but have different semantics
   - Recommendation: Log reason strings in dev during first integration and verify classification logic; adjust regex/includes checks as needed

2. **Profile subscription timing: trigger on first article or wait for freeze?**
   - What we know: D-09 says "subscribe to profiles for the authors of rendered articles"; freeze happens at ≤21
   - What's unclear: Should useProfileFetch re-subscribe as pubkeys grow (before freeze), or wait until frozen?
   - Recommendation: Subscribe when `articles.length > 0` using the current pubkey set as the dependency. With small article counts and React batching, re-subscribing on each new pubkey is bounded by 21 iterations. Simpler: wait for the freeze (`status === 'done'`) to subscribe once with the final pubkey set, accepting that profiles lag articles slightly.

3. **`d` tag absent in otherwise valid kind:30023 events**
   - What we know: NIP-33 requires `d` for addressable events; in practice some clients omit it
   - What's unclear: How common is this in the wild across these 4 relays?
   - Recommendation: Skip events with absent/empty `d` tag in `onevent` before dispatch (one-line guard); don't let degenerate coordinates pollute the freeze count

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | ✓ | (project already builds) | — |
| npm | Package install | ✓ | (project uses npm) | — |
| Browser WebSocket API | nostr-tools SimplePool | ✓ (browser) | Native | — |
| nostr-tools@2.23.5 | Data layer | ✗ (not yet installed) | — | Must install |
| Live relay access | Integration testing | Unknown | — | Cannot unit-test relay responses; manual testing required |

**Missing dependencies with no fallback:**
- `nostr-tools@2.23.5` — must be installed before any Phase 2 code runs (`npm install nostr-tools`)

**Missing dependencies with fallback:**
- Live relay access for integration testing — pure functions (`parseArticle`, `dedupeArticle`, `classifyRelayClose`) are unit-testable in isolation without relay access

---

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Read-only relay access; no user auth |
| V3 Session Management | No | No sessions; no cookies |
| V4 Access Control | No | Read-only; all data is public Nostr events |
| V5 Input Validation | YES | All relay-supplied content is untrusted input |
| V6 Cryptography | No (consumed) | nostr-tools verifies signatures internally |

### Known Threat Patterns for Nostr relay data layer

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSON in kind:0 profile content | Tampering / DoS | `try/catch` around `JSON.parse(event.content)`; fallback to empty profile |
| Event with missing required fields (no `id`, `pubkey`, `sig`) | Tampering | SimplePool verifies every event signature before `onevent` fires; invalid events go to `oninvalidevent` |
| Malicious `d` tag with path-traversal or injection characters | Tampering | `d` tag is only used as a Map key and display string; no filesystem or SQL operations; safe as-is |
| `published_at` with extreme future/past timestamp | Tampering | Display only; no business logic depends on timestamp ordering in Phase 2; Phase 3 display should clamp or use `created_at` as fallback |
| Relay injecting events for kinds other than 30023 / 0 | Spoofing | SimplePool's per-subscription `matchFilters` check silently drops non-matching events |
| HTTP `picture` URLs on HTTPS Pages site | Information Disclosure | Mixed-content block in browser; Phase 3's `<img>` tag must have `onError` fallback; consider upgrading `http://` to `https://` in `parseProfile` |
| XSS via article `content` Markdown | Injection | Phase 2 does not render Markdown (Phase 4 concern); `content` stored as raw string — safe |
| Relay URL confusion (if relay list were user-supplied) | SSRF | Not applicable in v1 (fixed relay list in `lib/pool.ts`) |

**Phase 2 security boundary:** This phase only parses and normalizes data. It never renders HTML. The XSS surface from article `content` is entirely a Phase 4 (Markdown rendering) concern. The only Phase 2 security actions are the `JSON.parse` guard in `parseProfile` and trusting SimplePool's built-in event verification.

---

## Project Constraints (from CLAUDE.md)

- **Use existing shadcn/ui components only** — Phase 2 has no new UI; only reuses `<BootSequence>` from Phase 1 as the streaming loading state. No new shadcn components needed.
- **nostr-tools subpath imports** — `nostr-tools/pool`, `nostr-tools/kinds`, `nostr-tools/nip19`; never `import { ... } from 'nostr-tools'` (root barrel defeats tree-shaking).
- **No backend / no env secrets** — All fetching client-side via browser WebSocket.
- **Static site on GitHub Pages** — No SSR; all hooks run in the browser.
- **Terminal aesthetic** — No new visual tokens needed in Phase 2; streaming state reuses `<BootSequence>` with custom `lines` prop.

---

## Sources

### Primary (HIGH confidence)
- `nostr-tools@2.23.5` extracted source (`lib/esm/abstract-pool.js`, `lib/esm/pool.js`, `lib/types/abstract-pool.d.ts`, `lib/types/abstract-relay.d.ts`, `lib/types/pool.d.ts`, `lib/types/filter.d.ts`, `lib/types/kinds.d.ts`, `lib/types/nip19.d.ts`) — all API signatures and runtime behaviors verified by reading source directly
- `.planning/phases/02-nostr-data-layer/02-CONTEXT.md` — locked decisions D-01 through D-12
- `.planning/research/ARCHITECTURE.md` — prior patterns (adapted for plain-React; Zustand references superseded)
- `.planning/research/PITFALLS.md` — EOSE hang, dedup, optional tags, profile JSON guard

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — pinned nostr-tools version, subpath import guidance
- `.planning/research/SUMMARY.md` — relay flag: EOSE timeout tuning and batch kind:0 limits need live validation
- NIP-23 (via prior research) — tag optionality rules; only `d` required

### Tertiary (LOW confidence / ASSUMED)
- Fallback timer values (8000ms, 5000ms) — [ASSUMED] based on relay behavior knowledge from training; needs live validation
- Close reason string content for connection failures — [ASSUMED] based on source inspection; confirm in dev console
- Relay acceptance of 21-author kind:0 filter — [ASSUMED]; no live relay test performed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nostr-tools 2.23.5 source extracted and read directly
- Architecture: HIGH — all key API shapes, callback signatures, and mechanics verified from source
- Pitfalls: HIGH — root causes traced to actual source code
- Timer values: LOW — need live relay validation

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (nostr-tools 2.x is stable; API unlikely to change in 30 days)
