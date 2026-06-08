---
phase: 02-nostr-data-layer
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/types/nostr.ts
  - src/lib/pool.ts
  - src/lib/nostr.ts
  - src/lib/nostr.test.ts
  - src/context/NostrContext.tsx
  - src/context/nostrReducer.ts
  - src/context/nostrReducer.test.ts
  - src/hooks/useArticleFetch.ts
  - src/hooks/useProfileFetch.ts
  - src/App.tsx
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
resolved:
  - CR-01 (fix 16d042a/91c0726): live count ref + resolveArticleStatus helper — partial results resolve to done
  - CR-02 (fix bf909bf): parseProfile type-guards non-string fields, never throws on hostile input
  - CR-03 (fix 91c0726): backstop dispatches terminal status, double-dispatch guarded by resolved flag
resolution_note: All 3 BLOCKERs fixed and re-reviewed RESOLVED (no new blocker defects). 5 warnings + 3 info remain tracked for a later pass.
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase implements the Nostr data layer: a `SimplePool` singleton, pure NIP-23/profile
parse helpers, a dedup/freeze/reset reducer, a context provider, and two streaming hooks.
The reducer and pure helpers are well-tested and correct in isolation. However, the
runtime wiring in `useArticleFetch` contains a stale-closure bug that will produce wrong
terminal status for the common case (fewer than 21 articles), and `parseProfile` will
throw on hostile relay input — both are correctness defects that directly undermine the
"tolerate slow/unresponsive relays and partial results gracefully" constraint in CLAUDE.md.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `onclose` reads a stale `articleCount` of 0 — status resolves to `empty`/`error` even when articles arrived

**File:** `src/hooks/useArticleFetch.ts:20-58` (specifically the `onclose` handler at lines 38-55, and the dependency array at line 73)

**Issue:** Effect 1 declares dependency `[fetchKey]` only. The `articleCount` parameter is
captured by the `onclose` closure at effect-creation time, when `articleCount` is `0`
(no articles received yet). Articles arrive asynchronously via `dispatch`, but the effect
never re-runs (`articleCount` is intentionally excluded from deps via the eslint-disable),
so the closure's `articleCount` stays frozen at `0`.

When relays close (or the 8000ms `maxWait` elapses) and `onclose` fires, the branch at
line 47 `if (articleCount > 0)` evaluates the stale `0`, so it falls through to the
`empty` / `error` branches even though articles were successfully received and rendered.

The only thing masking this for the full-feed case is the Effect 2 freeze watcher
(lines 77-83), which sets `status: "done"` once `articleCount >= 21`. But for any partial
result — e.g. 15 articles, which is exactly the "partial results" scenario CLAUDE.md
requires the app to handle gracefully — the freeze watcher never fires, `onclose` runs
with stale `articleCount = 0`, and the UI shows `[EMPTY] relays responded but no articles
found` despite having 15 articles in state. This is a data-display correctness failure.

**Fix:** Do not read `articleCount` from the effect closure. Read article count from a ref
that tracks the live value, or move the status-resolution decision into the reducer. A ref
approach:

```ts
const countRef = useRef(articleCount)
countRef.current = articleCount   // updated every render

// inside onclose:
if (countRef.current > 0) {
  dispatch({ type: "SET_STATUS", status: "done" })
} else if (allError) {
  dispatch({ type: "SET_STATUS", status: "error" })
} else {
  dispatch({ type: "SET_STATUS", status: "empty" })
}
```

Cleaner still: add a reducer action `RESOLVE_STATUS` that derives `done`/`empty`/`error`
from `state.articles.length` and the relay-outcome summary, so the decision uses live state
instead of a closure snapshot.

---

### CR-02: `parseProfile` throws on non-string profile fields from untrusted relays, crashing the reducer dispatch

**File:** `src/lib/nostr.ts:49-55`

**Issue:** `parseProfile` parses arbitrary JSON from kind:0 events (untrusted, any author
can craft them) and then does `(data.display_name as string | undefined)?.trim()`. The
optional chaining only guards `null`/`undefined`. If a relay returns a profile where
`display_name` (or `displayName`, `name`, `picture`) is a number, boolean, array, or
object, the value is non-nullish, `?.trim` resolves to `undefined`, and calling
`undefined()` throws a `TypeError`.

Example hostile/buggy payload: `{"name": 123}` or `{"picture": ["x"]}`. `(123).trim` is
`undefined`, so `(123 as string)?.trim()` throws at runtime.

`parseProfile` is invoked synchronously inside `nostrReducer` (`PROFILE_RECEIVED`, line 41
of `nostrReducer.ts`). A throw there propagates out of `dispatch`, crashing the React
update — directly violating the CLAUDE.md constraint to "tolerate ... partial results
gracefully" for untrusted relay input. The existing tests only cover valid JSON and
malformed-JSON-string cases; they never test well-formed JSON with wrong-typed fields.

