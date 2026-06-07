---
phase: quick-260607-vqt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/nostr.ts
  - src/context/nostrReducer.ts
  - src/context/nostrReducer.test.ts
  - src/lib/nostr.ts
  - src/lib/nostr.test.ts
  - src/hooks/useArticleFetch.ts
  - src/hooks/useReplyFetch.ts
  - src/context/NostrContext.tsx
  - src/App.tsx
  - src/components/ArticleList.tsx
autonomous: true
requirements: [QUICK-260607-vqt]
must_haves:
  truths:
    - "More than 21 articles can appear in the list (the hard 21-cap is gone)"
    - "Articles are ordered by reply count, most-replied first"
    - "Reply counts are fetched from relays and survive slow/partial relay responses without hanging the UI"
    - "Sorting happens before hashtag filtering, so the filtered list is also reply-sorted"
  artifacts:
    - path: "src/hooks/useReplyFetch.ts"
      provides: "Batched #a reply subscription that counts referencing events per article coordinate"
    - path: "src/lib/nostr.ts"
      provides: "sortArticlesByReplies pure helper + referencedCoordinates extractor"
  key_links:
    - from: "src/hooks/useReplyFetch.ts"
      to: "nostrReducer REPLY_RECEIVED"
      via: "dispatch per referencing event"
      pattern: "REPLY_RECEIVED"
    - from: "src/App.tsx"
      to: "sortArticlesByReplies"
      via: "derived memo applied before filterArticles"
      pattern: "sortArticlesByReplies"
---

<objective>
Two behavior changes to the Nostr long-form reader:

1. Remove the hard cap of 21 articles. The app currently freezes article intake
   at 21 in two places; both are removed so the natural per-relay `limit: 100`
   fetch bound governs how many articles display.
2. Order the article list by number of replies (descending, most-replied first),
   replacing the current arrival-order rendering. Reply counts come from a
   follow-up Nostr subscription that filters on the `#a` tag matching each
   article's `30023:<pubkey>:<d>` coordinate (NIP-22 kind:1111 comments and
   kind:1 replies both reference articles via an `a` tag).

Purpose: The user explicitly overrides the v1 "fixed at 21 most recent" constraint
and wants discovery ranked by engagement (replies) rather than recency.

Output: Reply-count state + a batched reply-fetch hook mirroring the existing
profile-fetch pattern, an uncapped intake path, and a pure reply-sort applied
before filtering.

NOTE: This contradicts the CLAUDE.md / PROJECT.md constraint "Article count:
Fixed at 21 most recent." The override is intentional per the user's request.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md

