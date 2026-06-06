# Phase 2: Nostr Data Layer - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the client-only Nostr data layer that powers the reader: connect to the four
default relays over WebSocket, **stream** kind:30023 articles into a normalized,
deduplicated article model (capped at 21), batch-resolve author kind:0 profiles, and
expose a clean status/state surface for Phase 3 to render against.

This phase is **pure data plumbing — no article UI, no cards, no facets, no Markdown
rendering** (those are Phase 3+). The only visible behavior is reusing the Phase 1
boot-sequence component as the streaming/loading aesthetic.

Covers requirements **DATA-01** (connect to 4 default relays), **DATA-02** (21 most
recent — see relaxation note below), **DATA-03** (dedup by `kind:pubkey:d` — see
relaxation note), **DATA-04** (timeout so a hung relay never blocks), **DATA-05** (batch
kind:0 profile resolution), **DATA-06** (NIP-23 parse with optional-tag fallbacks).

> ⚠ **Requirement deltas flagged for `/gsd-transition`** (user-directed, see D-02/D-03):
> - **DATA-02** ("21 most recent, newest-first") is **relaxed** to "the **first 21 distinct
>   articles to arrive**, in arrival order." Streaming + hard-freeze means the visible set
>   is not guaranteed to be the globally-newest 21.
> - **DATA-03** ("keep the newest `created_at`") is **relaxed** to "**first-arriving version
>   wins**" under the hard-freeze. Dedup-by-coordinate is still enforced (no duplicate cards),
>   but a later-arriving newer version of an already-shown article is ignored.

</domain>

<decisions>
## Implementation Decisions

### Fetch model — streaming, not collect-then-render (DATA-02, DATA-04)
- **D-01:** **Render-on-arrival.** Articles are surfaced the moment events stream in via
  `onevent` — the layer does **not** wait for EOSE or any timer before exposing data. This
  overrides the research/ARCHITECTURE "collect all → dedupe → slice 21 → render" one-shot
  pattern.
- **D-02:** **Hard-freeze at the first 21 distinct articles.** Once 21 unique articles
  (unique `kind:pubkey:d` coordinates) have been accumulated, the list is locked in arrival
  order. Later events — even newer articles or newer versions of shown articles — are
  ignored. _(Relaxes DATA-02; flagged above.)_
- **D-03:** **Dedup-by-coordinate still applies during streaming** so the same article
  arriving from multiple relays never occupies two of the 21 slots and never renders twice.
  Under the freeze, the **first-arriving version** of a coordinate is the one kept.
  _(Relaxes DATA-03 "keep newest"; flagged above.)_

### Timer / cleanup role (DATA-04)
- **D-04:** The fallback timer **no longer gates rendering**. It governs only:
  (a) **cleanup** — close subscriptions so WebSockets don't leak; and
  (b) **empty/error resolution** — if zero events ever arrive, flip the layer to `empty`
  or `error` (see D-06).
- **D-05:** **Stop the stream early.** As soon as 21 articles are shown, the layer
  proactively closes the article subscriptions rather than waiting for the timer. (Timer
  remains the backstop for the zero/slow case.)