**Fix:** Type-check each field before trimming:

```ts
const asTrimmedString = (v: unknown): string | undefined =>
  typeof v === "string" ? v.trim() || undefined : undefined

const displayName =
  asTrimmedString(data.display_name) ??
  asTrimmedString(data.displayName) ??
  asTrimmedString(data.name)

const picture = asTrimmedString(data.picture)
```

Add a test with `makeProfileEvent("pk", { name: 123, picture: ["x"] })` asserting no throw
and `undefined` fallbacks.

---

### CR-03: `onclose` never fires (and status never resolves) unless EVERY relay closes; one hung relay sticks the app in `streaming`

**File:** `src/hooks/useArticleFetch.ts:38-55`, in combination with `nostr-tools` `subscribeMap` semantics

**Issue:** The status-resolution logic lives entirely inside the `onclose` handler. In
nostr-tools, `subscribeMany` → `subscribeMap`'s `onclose` only fires once
`closesReceived.filter((a) => a).length === groupedRequests.length` — i.e. only when ALL
relays have reported a close reason. If a single relay socket hangs open without sending
EOSE or closing within `maxWait`, `onclose` is never invoked, so `SET_STATUS` is never
dispatched and the UI is stuck on `<BootSequence />` (`status === "streaming"`) forever.

The 9000ms backstop timer (lines 63-65) calls `sub.close("backstop timer fired")`, but
`SubCloser.close()` only tells the relays to close their subscriptions — it does NOT
synthesize an `onclose` callback for relays that never respond. So the backstop does not
guarantee status resolution either. The app's only escape from `streaming` for a partial
hang is the freeze-at-21 watcher, which requires a full 21 articles.

Additionally, `closesReceived.filter((a) => a)` filters by truthiness, so a relay that
closes with an empty-string reason `""` is counted as "not yet closed," compounding the
stall.

**Fix:** Decouple status resolution from `onclose`. Drive a guaranteed terminal transition
from the backstop timer itself (and harmonize it with the live article count from CR-01):

```ts
const timer = setTimeout(() => {
  sub.close("backstop timer fired")
  // Force a status resolution regardless of relay onclose behavior:
  if (countRef.current > 0) dispatch({ type: "SET_STATUS", status: "done" })
  else dispatch({ type: "SET_STATUS", status: "empty" })
}, 9000)
```

Guard against double-dispatch (e.g. a `resolved` flag) so a real `onclose` and the backstop
don't both fire conflicting statuses.

---

## Warnings

### WR-01: `onclose` reason-to-relay index mapping assumes order alignment that nostr-tools does not guarantee

**File:** `src/hooks/useArticleFetch.ts:38-43`

**Issue:** `onclose(reasons)` zips `RELAYS.forEach((url, i) => reasons[i])`. The `reasons`
array is `closesReceived`, indexed by nostr-tools' internal `groupedRequests` order, which
is built from `normalizeURL`-ed, de-duplicated URLs (see `subscribe` → `subscribeMap`).
For the current 4 distinct, already-normalized RELAYS this happens to line up, but the
mapping is implicit and silently breaks if a duplicate or non-normalized URL is ever added
to `RELAYS`. The `allError` decision then becomes unreliable. Note CR-03 also relies on
this handler firing at all.

**Fix:** Compute `allError` directly from the `reasons` array without trying to attribute
reasons to specific URLs: `const allError = reasons.length > 0 && reasons.every(r => classifyRelayClose(r ?? "unknown") === "error")`. Drop the per-URL `relayOutcomes` map, which
is otherwise only used to derive `allError`.

---

### WR-02: `classifyRelayClose` uses substring matching that misclassifies error reasons containing trigger words

**File:** `src/lib/nostr.ts:65-72`

**Issue:** Classification is done with `reason.includes("eose")`, `includes("closed by
caller")`, etc. A relay-supplied or library-supplied error reason that happens to contain
one of these substrings (e.g. a CLOSED message like `"error: subscription closed by caller
unexpectedly"` or any reason mentioning "eose") is misclassified as `"clean"`, suppressing
a genuine `error` status. The reason strings include text that can originate from the relay
(untrusted), so this is an input-trust issue, not just a style nit.

**Fix:** Match against exact, known sentinel strings the code itself produces
(`"closed by caller"`, `"effect cleanup"`, `"backstop timer fired"`, `"freeze-at-21"`,
`"closed automatically on eose"`) using equality/`startsWith` rather than `includes`, and
treat anything else as `error`.

---

### WR-03: `parseArticle` does not validate `published_at` is a finite number — `NaN` can reach state

**File:** `src/lib/nostr.ts:16-19`