@src/types/nostr.ts
@src/context/nostrReducer.ts
@src/lib/nostr.ts
@src/lib/nostr.test.ts
@src/hooks/useArticleFetch.ts
@src/hooks/useProfileFetch.ts
@src/context/NostrContext.tsx
@src/App.tsx
@src/components/ArticleList.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Remove the 21-cap and add reply-count state + sort helper</name>
  <files>src/types/nostr.ts, src/context/nostrReducer.ts, src/context/nostrReducer.test.ts, src/lib/nostr.ts, src/lib/nostr.test.ts</files>
  <behavior>
    nostrReducer:
    - ARTICLE_RECEIVED no longer drops events once 21 articles exist — the only
      gate is the existing seenCoords dedup. Adding a 22nd unique-coordinate
      article appends it.
    - New REPLY_RECEIVED action: given a referencing event, increments
      replyCounts for EACH article coordinate the event references via its `a`
      tags whose value starts with "30023:". An event referencing two known
      coordinates increments both. Counts only article coordinates that exist in
      the current state.articles (ignore `a` tags pointing at articles we did not
      fetch). The same referencing event id must not be counted twice (track via
      a seenReplyIds Set), so duplicate deliveries across relays do not inflate
      counts.
    - RESET clears replyCounts and seenReplyIds alongside the existing reset.
    sortArticlesByReplies (pure, in lib/nostr.ts):
    - Given Article[] and a Map<string, number> of coordinate→replyCount, returns
      a NEW array sorted by replyCount descending; ties broken by publishedAt
      descending (newer first). Articles absent from the map count as 0 replies.
      Does not mutate the input array.
    referencedArticleCoordinates (pure, in lib/nostr.ts):
    - Given an Event, returns the list of `a` tag values that start with "30023:"
      (the article coordinates this event references). Empty array when none.
  </behavior>
  <action>
    In src/types/nostr.ts: add a REPLY-count shape. Extend the exported NostrState
    contract consumers rely on by NOT changing Article; instead reply counts live
    in the reducer state map (see Task 1 reducer change). Add nothing UI-facing
    here unless a shared type is needed for the sort helper signature.

    In src/lib/nostr.ts: add `referencedArticleCoordinates(event: Event): string[]`
    returning tag values from `event.tags` where `t[0] === "a"` and
    `t[1]?.startsWith("30023:")`. Add
    `sortArticlesByReplies(articles: Article[], replyCounts: Map<string, number>): Article[]`
    that copies the array and sorts by `(replyCounts.get(a.coordinate) ?? 0)`
    descending, tie-breaking by `publishedAt` descending. Import the `Event` type
    from "nostr-tools/core" (subpath import only — root barrel forbidden per
    project decision 02-01).

    In src/context/nostrReducer.ts: (a) DELETE the freeze guard line
    `if (state.articles.length >= 21) return state` from ARTICLE_RECEIVED so only
    the seenCoords dedup remains. (b) Add `replyCounts: Map<string, number>` and
    `seenReplyIds: Set<string>` to NostrState and initialState. (c) Add a
    `REPLY_RECEIVED` action variant carrying the referencing `event: Event`. Its
    reducer branch: if seenReplyIds already has event.id, return state unchanged;
    otherwise compute referencedArticleCoordinates(event), filter to coordinates
    present in state.articles (build a Set of article coordinates once), and for
    each matched coordinate produce a new replyCounts Map with that coordinate
    incremented by 1. Add event.id to a new seenReplyIds Set. Return new state
    with the new maps/sets. If no coordinates matched, still record event.id in
    seenReplyIds (so it is not reprocessed) but you may keep the same replyCounts
    reference. (d) RESET must reset replyCounts to a new empty Map and seenReplyIds
    to a new empty Set (alongside the existing initialState spread + fetchKey bump).

    Write tests FIRST (RED) in nostr.test.ts for sortArticlesByReplies (descending
    order, tie-break by publishedAt, articles missing from map treated as 0, input
    not mutated) and referencedArticleCoordinates (filters non-"30023:" a-tags,
    returns [] when no a-tags). Write tests in nostrReducer.test.ts for: 22nd
    unique article is appended (cap removed); REPLY_RECEIVED increments the matched
    coordinate; duplicate reply event id is ignored; reply referencing an unknown
    coordinate does not change counts; RESET clears replyCounts and seenReplyIds.
    Do NOT inline implementation in this action — write the failing tests, then
    implement to green.
  </action>
  <verify>
    <automated>cd /Users/gareth/git/nostr/soveng &amp;&amp; npx vitest run src/lib/nostr.test.ts src/context/nostrReducer.test.ts</automated>
  </verify>
  <done>
    nostr.test.ts and nostrReducer.test.ts pass. Reducer has no 21-cap line.
    sortArticlesByReplies and referencedArticleCoordinates are exported and tested.
    replyCounts + seenReplyIds exist in state and reset on RESET.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add useReplyFetch hook and wire uncapped streaming + reply state</name>
  <files>src/hooks/useReplyFetch.ts, src/hooks/useArticleFetch.ts, src/context/NostrContext.tsx</files>
  <action>
    Create src/hooks/useReplyFetch.ts mirroring useProfileFetch.ts. Signature:
    `useReplyFetch(coordinates: string[], dispatch: Dispatch&lt;NostrAction&gt;): void`.
    Early-return when coordinates.length === 0. Open ONE batched subscription via
    `pool.subscribeMany(RELAYS, filter, handlers)` — never one-sub-per-article (same
    rule as profile fetch, decision 02-01/D-09). Filter: `{ "#a": coordinates }`
    (NIP-01 tag filter; matches kind:1111 NIP-22 comments and kind:1 replies that
    carry an `a` tag referencing the article). Do NOT restrict `kinds` — any event
    that references the article via `#a` counts as engagement. In onevent, dispatch
    `{ type: "REPLY_RECEIVED", event }`. Set `maxWait: 5000` (same tolerance as
    profile fetch). Return a cleanup that calls `sub.close("reply effect cleanup")`.
    Use a stable effect dependency of `coordinates.join(",")` (same churn-avoidance
    pattern as useProfileFetch's `pubkeys.join(",")`), with the same
    eslint-disable-next-line for exhaustive-deps.

    In src/hooks/useArticleFetch.ts: (a) DELETE Effect 2 entirely (the freeze
    watcher that closes the subscription and dispatches "done" at
    `articleCount >= 21`). The existing onclose handler and the 9000ms backstop
    timer already resolve the terminal status for the uncapped stream, so removal
    leaves no path that hangs on "streaming". (b) Because Effect 2 was the only
    consumer of the `articleCount` parameter beyond countRef, KEEP the countRef
    mechanism (onclose/backstop still read live count via countRef) — only remove
    the freeze effect. Leave the `limit: 100` per-relay subscription filter as the
    natural upper bound on how many articles are fetched.

    In src/context/NostrContext.tsx: derive `coordinates` as a memo over
    state.articles (`[...new Set(state.articles.map(a => a.coordinate))]`, stable
    via the same articles-identity dependency used for pubkeys), and call
    `useReplyFetch(coordinates, dispatch)` right after useProfileFetch. replyCounts
    already flows out as part of `...state` in the context value, so no extra
    wiring is needed for consumers.
  </action>
  <verify>
    <automated>cd /Users/gareth/git/nostr/soveng &amp;&amp; npx tsc -b --noEmit &amp;&amp; npx vitest run</automated>
  </verify>
  <done>
    Typecheck passes, full test suite passes. useArticleFetch has no freeze-at-21
    effect. useReplyFetch opens a single #a subscription and dispatches
    REPLY_RECEIVED. NostrContext wires reply fetching off article coordinates.
  </done>
</task>

<task type="auto">
  <name>Task 3: Apply reply-sort in App and fix the hardcoded /21 streaming line</name>
  <files>src/App.tsx, src/components/ArticleList.tsx</files>
  <action>
    In src/App.tsx: read `replyCounts` from useNostr() alongside the existing
    destructure. Add a derived memo `sortedArticles = useMemo(() =>
    sortArticlesByReplies(articles, replyCounts), [articles, replyCounts])` and feed
    `sortedArticles` (NOT raw `articles`) into buildFacets, computeDynamicCounts,
    and filterArticles so faceting and filtering operate on the reply-sorted list.
    The filtered list then preserves reply order because filterArticles preserves
    input order. Import sortArticlesByReplies from "@/lib/nostr". Do not add new UI
    components — reuse existing structure (global rule: existing shadcn components
    only).

    In src/components/ArticleList.tsx: the streaming status line hardcodes
    "{articles.length}/21 received" and "ready — {n} articles loaded". Since 21 is
    no longer the target, change the streaming line to drop the "/21" denominator —
    render `&gt; streaming&#x2026; {articles.length} received` (no fixed total). Keep
    the ready line as-is ("ready — N articles loaded"). No other layout change.
  </action>
  <verify>
    <automated>cd /Users/gareth/git/nostr/soveng &amp;&amp; npx tsc -b --noEmit &amp;&amp; npx vitest run</automated>
  </verify>
  <done>
    App sorts by replyCounts before filtering. The streaming line no longer shows
    "/21". tsc and full test suite pass. A manual `npm run dev` shows articles
    ordered most-replied-first and more than 21 articles when relays return them.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| relay → client | Untrusted Nostr events (replies, articles) cross here over WebSocket |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vqt-01 | Tampering | REPLY_RECEIVED reply-count inflation | mitigate | Dedup referencing events by event.id via seenReplyIds Set; a malicious relay re-sending the same reply cannot inflate a count |
| T-vqt-02 | Spoofing | Fake `a` tags pointing at arbitrary coordinates | accept | Counts are filtered to coordinates of articles we actually fetched; anyone can publish a reply to a real article, so a high reply count is inherently public/gameable — acceptable for a discovery view with no security impact |
| T-vqt-03 | Denial of Service | Hung/slow relay never closing the reply subscription | mitigate | maxWait: 5000 on the reply subscription + effect cleanup close, matching the existing profile-fetch tolerance; reply counts degrade gracefully to partial without blocking render |
| T-vqt-04 | Denial of Service | Removing the 21-cap leaves stream open indefinitely | mitigate | Existing onclose handler + 9000ms backstop timer in useArticleFetch already force a terminal status; per-relay `limit: 100` bounds intake |
| T-vqt-SC | Tampering | npm/pip/cargo installs | mitigate | No new packages installed — uses existing nostr-tools SimplePool only; no install step, no legitimacy gate needed |
</threat_model>

<verification>
- `npx vitest run` — full suite green (new reducer + lib tests included)
- `npx tsc -b --noEmit` — no type errors
- Manual: `npm run dev`, observe (a) more than 21 articles can render and (b) the
  top article has the most replies; slow relays do not freeze the UI on "streaming"
</verification>

<success_criteria>
- The 21-article cap is removed from both the reducer and useArticleFetch
- Articles render ordered by reply count descending, tie-broken by recency
- Reply counts are fetched via a single batched `#a` subscription with graceful
  slow-relay tolerance (maxWait + cleanup)
- Filtering and faceting operate on the reply-sorted list
- All tests and typecheck pass
</success_criteria>

<output>
Create `.planning/quick/260607-vqt-don-t-stop-at-21-events-sort-by-number-o/260607-vqt-SUMMARY.md` when done
</output>
