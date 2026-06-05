# Pitfalls Research

**Domain:** Nostr long-form reader — kind:30023 SPA on GitHub Pages
**Researched:** 2026-06-05
**Confidence:** HIGH (NIP specs verified; nostr-tools confirmed via Context7; GitHub Pages deploy patterns verified via Vite docs)

---

## Critical Pitfalls

### Pitfall 1: querySync Hangs Forever When a Relay Never Sends EOSE

**What goes wrong:**
`SimplePool.querySync()` resolves only after receiving EOSE from all relays in the list. If any relay in the set silently drops the connection, closes without sending EOSE, or simply never emits EOSE (some relays return stored events with no EOSE signal), the `await pool.querySync(...)` call will never resolve, leaving the app in a permanent loading state.

**Why it happens:**
Developers assume EOSE is a protocol guarantee. It is not — NIP-01 says relays SHOULD send EOSE, not MUST. Real relays (including relay.primal.net in some configurations) have been observed returning events without following with EOSE on certain filter types.

**How to avoid:**
Always pass `{ maxWait: N }` to `querySync` (or the underlying `subscribeEose`). A value of 5000–8000ms is practical for a 4-relay default set. Additionally, treat a partial result (fewer than 21 events when the timeout fires) as success — render what arrived rather than showing a spinner forever. Use `enablePing: true` on the pool to detect dropped connections early.

```typescript
const events = await pool.querySync(relays, filter, { maxWait: 7000 })
```

**Warning signs:**
- UI loads but never renders articles
- No console errors — the promise is simply pending
- Reproducible by including a relay that is temporarily unreachable

**Phase to address:** Relay subscription / data-fetch phase (first functional phase)

---

### Pitfall 2: Duplicate Articles from Multi-Relay Fan-Out — Not Deduped by d-tag

**What goes wrong:**
`querySync` across 4 relays returns the same kind:30023 event multiple times (same `id`) and also returns multiple versions of the same article (same `pubkey` + `d` combination, different `created_at`). If the UI naively renders all returned events, users see duplicate cards and potentially stale article content.

**Why it happens:**
Two distinct problems get conflated:
1. **Same event id** — the identical event propagated to multiple relays. `SimplePool` deduplicates these internally by event `id`, but only within a single `querySync` call. If you call `querySync` multiple times or rebuild the pool, dedup is lost.
2. **Same addressable coordinate** (`kind:pubkey:d`) — an author edited the article and published a new event with the same `d` tag but a higher `created_at`. Relays may store multiple versions; not all relays enforce the "latest only" constraint from NIP-01. Clients must apply this themselves.

**How to avoid:**
After collecting raw events, apply a two-step dedup before storing in state:
1. Deduplicate by `event.id` (remove exact duplicates).
2. Group by `${event.kind}:${event.pubkey}:${dTag}` and keep only the event with the highest `created_at`. Where `created_at` is equal, keep the lowest `event.id` lexically (per NIP-01 tie-breaking).

**Warning signs:**
- Article list shows the same title twice
- An article's content looks outdated compared to what habla.news shows
- More than 21 events returned across 4 relays for a limit:21 filter

**Phase to address:** Data normalization layer, first functional phase

---

### Pitfall 3: Missing `title` Tag Renders as Blank Card

**What goes wrong:**
NIP-23 marks `title` as "strictly optional". In practice a meaningful fraction of kind:30023 events in the wild have no `title` tag, or have a `title` tag with an empty string. A UI that does `event.tags.find(t => t[0] === 'title')?.[1]` will get `undefined`, and rendering it directly produces a blank card with no visible label.

**Why it happens:**
Developers read "articles" and assume a title is always present. The spec is explicit that it is optional. Draft articles (kind:30024), events published by bots, or events published by clients that embed the title only in the Markdown body follow no consistent convention.

**How to avoid:**
Implement a helper that extracts metadata with safe fallbacks:

```typescript
const title = tags.find(t => t[0] === 'title')?.[1]?.trim() || 'Untitled'
const summary = tags.find(t => t[0] === 'summary')?.[1]?.trim() || ''
const publishedAt = tags.find(t => t[0] === 'published_at')?.[1]
  ? parseInt(tags.find(t => t[0] === 'published_at')![1]) * 1000
  : event.created_at * 1000
```

If no `d` tag exists, skip the event entirely — it cannot be addressed and likely malformed.

**Warning signs:**
- Article cards with completely empty titles in the list
- Errors when calling `.toLowerCase()` or `.slice()` on the title

