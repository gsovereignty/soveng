# Phase 2: Nostr Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 2-Nostr Data Layer
**Areas discussed:** Timeout & partial results, Status signals to Phase 3, State management & refetch

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Timeout & partial results | Wait budget + slow/failed relay handling | ✓ |
| Completeness of '21 most recent' | Over-fetch aggressiveness | (skipped — resolved per research default: over-fetch with per-relay `limit`) |
| Status signals to Phase 3 | States exposed for loading/error/empty/partial | ✓ |
| State mgmt & refetch | Zustand vs plain React; refetch() | ✓ |

---

## Timeout & partial results

### Q1 — Timeout / render gating

| Option | Description | Selected |
|--------|-------------|----------|
| 8s / 5s fixed (research default) | Wait up to 8s articles / 5s profiles, then close & render | |
| Shorter (5s / 3s) | Snappier paint, higher chance of cutting a slow-but-alive relay | |
| Settle-based | Render when N relays EOSE or a hard cap | |
| (User free-text) | Render-on-arrival; do not wait for anything | ✓ |

**User's choice:** "Render as soon as any events are received from relays. Do not wait for
anything. Stop adding any new events to the view layer once we have received 21."
**Notes:** Streaming model overrides the research "collect-then-render" one-shot pattern.

### Q2 — When timeout fires / relays fail

**User's choice:** "Timeout is not relevant to rendering." → resolved separately below (timer
role narrowed to cleanup + empty/error).

### Q3 — After 21 shown, a newer article arrives

| Option | Description | Selected |
|--------|-------------|----------|
| Bump to keep 21-most-recent | Newer article pushes oldest out; newer version replaces stale in place | |
| Hard freeze at first 21 | First 21 distinct articles locked in arrival order; later events ignored | ✓ |
| Let me explain | — | |

**User's choice:** Hard freeze at first 21.
**Notes:** Relaxes DATA-02 (not guaranteed globally-newest 21) and DATA-03 (first-arriving
version wins, not newest). Dedup-by-coordinate retained to prevent duplicate cards. Flagged
for `/gsd-transition`.

### Q4 — Fallback timer role

| Option | Description | Selected |
|--------|-------------|----------|
| Cleanup + empty/error only | Timer closes sockets + flips to empty/error on zero events | |
| Also stop the stream early | Above, plus close subscriptions immediately once 21 shown | ✓ |

**User's choice:** Also stop the stream early.

---

## Status signals to Phase 3

### Q1 — Article fetch phase exposed

| Option | Description | Selected |
|--------|-------------|----------|
| streaming → done/empty/error | Explicit phases; reuse boot-sequence loader while streaming | ✓ |
| Just loading boolean + error | Single bool + error flag | |

**User's choice:** streaming → done/empty/error.

### Q2 — Error vs empty distinction

| Option | Description | Selected |
|--------|-------------|----------|
| Track per-relay outcome | error = ALL relays errored; empty = ≥1 clean but 0 events; enables future per-relay status | ✓ |
| Coarse: zero-events + any-error flag | Lighter, slightly less precise | |

**User's choice:** Track per-relay outcome.

### Q3 — Missing/slow profiles

| Option | Description | Selected |
|--------|-------------|----------|
| Per-article optional profile | `profile?`; render with npub fallback, upgrade in place; no global gate | ✓ |
| Global profiles-loading gate | `loadingProfiles` bool could hold author display | |

**User's choice:** "Profiles should render whenever they arrive, we should subscribe to
profiles for any article that is rendered."
**Notes:** Per-article optional profile + subscribe for rendered articles' authors. Planner
must batch pubkeys (avoid one-sub-per-author, ARCHITECTURE anti-pattern #3).

---

## State management & refetch

### Q1 — Where state lives

| Option | Description | Selected |
|--------|-------------|----------|
| Plain React (hooks + context) | Zero new deps; fits lean ethos; fine at this scale | ✓ |
| Zustand (research rec) | Store outside React tree; +1 dep | |

**User's choice:** Plain React (hooks + context).
**Notes:** Diverges from ARCHITECTURE.md's assumed Zustand store — planner adapts wiring;
other ARCHITECTURE guidance (singleton pool, two-stage fetch, anti-patterns) still applies.

### Q2 — Expose refetch()?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, expose refetch() | Reset + re-open stream; Phase 3 retry button | ✓ |
| No, fetch-once on mount | Reload page to retry | |

**User's choice:** Yes, expose refetch().

---

## Claude's Discretion

- Fallback-timer duration(s) (render no longer depends on it; bounds only the zero-result wait).
- Per-relay `limit` value for the article filter (over-fetch to reach 21 distinct).
- File/module layout adapting ARCHITECTURE.md to plain-React-context.
- kind:0 profile subscription batching mechanism (within no-per-author guardrail).
- Concrete TypeScript shapes for Article / Profile / status.

## Deferred Ideas

- Per-relay connection status indicator (v2 ENRICH-03) — enabled cheaply by per-relay tracking, not built now.
- Live updates / "bump to keep newest 21" — explicitly declined for hard-freeze; possible post-v1 "refresh for newer" UX.
- User-configurable relays & adjustable feed length (v2 CONF-01/CONF-02).