**Issue:** `parseInt(publishedAtRaw, 10) * 1000` is used whenever a `published_at` tag is
present. A hostile/garbage tag value like `["published_at", "soon"]` yields `parseInt(...)
= NaN`, so `publishedAt = NaN`. That `NaN` is stored in the `Article` and will silently
break any downstream sorting/timestamp formatting (which is the stated purpose of the field).
The published_at tests only cover the valid-numeric and absent cases.

**Fix:** Validate the parse result and fall back to `created_at` when it is not finite:

```ts
const parsed = publishedAtRaw ? parseInt(publishedAtRaw, 10) : NaN
const publishedAt = Number.isFinite(parsed) ? parsed * 1000 : event.created_at * 1000
```

---

### WR-04: `useProfileFetch` profile subscription has no `onclose` and relies solely on `maxWait` to close — late profiles after teardown are dropped silently, and a re-keyed effect can leak

**File:** `src/hooks/useProfileFetch.ts:14-32`

**Issue:** The profile subscription is keyed on `[pubkeys.join(",")]`. Because `pubkeys`
is derived in `NostrContext` from `state.articles` via a memo, the dependency string changes
every time a new author pubkey is added during streaming. Each change tears down the prior
subscription (cleanup `sub.close(...)`) and opens a new one with the full author list.
During active streaming this can open and immediately close several profile subscriptions
in quick succession, and any kind:0 events in flight against a torn-down subscription are
dropped. There is no `onclose`/error handling, so a relay that fails to return profiles
produces no signal at all (acceptable for the no-loading-gate design, but undocumented).
This is a robustness/efficiency concern rather than a crash, but combined with StrictMode's
double-invoke it means the profile sub is opened/closed at least twice on mount.

**Fix:** Debounce/stabilize the pubkey set before subscribing (e.g. only fetch profiles
once article streaming reaches a terminal status, since the article set is frozen at that
point), or accumulate pubkeys and re-subscribe only for newly-seen authors. At minimum,
document the intentional churn.

---

### WR-05: `nostrReducer` switch has no `default` branch — TypeScript exhaustiveness is the only guard, returns `undefined` if an unknown action slips through at runtime

**File:** `src/context/nostrReducer.ts:27-59`

**Issue:** The `switch` covers all four current action types but has no `default` case.
TypeScript currently makes this exhaustive, but if a new action type is added to the union
without a case (or an untyped dispatch occurs at a JS boundary), the function falls through
and returns `undefined`, which becomes the next reducer state and crashes the app on the
next access. This is a latent correctness trap given the reducer is the single source of
truth.

**Fix:** Add an exhaustiveness guard:

```ts
default: {
  const _exhaustive: never = action
  return state
}
```

This both satisfies the never-undefined invariant and produces a compile error if a new
action type is added without handling.

---

## Info

### IN-01: `useNostr` return type re-declares fields already present in `NostrState`, risking drift

**File:** `src/context/NostrContext.tsx:40-49`

**Issue:** The explicit return annotation restates `articles`, `profiles`, and `status`,
which are already members of `NostrState`. If `NostrState` shapes change, this duplicated
annotation can silently diverge. The actual returned value is `NostrContextValue`
(`NostrState & { refetch }`), so the wider annotation is redundant.

**Fix:** Annotate as `NostrContextValue` (export the type from this module) and drop the
re-declared fields.

---

### IN-02: Magic numbers `21`, `8000`, `9000`, `5000`, `100` are inlined across reducer and hooks

**File:** `src/context/nostrReducer.ts:31`, `src/hooks/useArticleFetch.ts:29,56,63-65,78`, `src/hooks/useProfileFetch.ts:26`

**Issue:** The freeze cap (`21`), `maxWait` (8000/5000), backstop (9000), and subscription
`limit` (100) are scattered literals. The `21` cap is the product's defining constraint and
appears in two files; the 8000/9000 ordering (maxWait must be < backstop) is an invariant
expressed only implicitly. Drift between these is easy and silent.

**Fix:** Hoist named constants (e.g. `ARTICLE_LIMIT = 21`, `ARTICLE_MAX_WAIT_MS`,
`BACKSTOP_MS`, `RELAY_QUERY_LIMIT`) into `src/lib/pool.ts` or a config module and reference
them.

---

### IN-03: Both `useArticleFetch` effects mutate the shared `subRef`, making teardown ordering implicit

**File:** `src/hooks/useArticleFetch.ts:60,67-72,77-83`

**Issue:** Effect 1 sets and nulls `subRef.current`; Effect 2 also nulls it after closing.
Under StrictMode double-invoke and the freeze path, reasoning about which effect owns the
ref at any moment is non-obvious. It currently works because each path closes the
closure-captured `sub` (Effect 1 cleanup) or the ref (Effect 2), but the shared mutable
ref across two effects is fragile.

**Fix:** Consider consolidating subscription lifecycle into a single effect, or document
the ownership contract. Not a bug today; flagged for maintainability.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