**Phase to address:** Event parsing / data model phase

---

### Pitfall 4: Inline Markdown Render — Raw HTML / XSS from Untrusted Content

**What goes wrong:**
Long-form Nostr articles are written by anonymous authors. Many legitimate articles embed raw HTML (e.g., `<img>`, `<div>`, custom formatting). If `react-markdown` is configured with `rehype-raw` but no sanitization, a malicious author can inject `<script>` tags, `<iframe>` elements, or SVG `onload` handlers that execute JavaScript in the reader's browser.

**Why it happens:**
`react-markdown` is safe by default (strips HTML). Developers add `rehype-raw` to support legitimate embedded HTML and forget that this plugin re-enables arbitrary HTML injection. Even without `rehype-raw`, some edge cases in Markdown (e.g., `javascript:` href values) survive default parsing.

**How to avoid:**
Use `rehype-sanitize` (from the unified/rehype ecosystem) configured with a strict allowlist, or pair `rehype-raw` with `isomorphic-dompurify`. The recommended pattern:

```typescript
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
// Place rehypeSanitize AFTER rehypeRaw in the plugin chain
rehypePlugins={[rehypeRaw, [rehypeSanitize, defaultSchema]]}
```

Never use `dangerouslySetInnerHTML` with unsanitized Markdown-to-HTML output.

**Warning signs:**
- `<script>` tags appear in rendered output
- Inline `style` attributes that reposition or hide page elements
- Any Nostr article content that includes `<iframe src="javascript:...">` patterns

**Phase to address:** Markdown render / article expansion phase

---

### Pitfall 5: Vite `base` Misconfiguration Breaks All Asset Paths on GitHub Pages

**What goes wrong:**
The app builds locally, all links work at `localhost:5173`, then GitHub Pages deployment produces a blank page with 404s on every JS/CSS/image asset. The root cause is that GitHub Pages project repos serve from `https://username.github.io/repo-name/` but the default Vite `base` is `'/'`, which makes all asset `src` and `href` attributes point at `https://username.github.io/...` (root of the Pages domain) rather than `https://username.github.io/repo-name/...`.

**Why it happens:**
Vite does the right thing for local dev (base `/` works). The mismatch only appears after deploy because the subdirectory prefix is invisible during development. Developers test locally, ship, and see the blank page for the first time.

**How to avoid:**
Set `base` in `vite.config.ts` to the repository name for project page deploys:

```typescript
export default defineConfig({
  base: '/repo-name/',   // e.g. '/soveng/'
})
```

If a custom domain is configured pointing at the root, use `base: '/'`. Add this to the GitHub Actions deploy workflow as an env variable so it is not accidentally hardcoded to the wrong value when the repo is renamed.

**Warning signs:**
- Blank page after deploy; browser DevTools shows 404 on `main.js` or `index.css`
- Asset URLs in the deployed HTML start with `/assets/` instead of `/repo-name/assets/`

**Phase to address:** GitHub Actions / deploy workflow phase

---

### Pitfall 6: GitHub Pages SPA Routing 404 on Direct URL or Refresh

**What goes wrong:**
If the app ever uses client-side routing (React Router or similar) with `BrowserRouter` and a URL like `/article/abc123`, refreshing that URL or sharing it causes GitHub Pages to return its own 404 page. GitHub Pages serves static files only — it has no server-side rewrite rule to redirect unknown paths back to `index.html`.

**Why it happens:**
GitHub Pages treats every path as a file lookup. Unknown paths get the platform-level 404, not the app's `index.html`.

**How to avoid:**
For this app's v1 scope, avoid `BrowserRouter` entirely and use hash-based routing (`HashRouter` / `createHashRouter`) or no routing at all (single view with state). If `BrowserRouter` is needed, use the `404.html → redirect script → index.html` trick: copy `dist/index.html` to `dist/404.html` during the build so GitHub Pages serves the app for any path, and inject a redirect script to reconstruct the path in the SPA.

**Warning signs:**
- Refreshing any URL other than the root returns a GitHub 404 page
- Sharing a direct article URL fails for the recipient

**Phase to address:** GitHub Actions / deploy workflow phase (design the routing strategy up-front)

---

### Pitfall 7: kind:0 Profile Content Is Arbitrary JSON — Malformed or Missing Fields

