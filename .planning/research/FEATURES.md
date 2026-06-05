# Feature Research

**Domain:** Nostr long-form article reader / discovery browser (kind:30023, NIP-23)
**Researched:** 2026-06-05
**Confidence:** HIGH (NIP spec confirmed via official source; UX patterns from established research; competitor analysis from live apps)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Article list with title + author + timestamp | Every article reader shows this; without it the list is unusable | LOW | `title` from NIP-23 tag; `created_at` or `published_at` (unix seconds) from event; prefer `published_at` for display, fall back to `created_at` |
| Author display name | Users need to know who wrote what; "anonymous hex pubkey" feels broken | MEDIUM | Requires secondary kind:0 fetch per unique pubkey; parse `display_name` (NIP-24) first, fall back to `name` (NIP-01), then fall back to truncated npub (e.g. `npub1abc…xyz`) |
| Author avatar | Expected alongside display name in any modern reader | MEDIUM | `picture` field from kind:0 content JSON; must handle missing picture gracefully (monogram fallback or terminal-styled placeholder) |
| Relay loading state | Relay fetches over WebSocket can take 1–5+ seconds; blank screen feels broken | LOW | Show spinner or animated terminal prompt during subscription; EOSE signals end of initial data |
| Empty state (no results) | Filtering to a tag combo with zero matches is common; blank white void is confusing | LOW | Contextual message: "No articles match these tags" vs "No articles fetched yet" are different states |
| Error state (relay unreachable) | Some relays in the default set will time out or reject; partial failure is normal | MEDIUM | Must handle individual relay failures gracefully; if at least one relay returns events, surface them with a soft warning rather than a hard error; if all relays fail, show actionable message |
| Hashtag facet list with counts | Users need to see which tags are actually present in the fetched set; counts tell them which tags are worth clicking | LOW | Counts are derived from the 21 fetched articles only — not global relay counts; this is correct behaviour per PROJECT.md |
| Checkbox-based tag selection | Standard multi-select filter pattern; users know how checkboxes work | LOW | shadcn `Checkbox` component; checked state drives filter logic |
| AND / OR filter toggle | When multiple tags are checked, users need to control whether articles must have ALL tags (AND) or ANY tag (OR) | MEDIUM | Toggle only activates when ≥2 tags are checked; must be labelled clearly — see UX notes below |
| Inline Markdown expansion | Clicking an article must render the content; opening a new tab or navigating away breaks the "reader in context" expectation | MEDIUM | react-markdown with remark-gfm; secure by default (no dangerouslySetInnerHTML); collapse/expand toggle |
| Relative timestamps | "3 days ago" is standard reader convention; raw unix timestamps are unusable | LOW | Use `published_at` if present, else `created_at`; format as relative (e.g. "2 days ago") with absolute datetime in tooltip |
| Partial-result display | If 3 of 4 relays respond, show what arrived rather than waiting forever | MEDIUM | Collect events as they arrive; deduplicate by event ID; render once EOSE fires or a timeout lapses (e.g. 8s) |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Terminal phosphor aesthetic | Distinctive; immediately signals this is a developer/Nostr-native tool; sets it apart from generic blog readers | LOW | Achieved entirely via shadcn/Tailwind tokens; monospace typeface, green-on-black palette; no additional complexity in logic |
| Article summary preview | NIP-23 `summary` tag is optional but present on well-formed articles; showing it reduces need to expand and read everything | LOW | Render as muted sub-text under title; truncate at ~120 chars; absent = no preview shown (graceful degradation) |
| Article cover image | NIP-23 `image` tag provides a header image URL; showing it makes cards visually richer | LOW | Render as a small thumbnail on card; absent = no image (cards without images remain usable); must handle broken image URLs |
| Tag pill display on article cards | Shows which tags an article carries without expanding it; reinforces the facet model | LOW | Render `t` tags as small pills on each card; click a pill = add to active filter |
| Active filter summary bar | Shows currently selected tags and the AND/OR mode at a glance; gives users confidence the filter is applied | LOW | Small strip above article list: "Showing: #bitcoin AND #nostr — clear all" |
| Estimated reading time | "5 min read" is a well-understood signal on medium/long content; helps users pick what to read now vs later | LOW | Word count / 200 WPM; only shown after article content is fetched (or estimable from `summary` length) |
| Relay status indicator | Shows which relays responded vs timed out; useful for Nostr-savvy users and aids debugging | LOW | Small status dot or list in a corner; green = responded, red = failed; purely informational |
| NIP-05 verified badge | Some authors have NIP-05 identifiers (email-style); a checkmark next to their name signals credibility | MEDIUM | Requires an extra HTTP fetch to verify NIP-05; mark LOW priority — adds latency and complexity; nice-to-have only |

