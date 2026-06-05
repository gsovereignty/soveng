# Project Research Summary

**Project:** Soveng — Nostr Long-Form Reader (kind:30023)
**Domain:** Client-only Nostr web app / static SPA
**Researched:** 2026-06-05
**Confidence:** HIGH

## Executive Summary

Soveng is a read-only Nostr long-form reader: a React + Vite static SPA, deployed to
GitHub Pages, that subscribes to a fixed set of public relays over WebSocket, collects
the 21 most recent kind:30023 (NIP-23) articles, resolves their authors via kind:0
metadata, and presents them as a terminal-styled browsable list with hashtag faceting
(AND/OR) and inline Markdown expansion. There is no backend — all fetching, dedup,
filtering, and rendering happen in the browser.

Research strongly converges on a lean stack: **nostr-tools** (`SimplePool`) over NDK or
applesauce — NDK's 4.3MB bundle pulls in code-sandbox/syntax-highlighting features a
reader never uses, and applesauce forces RxJS for what is fundamentally "collect 21
events then stop." Markdown is rendered with **react-markdown + remark-gfm +
rehype-sanitize** (secure-by-default; sanitization is mandatory because article authors
are untrusted). UI is **shadcn/ui on Tailwind v4** themed to a terminal aesthetic via
OKLCH `@theme` tokens and a forced monospace font stack.

The dominant risks are all in the relay/data layer, not the UI. Relays do not reliably
send EOSE, so a `maxWait` timeout is non-negotiable (the #1 cause of a blank production
page). kind:30023 is an addressable/replaceable event, so the client must dedupe by
`kind:pubkey:d` coordinate keeping the newest `created_at` *before* slicing to 21.
Nearly all NIP-23 metadata tags are optional, so parsing needs fallbacks everywhere.
Hashtag `t` values aren't normalized, so they must be lowercased before counting/filtering.
And the Vite `base` path must match the Pages subdirectory or every asset 404s — a
failure invisible in local dev. A genuine differentiator surfaced: no existing Nostr
long-form reader offers sidebar checkbox faceting with an AND/OR toggle plus inline
reading; competitors all navigate to separate article pages.

## Key Findings

### Recommended Stack

A minimal, tree-shaken, fully static stack. See `STACK.md` for versions and rationale.

**Core technologies:**
- **nostr-tools `SimplePool`** (~2.23.x): multi-relay subscribe/collect — smallest viable footprint, API maps directly to the use case. Import via subpaths (`nostr-tools/pool`, `/kinds`, `/nip19`) for tree-shaking. *(Avoid NDK — bloated; avoid applesauce — mandatory RxJS.)*
- **react-markdown + remark-gfm + rehype-sanitize**: render untrusted article Markdown safely. Never add `rehype-raw` without `rehype-sanitize`.
- **React + Vite + TypeScript**: static SPA build.
- **shadcn/ui + Tailwind v4** (`@tailwindcss/vite`, `@theme inline` tokens): terminal theme via OKLCH palette + `--font-sans: var(--font-mono)`. Consider self-hosting the mono font (`@fontsource/jetbrains-mono`) to stay fully self-contained.
- **GitHub Actions → Pages**: `base: '/<repo>/'` in `vite.config.ts`; copy `dist/index.html` → `dist/404.html` for SPA fallback.

### Expected Features

See `FEATURES.md`.

**Must have (table stakes):**
- Fetch + render the 21 most recent kind:30023 articles (title, author, timestamp)
- Author name/picture from kind:0, batch-fetched in ONE subscription for all pubkeys
- Distinct error vs empty states ("all relays timed out" ≠ "no articles match tags")
- Graceful partial results when individual relays fail

**Should have (competitive / differentiators):**
- Hashtag sidebar facets with per-tag counts + AND/OR toggle (no competitor has this)
- Inline Markdown expand-in-list (competitors navigate away)
- "Match ALL / Match ANY" labels instead of bare AND/OR; OR as default

**Defer (v1.x polish, non-blocking):**
- `summary` and `image` card enrichment, tag pills, per-relay status indicator

### Architecture Approach

See `ARCHITECTURE.md`. Client-only, two-stage fetch, derived state computed not stored.

**Major components:**
1. **Relay/data layer** (`lib/pool.ts`) — single module-level `SimplePool` (never in React state/StrictMode-safe); `subscribeMany` with `oneose` + ~8s fallback timeout.
2. **Two-stage fetch** — Stage 1: kind:30023 articles → dedupe by coordinate → sort/slice 21. Stage 2: ONE subscription `authors: [all 21 pubkeys]` for kind:0 profiles.
3. **State** — only `rawArticles` + `profiles` are stored; `parsedArticles`, `facets`, and `filteredArticles` are `useMemo`-derived in `<App />` (never store derived state).
4. **UI** — article list, article card (expandable inline Markdown), hashtag facet panel, AND/OR filter toggle.

### Critical Pitfalls

Top items from `PITFALLS.md`:

1. **No EOSE timeout** — relays hang forever; always pass `maxWait`/fallback timeout. (#1 blank-page cause.)
2. **Missing addressable dedup** — dedupe by `kind:pubkey:d`, keep newest `created_at`, *before* slicing to 21, or stale/duplicate articles appear.
3. **Assuming NIP-23 tags exist** — only `d` is required; `title`/`summary`/`image`/`published_at` are optional → fallbacks everywhere or cards crash/blank.
4. **XSS via raw Markdown HTML** — authors are untrusted; keep react-markdown's default stripping or pair `rehype-raw` with strict `rehype-sanitize`.
5. **Wrong Vite `base` / unnormalized tags** — `base` must match the Pages subpath (assets 404 only when deployed); lowercase `t` tags before counting/filtering or the sidebar fractures.

## Implications for Roadmap

Build order is deliberately **deploy-first, data-second, UI-last** so every step is
verifiable at a real Pages URL and the data layer is clean before UI consumes it.

### Phase 1: Scaffold & Deploy Pipeline
**Rationale:** A working static deploy must exist before any Nostr code so all later work is verifiable at the real Pages URL; the terminal theme touches every component, so establish it early.
**Delivers:** Vite + React + TS project, shadcn/ui + Tailwind v4 terminal theme, GitHub Actions → Pages workflow (correct `base`, 404.html fallback), a deployed placeholder page.
**Addresses:** terminal UI skeleton (FEATURES table stakes).
**Avoids:** wrong-`base` asset 404s (PITFALLS #5).

### Phase 2: Nostr Data Layer
**Rationale:** Highest-risk layer; must produce clean, normalized article data before UI consumes it.
**Delivers:** module-level `SimplePool`; two-stage fetch (articles → batch kind:0 profiles); EOSE timeout; coordinate dedup; sort/slice to 21; parsed article model with safe tag fallbacks; lowercased `t` tags.
**Uses:** nostr-tools `SimplePool` (STACK).
**Implements:** relay/data layer + two-stage fetch (ARCHITECTURE 1–2).
**Avoids:** EOSE hang, missing dedup, optional-tag crashes (PITFALLS #1–3).

### Phase 3: Article List, Facets & Inline Reader
**Rationale:** Depends on a stable normalized article list from Phase 2.
**Delivers:** article list + cards (title/author/timestamp), `useMemo`-derived hashtag facets with counts, checkbox filtering, AND/OR ("Match ALL/ANY") toggle defaulting to ANY, inline `react-markdown` expand with sanitization, distinct error/empty states.
**Uses:** react-markdown + rehype-sanitize (STACK).
**Implements:** derived state + UI components (ARCHITECTURE 3–4).
**Avoids:** XSS, tag case-fracturing, error/empty-state confusion (PITFALLS #4–5, FEATURES).

### Phase Ordering Rationale
- Deploy pipeline first → every later phase is validated on the live Pages URL, catching `base`/asset issues immediately rather than at the end.
- Data layer before UI → UI components receive clean, deduped, normalized data; relay quirks are isolated to one phase.
- Facets + reader last → they are pure consumers of Phase 2 data and Phase 1 styling; lowest protocol risk.

### Research Flags
Phases likely needing deeper research during planning:
- **Phase 2:** relay behavior varies across the 4 default relays — EOSE timeout tuning and batch kind:0 query limits (`authors: [...]`) need validation against live relays.

Phases with standard patterns (can skip phase-research):
- **Phase 1:** well-documented Vite/shadcn/Pages patterns.
- **Phase 3:** standard React derived-state + react-markdown patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions/bundle sizes verified via npm; APIs via Context7 + official docs |
| Features | HIGH | NIP-23/NIP-01/NIP-24 verified against specs; competitor scan MEDIUM |
| Architecture | HIGH | Subscription/dedup confirmed vs nostr-tools source + NIPs; React wiring MEDIUM (convention) |
| Pitfalls | HIGH | EOSE/dedup/optional-tags/XSS/base all verified against source + specs |

**Overall confidence:** HIGH

### Gaps to Address
- **Relay timeout tuning:** exact `maxWait` and partial-result handling need live testing in Phase 2.
- **`published_at` reliability:** if commonly absent, timestamp display falls back to `created_at` (last edit) — decide display semantics in Phase 3.
- **Batch kind:0 query limits:** confirm relays accept all 21 pubkeys in one `authors` filter (likely fine) during Phase 2.
- **Terminal palette hues:** OKLCH tokens are a starting point; needs visual iteration in the UI work.

## Sources

### Primary (HIGH confidence)
- nostr-tools (npm + source `abstract-pool.ts`) — SimplePool, subscribeMany, EOSE/maxWait
- react-markdown / rehype-sanitize (Context7 + docs) — secure Markdown rendering
- shadcn/ui + Tailwind v4 official docs — Vite setup, `@theme` theming
- Vite docs + GitHub Actions Pages pattern — base path, SPA 404 fallback
- NIPs: NIP-01, NIP-23, NIP-24, NIP-33 — event kinds, addressable events, profile fields

### Secondary (MEDIUM confidence)
- Habla / YakiHonne (web + GitHub) — competitor feature scan
- UX sources on AND/OR faceting labels — "Match ALL/ANY" recommendation

---
*Research completed: 2026-06-05*
*Ready for roadmap: yes*