**What goes wrong:**
The `content` field of a kind:0 event is a JSON string. Clients are free to include any fields they like, name them inconsistently, or publish malformed JSON. Common real-world problems:
- `JSON.parse(event.content)` throws because the content is not valid JSON
- `name` is present but empty; `display_name` is present but `name` is absent
- `picture` contains an HTTP URL that will be blocked as mixed content on an HTTPS page
- `picture` contains a URL that returns 404 or a non-image response
- Some clients write `displayName` (camelCase) instead of `display_name`

**Why it happens:**
NIP-01 specifies the fields but cannot enforce them. Different Nostr clients (Amethyst, Damus, Snort) have diverged on field names. Authors may have never set a profile, leaving an empty or null content field.

**How to avoid:**
Wrap all kind:0 parsing in a try/catch. Define a priority order for display name resolution: `display_name` → `displayName` → `name` → first 8 chars of pubkey (hex). Use a fallback identicon or monogram avatar component for missing/broken pictures. For `picture` URLs, set `onError` on the `<img>` to swap to the fallback:

```tsx
<img
  src={profile?.picture}
  onError={(e) => { (e.target as HTMLImageElement).src = fallbackAvatarUrl }}
  alt={displayName}
/>
```

**Warning signs:**
- Console errors: `SyntaxError: Unexpected token in JSON`
- Profile names showing as undefined or empty
- Broken image icons across multiple author avatars

**Phase to address:** Profile resolution phase

---

### Pitfall 8: Mixed-Content Blocks HTTP Image URLs on HTTPS GitHub Pages

**What goes wrong:**
GitHub Pages enforces HTTPS. Nostr author profile `picture` fields and article `image` tags frequently contain plain `http://` URLs (particularly older profiles or self-hosted media). Modern browsers block mixed passive content or auto-upgrade it to HTTPS; if the resource is not available over HTTPS, the image silently fails to load.

**Why it happens:**
Authors set their picture URLs years ago before their image host added HTTPS, or they use self-signed HTTP servers. The Nostr protocol places no constraint on URL scheme in profile fields.

**How to avoid:**
After fetching a profile, attempt to upgrade `http://` to `https://` before rendering. Use the `onError` fallback (see Pitfall 7) to catch cases where HTTPS is unavailable. Do not add a CSP `upgrade-insecure-requests` meta tag — it can cause other side effects on assets you control.

**Warning signs:**
- Profile pictures fail in production but work on local dev (which may be HTTP)
- Browser console: `Mixed Content: The page ... was loaded over HTTPS, but requested an insecure image`

**Phase to address:** Profile resolution phase / article display phase

---

### Pitfall 9: Hashtag `t` Tag Case Inconsistency Breaks Counts and Filtering

**What goes wrong:**
Authors write `t` tag values in any casing: `["t", "Bitcoin"]`, `["t", "bitcoin"]`, `["t", "BITCOIN"]`. If the app counts and filters using raw string equality, "Bitcoin" and "bitcoin" are counted as two separate hashtags with independent checkboxes, and selecting one does not match articles using the other variant.

**Why it happens:**
NIP-01 does not mandate lowercase for `t` tag values. Different clients normalize differently. The relay filter spec for `#t` does exact-match queries, but that is a relay concern — the client-side facet logic is unspecified.

**How to avoid:**
Normalize all `t` tag values to lowercase when building the facet index and when checking membership:

```typescript
const hashtags = event.tags
  .filter(t => t[0] === 't' && t[1])
  .map(t => t[1].toLowerCase().trim())
```

Store the lowercased form in state and display it consistently. Count by lowercased form; filter by lowercased form.

**Warning signs:**
- Same topic appears multiple times in the sidebar with different capitalizations and different counts
- Selecting "bitcoin" does not surface an article tagged `["t", "Bitcoin"]`

**Phase to address:** Facet / hashtag sidebar phase

---

### Pitfall 10: AND Filter Logic Edge Case — Empty Selection Matches Nothing or Everything

**What goes wrong:**
With AND mode: if no checkboxes are selected, the correct behavior is to show all 21 articles. A naive AND implementation `articles.filter(a => selectedTags.every(t => articleTags.has(t)))` returns all articles when `selectedTags` is empty (because `every` on empty array is vacuously true). This is actually correct, but if the developer instead writes the condition as `selectedTags.size > 0 && ...`, they accidentally show nothing when no filter is active.

With OR mode: if no checkboxes are selected, `some` on an empty array returns false — nothing matches. The OR empty case must be handled explicitly.