### Anti-Features (Deliberately NOT Building)

Features that seem natural but are out of scope for a narrow read-only discovery app.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Authoring / publishing (write) | Readers often also write | Requires NIP-07 login, signing, key management — completely different product surface; bloats scope | Habla, Yakihonne, Primal exist for this |
| Login / NIP-07 identity | Enables follows, bookmarks, zaps | Public long-form content requires no auth to read; login adds state management, error cases, and backend-like concerns to what must remain a static site | Out of scope per PROJECT.md |
| Zaps / lightning payments | Nostr culture expects it | Requires NWC/NIP-47 or webln integration, wallet connections — far outside a reader's scope | Users can open article in Habla/Yakihonne for zapping |
| Comments / replies (kind:1111) | Natural extension of reading | NIP-22 comments require fetching additional event trees, threading UI, and write capability to respond | Out of scope per PROJECT.md |
| Pagination / infinite scroll | More than 21 articles | Complicates relay query strategy and deduplication; 21 is a deliberate curated view | Not building in v1 per PROJECT.md |
| User-configurable relay list | Power users want their relays | Adds settings UI, persistence (localStorage), relay validation — significant complexity for v1 | Fixed default relay set for v1; can add in v2 |
| Full-text search | Natural in a reader | Requires a search index or Nostr search relay (e.g. nostr.band search API) — not available from standard relay queries | Tag facets serve the discovery function |
| Bookmarks / reading list | Users want to save articles | Requires persistence (localStorage at minimum, NIP-51 lists for Nostr-native) — adds state complexity without validating the core concept first | Defer to v2+ after core is validated |
| Dark/light mode toggle | Standard modern expectation | Terminal aesthetic IS the dark mode; adding a light mode undermines the design identity; adds theme-switching complexity | Ship with terminal palette only; it's intentional |
| Share / copy link buttons | Natural for articles | Opens questions about canonical article URL format (naddr encoding); links to external readers (njump.me) break the in-app reading goal | Out of scope for v1 |

---

## Feature Dependencies

```
Article list render
    └──requires──> Relay fetch (kind:30023 subscription)
                       └──requires──> WebSocket connection to ≥1 relay
                       └──produces──> Loading state → Partial results → EOSE → Final list

Author name/picture display
    └──requires──> kind:0 fetch per unique pubkey
                       └──depends on──> Article list (need pubkeys from fetched articles)
                       └──requires──> At least one relay responds to kind:0 query

Hashtag facet sidebar
    └──requires──> Article list (tags derived from fetched articles only)
    └──produces──> Filtered article list

AND/OR toggle
    └──requires──> Hashtag facet sidebar
    └──activates when──> ≥2 hashtags are checked

Inline Markdown expansion
    └──requires──> Article list (needs event content field)
    └──uses──> react-markdown renderer

Tag pills on cards
    └──enhances──> Hashtag facet sidebar (clicking pill adds to filter)
    └──requires──> Article list

Active filter summary bar
    └──enhances──> AND/OR toggle + hashtag facet sidebar
    └──requires──> Hashtag facet sidebar

Article summary/image on cards
    └──requires──> Article list (NIP-23 `summary` and `image` tags)
    └──degrades gracefully──> if tags absent, just omit

Error state
    └──requires──> Relay fetch attempt + timeout logic

Empty state
    └──branches on──> (a) relay fetch returned nothing vs (b) filter has no matches
```

### Dependency Notes