### Status surface for Phase 3 (DATA-04, feeds DISP-05)
- **D-06:** Article fetch exposes an explicit phase: **`streaming → done | empty | error`**.
  - `streaming` — subscription(s) open; some cards may already be visible.
  - `done` — ≥1 article collected and the stream stopped (froze at 21, or all relays EOSE'd).
  - `empty` — resolved with **zero** events while ≥1 relay responded cleanly (relays fine, no articles).
  - `error` — resolved with **zero** events and **every** relay errored/closed.
- **D-07:** **Track per-relay outcome** (events received / EOSE-with-zero / connection
  error) to compute the `empty` vs `error` distinction accurately. `error` = ALL relays
  errored; `empty` = ≥1 relay returned cleanly but total events = 0. This also lays the
  groundwork for a future per-relay status indicator (v2 ENRICH-03 — not built here).

### Profile resolution (DATA-05, DATA-06)
- **D-08:** **Per-article optional profile.** Each article exposes `profile?: Profile`.
  Cards (Phase 3) render immediately with a pubkey/npub fallback and **upgrade in place**
  as kind:0 events stream in. **No global `loadingProfiles` gate** blocks article display.
- **D-09:** **Subscribe to profiles for the authors of rendered articles** (don't gate on
  the freeze). Planner MUST **batch pubkeys** into as few subscriptions as possible —
  avoid one-subscription-per-author (ARCHITECTURE anti-pattern #3). Reconcile "subscribe as
  articles render" with batching (e.g., a single batched kind:0 subscription over the
  rendered pubkey set, since the set is small and freezes at ≤21).
- **D-10:** **NIP-23 parse with fallbacks everywhere** — only `d` is guaranteed. Missing
  `title` / `summary` / `image` / `published_at` must still produce a valid article record
  (no crash, no blank-field exceptions). Exact display fallbacks (e.g. title text) are a
  Phase 3 concern; Phase 2 just guarantees a non-crashing normalized record.

### State management & lifecycle
- **D-11:** **Plain React (hooks + context)** holds the streaming article/profile state —
  **no Zustand.** Keeps the lean, zero-backend, minimal-dependency ethos. Streaming updates
  via `setState`/reducer as events arrive. _(Diverges from ARCHITECTURE.md, which assumed a
  Zustand store — the planner must adapt that wiring; the singleton-`SimplePool`,
  two-stage-fetch, derived-`useMemo`, and anti-pattern guidance from ARCHITECTURE.md all
  still apply.)_
- **D-12:** **Expose `refetch()`** — resets state and re-opens the stream — so Phase 3 can
  wire a retry affordance on the `error` / `empty` state.

### Locked-by-research (carried forward, not re-litigated)
- nostr-tools **`SimplePool`** as a **module-level singleton** (never in React
  state/StrictMode-safe); subpath imports for tree-shaking.
- Default relay set: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`,
  `wss://relay.primal.net`.
- Lowercase/normalize `t` tag values in the parsed model (consumed by Phase 4 facets).
- Over-fetch with a per-relay `limit` (research used `limit: 100`) so the stream has enough
  candidates to reach 21 distinct articles — exact value is Claude's discretion / research.

### Claude's Discretion
- Exact fallback-timer duration(s) and any per-stage tuning — research flagged this needs
  live validation against the 4 relays. Render no longer depends on it, so it only bounds
  the zero-result wait.
- Per-relay `limit` value for the article filter.
- Exact module/file layout (the planner may adapt ARCHITECTURE.md's `lib/`/`hooks/`
  structure to the plain-React-context decision; `store/nostrStore.ts` becomes a
  context/provider).
- The precise batching mechanism for the kind:0 profile subscription, within the
  "few-as-possible / no per-author sub" guardrail (D-09).
- Concrete TypeScript shapes for `Article`, `Profile`, and the status object.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — product definition, constraints (zero backend, lean bundle), Key Decisions
- `.planning/REQUIREMENTS.md` §DATA-01…DATA-06 — locked requirement text (note DATA-02/03 deltas above)
- `.planning/ROADMAP.md` §"Phase 2: Nostr Data Layer" — goal + 5 success criteria

### Research (data layer is the highest-risk layer — read closely)
- `.planning/research/SUMMARY.md` §"Phase 2" + §"Research Flags" — relay EOSE timeout tuning
  and batch kind:0 query limits need live validation against the 4 relays
- `.planning/research/ARCHITECTURE.md` — `SimplePool` singleton, two-stage fetch, dedup-by-coordinate
  semantics, anti-patterns #1–#5 (esp. #3 one-sub-per-profile, #4 no-timeout). **Note:** the
  Zustand store and "collect-then-render"/"sort-newest-21" assumptions are superseded by
  D-01/D-02/D-11 — apply everything else.
- `.planning/research/PITFALLS.md` #1 (EOSE hang), #2 (addressable dedup), #3 (optional NIP-23 tags)
- `.planning/research/STACK.md` — pinned `nostr-tools` version + subpath import guidance

### Prior phase
- `.planning/phases/01-scaffold-deploy/01-CONTEXT.md` — D-07 boot-sequence built as the
  reusable loading aesthetic (reuse for the `streaming` state)

### Project guidance
- `CLAUDE.md` — tech stack, "use existing shadcn components" rule, nostr-tools subpath-import rule

No additional user-supplied external specs/ADRs were referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/BootSequence.tsx` (Phase 1, D-07) — built explicitly as a reusable
  loading aesthetic; intended to back the `streaming` state of the article fetch.
- `src/components/ui/card.tsx` — shadcn Card (Phase 3 will consume; not used in Phase 2).
- `src/App.tsx` — currently renders `<BootSequence />` as a placeholder; this is the
  integration seam where the data hook/provider gets wired in.

### Established Patterns
- Terminal theme tokens + monospace-everywhere from Phase 1 (no new UI in this phase).
- `nostr-tools` is **not yet installed** — the planner adds it (subpath imports per STACK.md).

### Integration Points
- New data layer (hook + context provider, per D-11) mounts at/near `<App />`; Phase 3 reads
  articles/profiles/status from it. `refetch()` (D-12) is exposed for a later retry button.

</code_context>

<specifics>
## Specific Ideas

- User's own framing of the fetch model: *"Render as soon as any events are received from
  relays. Do not wait for anything. Stop adding any new events to the view layer once we
  have received 21."* and *"Profiles should render whenever they arrive; we should subscribe
  to profiles for any article that is rendered."*
- The boot-sequence component should visibly back the `streaming` state, not just a generic spinner.

</specifics>

<deferred>
## Deferred Ideas

- **Per-relay connection status indicator** (v2 ENRICH-03) — the per-relay outcome tracking
  (D-07) makes this cheap later, but it is **not** built in Phase 2.
- **Live updates / newer-article bumping** — the "bump to keep 21-most-recent" behavior was
  explicitly declined in favor of hard-freeze (D-02). Could revisit if a "refresh for newer"
  UX is wanted post-v1.
- **User-configurable relay set & adjustable feed length** (v2 CONF-01/CONF-02) — relay set
  stays fixed at 4, count fixed at 21.

None of the above expand Phase 2 scope.

</deferred>

---

*Phase: 2-Nostr Data Layer*
*Context gathered: 2026-06-06*