**Why it happens:**
JavaScript's `Array.every([])` returning `true` is counterintuitive, leading to defensive "guard" code that inverts the behavior. OR mode's `Array.some([])` returning `false` is usually discovered only after implementing AND mode first.

**How to avoid:**
Define the filter contract explicitly before coding it:

```
selectedTags is empty → show all articles (regardless of AND/OR mode)
AND mode → article must carry ALL selected tags
OR mode  → article must carry AT LEAST ONE selected tag
```

Write a unit test for the empty-selection case and each mode before wiring up the toggle.

**Warning signs:**
- Unchecking all checkboxes hides all articles instead of showing all
- OR mode with one tag selected works; zero tags selected shows empty list

**Phase to address:** Hashtag filter / facet phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode relay list in source | No config UI needed | Relay goes offline, app silently degrades with no user recourse | Acceptable for v1 per project scope |
| Skip `maxWait` on `querySync` | One less parameter to think about | App hangs permanently on unresponsive relay | Never — always set a timeout |
| Render Markdown without sanitization | Faster to wire up | XSS vulnerability from any malicious article author | Never |
| No kind:30023 d-tag dedup | Simpler data pipeline | Duplicate/stale articles visible to users | Never — correctness issue |
| Single `t` tag fetch, no lowercase normalization | Slightly less code | Broken facet counts from day one | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SimplePool / nostr-tools | Calling `querySync` without `maxWait` | Always pass `{ maxWait: 7000 }` or similar |
| SimplePool / nostr-tools | Opening one subscription per relay manually | Use `SimplePool` — it multiplexes over a single WebSocket per relay URL |
| kind:30023 filter | Using `limit: 21` and expecting exactly 21 unique articles | Relays interpret `limit` per-connection; fetch more, dedup client-side, then take top 21 by `created_at` |
| kind:0 fetch | Issuing one REQ per author sequentially | Batch all unique `pubkey` values into a single `authors: [...]` filter |
| GitHub Pages | Setting `base: '/'` for a project-page repo | Use `base: '/repo-name/'` for project repos; `base: '/'` only for user/org root pages or custom domains |
| react-markdown | Adding `rehype-raw` without `rehype-sanitize` | Always follow `rehype-raw` with `rehype-sanitize` in the plugin array |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One kind:0 REQ per author | 21 separate WebSocket round-trips for profile data | Batch into single REQ with `authors: [pubkey1, pubkey2, ...]` | Immediately — adds ~1–3s to load |
| Re-opening relay connections on every render / effect re-run | Pool created and destroyed on each React render cycle | Create pool outside component or in a stable ref/context | Immediately — thrashes WebSocket connections |
| Fetching kind:30023 with no `limit` | Relay returns hundreds of events, UI attempts to render all | Always include `limit: 50` or similar in the filter (fetch extra for dedup headroom) | At relays with large stores |
| Inline Markdown expansion without virtualization | Expanding 5+ long articles simultaneously causes jank | Expand only one article at a time, or lazy-mount expanded content | At ~3–5 expanded articles |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `rehype-raw` without sanitization | Stored XSS from malicious article content | Add `rehype-sanitize` after `rehype-raw` in plugin chain |
| Rendering profile `name` or `display_name` via `dangerouslySetInnerHTML` | XSS from crafted profile name | Use React's text rendering (JSX interpolation) — never `dangerouslySetInnerHTML` for user-supplied strings |
| Constructing relay URLs from user input (future feature) | SSRF / open relay abuse | Not applicable in v1 (fixed relay list), but document for future |
| Accepting `javascript:` scheme in article `image` tag or `picture` field | XSS via URL scheme | Strip or reject URLs not starting with `https://` or `http://` before rendering in `src` attributes |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state while WebSocket fetches run | Page appears broken/blank for 2–5 seconds | Show skeleton cards or a terminal-style "fetching..." indicator immediately on mount |
| No partial-result rendering — wait for all relays | Slow relay delays all articles | Render articles as they arrive; update count as dedup runs |
| Empty hashtag sidebar when no `t` tags present | Sidebar looks broken | Hide sidebar or show "(no tags)" message when tag set is empty |
| Profile pictures loading after article list renders | Layout shift as avatars pop in | Reserve fixed dimensions for avatar `<img>` elements |
| AND mode with many tags selected matches nothing | User selects 3 niche tags, sees empty list with no explanation | Show "0 articles match all selected tags — try OR mode" message when AND filter returns nothing |

---

## "Looks Done But Isn't" Checklist