- **Author display requires article list first:** The app should batch all unique pubkeys from the 21 fetched articles into a single kind:0 subscription request rather than one per article. This minimises relay round-trips.
- **Facet sidebar requires article list:** Tags are derived from the fetched 21 articles. The sidebar must re-compute on every relay fetch result update and on filter change.
- **AND/OR toggle requires ≥2 checked tags:** When 0 or 1 tags are checked, the toggle is irrelevant (or can be shown disabled). Activating it at 0–1 checked tags confuses users.
- **Inline expansion is self-contained:** Article content (`content` field) arrives with the kind:30023 event; no additional fetch needed to expand an article.
- **Error vs empty state must be distinguished:** "All relays timed out" is a hard error requiring user action (retry button). "No articles match these tags" is a soft filter state requiring "clear filters" affordance.

---

## AND/OR Filter Toggle — UX Notes

This is the most UX-sensitive feature in the app. Key findings from research:

**Labeling confusion is the primary risk.** "AND" means fewer results (intersection); "OR" means more results (union). Non-technical users often misread this: "I want bitcoin AND nostr articles" sounds like they want both topics, but they mean OR semantically. Evidence from UX research: within a single facet group, OR logic (show me anything that has any of these) is the more natural default; AND is the power-user narrowing mode.

**Recommended approach:**
- Default to OR when ≥2 tags are checked (more permissive, more results, less likely to produce empty state)
- Label the toggle clearly as "Match ANY tag" (OR) vs "Match ALL tags" (AND) rather than bare "OR" / "AND"
- Show the toggle disabled/greyed when fewer than 2 tags are checked
- When AND mode produces 0 results, show a contextual nudge: "Try switching to ANY mode to see more articles"

**Active filter display:** A small strip above the article list showing "Filtered by: #bitcoin OR #nostr" (or "AND") with a "Clear all" link. This is table stakes for confirming to the user that filtering is active.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Relay fetch: subscribe to 4 default relays, collect kind:30023, dedupe, sort newest-first, take top 21
- [ ] Loading state during relay subscription (animated terminal prompt or spinner)
- [ ] Partial-result display + EOSE handling (show what arrived, don't wait forever)
- [ ] Error state if all relays fail (retry button)
- [ ] Article card: title + author display name + truncated npub fallback + avatar + relative timestamp
- [ ] Author kind:0 fetch (batch by unique pubkeys, not per-article)
- [ ] Hashtag facet sidebar with counts derived from fetched articles
- [ ] Checkbox multi-select tag filtering
- [ ] AND/OR toggle (labelled "Match ALL" / "Match ANY") activating at ≥2 tags
- [ ] Active filter summary bar (above article list, with clear-all)
- [ ] Empty state for filter with no matches (with "clear filters" affordance)
- [ ] Inline Markdown expansion on article click (react-markdown, remark-gfm, secure by default)
- [ ] Terminal phosphor aesthetic (monospace, green-on-black, via shadcn/Tailwind tokens)
- [ ] Static Vite build to GitHub Pages

### Add After Validation (v1.x)

Features to add once core is working and user feedback gathered.

- [ ] Article `summary` preview on cards — trigger: feedback that users can't tell articles apart without expanding
- [ ] Article `image` thumbnail on cards — trigger: visual differentiation wanted
- [ ] Tag pills on cards (click to filter) — trigger: users want to filter from the article list, not just the sidebar
- [ ] Estimated reading time — trigger: users want to know time commitment before expanding
- [ ] Relay status indicator — trigger: users report confusion about why some articles aren't showing
- [ ] `published_at` vs `created_at` discrepancy surfacing — trigger: articles appearing with wrong dates

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] User-configurable relay list — defer: adds significant settings/persistence complexity
- [ ] Bookmarks (localStorage) — defer: requires validated use case
- [ ] NIP-05 verified badge — defer: adds HTTP fetch latency per unique author
- [ ] Full-text search via nostr.band search relay — defer: different product surface (search vs browse)
- [ ] Share/copy naddr link — defer: canonical URL format and external reader questions need resolving

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Article list (title/author/timestamp) | HIGH | LOW | P1 |
| Relay loading state | HIGH | LOW | P1 |
| Inline Markdown expansion | HIGH | MEDIUM | P1 |
| Hashtag facet sidebar with counts | HIGH | LOW | P1 |
| AND/OR toggle | HIGH | MEDIUM | P1 |
| Author display name + avatar | HIGH | MEDIUM | P1 |
| Error/empty states | HIGH | LOW | P1 |
| Terminal aesthetic | HIGH | LOW | P1 |
| Active filter summary bar | MEDIUM | LOW | P1 |
| Article summary preview | MEDIUM | LOW | P2 |
| Article cover image | MEDIUM | LOW | P2 |
| Tag pills on cards | MEDIUM | LOW | P2 |
| Relay status indicator | LOW | LOW | P2 |
| Estimated reading time | LOW | LOW | P2 |
| NIP-05 verified badge | LOW | MEDIUM | P3 |
| User-configurable relays | MEDIUM | HIGH | P3 |