- [ ] **EOSE timeout:** `querySync` (or every `subscribeEose` call) passes `maxWait` — verify by temporarily blocking a relay and confirming the app resolves within the timeout window
- [ ] **d-tag dedup:** After fetching, confirm that the same `pubkey:d` combination appears at most once in the article list
- [ ] **Title fallback:** Verify that events with no `title` tag render "Untitled" or equivalent, not blank
- [ ] **Profile JSON guard:** `JSON.parse(kind0.content)` wrapped in try/catch; broken profiles show pubkey fallback
- [ ] **Avatar onError:** `<img onError>` wired to fallback; verify by pointing `picture` at a non-existent URL in dev
- [ ] **Markdown sanitization:** Paste `<script>alert(1)</script>` into a test kind:30023 event content and confirm no execution
- [ ] **Hashtag lowercase:** Confirm "Bitcoin" and "bitcoin" are counted together and both matched by a single checkbox
- [ ] **AND empty-selection:** Unchecking all checkboxes shows all 21 articles in both AND and OR mode
- [ ] **GitHub Pages base:** Deployed site loads all JS/CSS assets (check Network tab); no 404s on `main.js`
- [ ] **Mixed content:** Deployed HTTPS site renders profile pictures with `http://` URLs gracefully (either upgraded or fallback shown)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| EOSE hang in production | LOW | Add `maxWait` parameter; one-line change, redeploy |
| Duplicate articles visible | LOW | Add dedup map in data normalization; no API changes |
| XSS from Markdown | MEDIUM | Add `rehype-sanitize` plugin; test all existing article content renders correctly |
| Wrong Vite `base` on deploy | LOW | Update `vite.config.ts`, push, redeploy via GitHub Actions |
| SPA routing 404s | MEDIUM | Switch to `HashRouter` or copy `index.html` → `404.html` in build step |
| Hashtag case splitting | LOW | Add `.toLowerCase()` to tag normalization; recount from existing data |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| EOSE hang (no maxWait) | Relay subscription phase | Block one relay in dev; confirm resolution within timeout |
| d-tag dedup missing | Data normalization / relay subscription phase | Check rendered list for duplicate article titles |
| Missing title fallback | Event parsing phase | Load events with no title tag; confirm fallback renders |
| Markdown XSS | Article expansion phase | Inject `<script>` in test event content; confirm no execution |
| Vite base misconfiguration | GitHub Actions deploy phase | Inspect deployed HTML source for correct asset paths |
| SPA routing 404 | GitHub Actions deploy phase | Share a direct URL; confirm recipient sees the app |
| kind:0 malformed JSON | Profile resolution phase | Test with pubkeys known to have empty/invalid kind:0 events |
| Mixed-content HTTP images | Profile resolution / article display phase | Deploy to HTTPS; check Network tab for mixed-content warnings |
| Hashtag case inconsistency | Facet sidebar phase | Search real relay data for mixed-case t tags |
| AND/OR empty-selection edge case | Facet filter phase | Unit test: empty selection → all articles visible |

---

## Sources

- [NIP-23 Long-form Content](https://github.com/nostr-protocol/nips/blob/master/23.md) — tag optionality confirmed
- [NIP-01 Basic Protocol](https://nips.nostr.com/1) — EOSE semantics, replaceable event dedup rules
- [nostr-tools SimplePool — Context7](https://context7.com/nbd-wtf/nostr-tools/llms.txt) — `querySync`/`maxWait` behavior confirmed
- [NIP-33 Parameterized Replaceable Events](https://nostr.co.uk/nips/nip-33/) — d-tag coordinate semantics
- [nostr-tools abstract-pool.ts](https://github.com/nbd-wtf/nostr-tools/blob/master/abstract-pool.ts) — `eoseTimeout: params.maxWait` implementation detail
- [Vite Static Deploy Guide](https://vite.dev/guide/static-deploy) — GitHub Pages `base` config
- [GitHub Pages SPA 404 pattern](https://dev.to/lico/handling-404-error-in-spa-deployed-on-github-pages-246p)
- [react-markdown XSS / rehype-sanitize](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)
- [NIP-24 Extra metadata fields](https://nips.nostr.com/24) — `display_name` vs `name` field conventions
- [Nostr tag indexing spec](https://nips.nostr.com/1) — single-letter tags, only first value indexed

---
*Pitfalls research for: Nostr kind:30023 long-form reader SPA (React + shadcn/ui + Vite + GitHub Pages)*
*Researched: 2026-06-05*