**Priority key:** P1 = must have for launch; P2 = add after validation; P3 = future consideration

---

## Competitor Feature Analysis

| Feature | Habla.news | YakiHonne | Narr | Soveng (our approach) |
|---------|------------|-----------|------|-----------------------|
| Article card with title/author/image | Yes — image, title, author, reading time | Yes — clean card with all metadata | Feed-based, no rich cards | Title + author + timestamp + optional summary/image |
| Hashtag / topic filtering | Tag pages, not sidebar facets | Trending hashtag pills | No | Sidebar facet checkboxes with counts and AND/OR toggle |
| AND/OR filter logic | Not offered | Not offered | Not offered | Explicit toggle — differentiator |
| Inline Markdown read | Full page expand | Full page reader | Yes | Inline expand within list — no navigation |
| Author kind:0 resolution | Yes — full profile | Yes — full profile | Via npub lookup | Name + picture only; truncated npub fallback |
| Loading / error states | Basic | Basic | Minimal | Explicit relay-aware states |
| Write / publish | Yes (core feature) | Yes (core feature) | No | Deliberately no |
| Zaps / social | Yes | Yes | No | Deliberately no |
| Static / no backend | No (server-rendered) | No | Self-hosted | Yes — GitHub Pages static |
| Terminal aesthetic | No | No | No | Yes — unique positioning |

---

## Sources

- [NIP-23 Long-form Content spec (nips.nostr.com)](https://nips.nostr.com/23) — HIGH confidence, official spec
- [Kind 30023 metadata fields (nostrbook.dev)](https://nostrbook.dev/kinds/30023) — HIGH confidence, community reference
- [NIP-01 kind:0 metadata fields](https://nips.nostr.com/1) — HIGH confidence, official spec
- [NIP-24 extra metadata fields (display_name)](https://nips.nostr.com/24) — HIGH confidence, official spec
- [NDK subscription and EOSE handling](https://nostr-dev-kit.github.io/ndk/) — HIGH confidence, official NDK docs
- [Habla.news features (GitHub verbiricha/habla.news)](https://github.com/verbiricha/habla.news) — MEDIUM confidence, open source reference
- [YakiHonne mobile app](https://github.com/YakiHonne/yakihonne-mobile-app) — MEDIUM confidence, competitor observation
- [Faceted filtering UX best practices (LogRocket)](https://blog.logrocket.com/ux-design/faceted-filtering-better-ecommerce-experiences/) — MEDIUM confidence, established UX research
- [Faceted search best practices (UXmatters)](https://www.uxmatters.com/mt/archives/2009/09/best-practices-for-designing-faceted-search-filters.php) — MEDIUM confidence, established UX research
- [react-markdown security (LogRocket)](https://blog.logrocket.com/how-to-safely-render-markdown-using-react-markdown/) — HIGH confidence, library documentation
- [Nostr Design relay UX](https://nostrdesign.org/docs/how-to/relays/) — MEDIUM confidence, community design guide

---

*Feature research for: Nostr long-form article reader (kind:30023, NIP-23)*
*Researched: 2026-06-05*
