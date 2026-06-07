# Soveng — Nostr Long-Form Reader

## What This Is

A single-page web app that fetches the 21 most recent kind:30023 (NIP-23 long-form)
articles from a default set of public Nostr relays and presents them as a browsable,
terminal-styled reading list. Each article shows its title, author (name + picture
resolved from kind:0 profile metadata), and timestamp. A faceted sidebar of hashtags —
derived from the articles' `t` tags, with per-tag counts and an AND/OR filter toggle —
lets readers narrow the list. Clicking an article expands its Markdown content inline.
It's a static site, built with Vite and deployable to GitHub Pages.

## Core Value

Discover and read recent Nostr long-form articles, filtered by hashtag — with zero
backend, served entirely as a static GitHub Pages site.

## Requirements

### Validated

- [x] Display each article's title, author name/picture, and timestamp — *Validated in Phase 3: article-list (terminal-styled ArticleCard + streaming ArticleList, with loading/empty/error states)*
- [x] Show a hashtag facet list (from `t` tags) with a count per hashtag — *Validated in Phase 4: filtering-inline-reader (buildFacets/computeDynamicCounts + sticky FilterBar with live counts)*
- [x] Hashtags are selectable via checkboxes to filter the article list — *Validated in Phase 4: filtering-inline-reader (checkbox facets wired to filterArticles helper)*
- [x] AND/OR toggle controls whether selected hashtags combine inclusively or exclusively — *Validated in Phase 4: filtering-inline-reader (Match ANY/ALL toggle; AND predicate unit-tested after CR-01 fix)*
- [x] Clicking an article expands its Markdown content inline — *Validated in Phase 4: filtering-inline-reader (controlled Accordion + sanitized ArticleBody via react-markdown + rehype-sanitize)*
- [x] Fetch recent kind:30023 articles from a default set of public relays — *Validated in Phase 2: nostr-data-layer (SimplePool streaming, dedup-by-coordinate, EOSE/maxWait timeout). Note: fixed 21 cap lifted and sort changed to reply-count via quick task 260607-vqt.* — v1.0
- [x] Resolve each article author's name and picture from kind:0 profile metadata — *Validated in Phase 2: nostr-data-layer (batched single kind:0 subscription, newest-wins profile Map)* — v1.0
- [x] Terminal-styled UI built with React + shadcn/ui (monospace type, terminal palette) — *Validated in Phase 1: scaffold-deploy (green-phosphor OKLCH, CRT chrome, JetBrains Mono)* — v1.0
- [x] Builds to static assets and deploys to GitHub Pages — *Validated in Phase 1: scaffold-deploy (Vite base /soveng/, GitHub Actions Pages deploy, SPA 404 fallback)* — v1.0

### Active

*v1.0 shipped — all v1 requirements validated. Next-milestone requirements TBD via `/gsd-new-milestone`. Candidate v2 work: per-relay status (ENRICH-03), summary/image on cards (ENRICH-01), clickable tag pills (ENRICH-02), user-configurable relays (CONF-01), adjustable feed length (CONF-02). Also: reconcile DATA-02 text with the shipped uncapped/reply-sorted behavior.*

### Out of Scope

- Authoring / publishing articles — read-only discovery client, not a writing tool
- Login / signing / NIP-07 — no user identity needed to browse public content
- Comments, likes, zaps, or other social interactions — discovery only, not engagement
- Pagination / infinite scroll beyond the 21 articles — fixed-size curated view
- User-configurable relays (v1) — ships with a fixed default relay set
- Server / backend / database — static site only, all fetching happens client-side

## Context

- **Protocol:** Nostr. Articles are kind:30023 (NIP-23 long-form content), addressable
  events whose body is Markdown. Hashtags live in `t` tags. Author display data
  (name, picture) comes from the author's kind:0 metadata event, fetched separately.
- **Relays (default set):** relay.damus.io, nos.lol, relay.nostr.band, relay.primal.net.
  Connected over WebSocket; the app subscribes, collects events, dedupes, and sorts
  newest-first to take the top 21.
- **Hashtag semantics:** facets are derived only from the `t` tags present across the
  fetched 21 articles. AND = article must carry all checked tags; OR = article carries
  any checked tag.
- **Deployment target:** GitHub Pages. Vite build output served as static files;
  requires correct `base` path config and a GitHub Actions deploy workflow.
- **Current state (after v1.0):** Shipped and live at https://gsovereignty.github.io/soveng/.
  ~2,436 LOC TypeScript/TSX across 4 phases / 9 plans. Stack: Vite 8 + React 19 + TS 5,
  shadcn/ui (new-york, Tailwind v4), nostr-tools 2.23.5 (SimplePool, subpath imports),
  react-markdown + remark-gfm + rehype-sanitize, Vitest for pure helpers/reducer.

## Constraints

- **Tech stack**: React + shadcn/ui + Vite — per standing preference to use existing
  shadcn components rather than build new UI components from scratch.
- **Hosting**: Must build to static assets deployable on GitHub Pages — no server-side
  runtime, no backend, no environment secrets.
- **Data source**: Live Nostr relays over WebSocket — must tolerate slow/unresponsive
  relays and partial results gracefully.
- **UI aesthetic**: Terminal look — monospace typography, terminal color palette
  (green-on-black phosphor default), themed via shadcn/Tailwind tokens.
- **Article count**: Fixed at 21 most recent — not a configurable feed length in v1.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + shadcn/ui + Vite over vanilla HTML | Standing preference for shadcn components; Vite gives clean static GitHub Pages builds | ✓ Good — clean static build, fast HMR throughout v1.0 |
| Default relay set (damus/nos.lol/nostr.band/primal) | Broad coverage of public long-form content without user config | ✓ Good — sufficient article coverage for the reader |
| Inline Markdown expand over external reader link | Keeps reading experience in-app; no dependency on njump.me | ✓ Good — shipped via sanitized Accordion reader |
| Terminal visual style | User preference; distinctive, fits a developer-oriented Nostr tool | ✓ Good — green-phosphor CRT chrome, well received |
| Resolve authors via kind:0 metadata | Standard Nostr way to get display name + picture for a pubkey | ✓ Good — batched single subscription, upgrade-in-place |
| Hashtag facets derived from fetched articles only | Keeps counts truthful to the visible set; no extra relay queries | ✓ Good — count-ranked facets with dynamic counts |
| nostr-tools SimplePool over NDK / applesauce | Smaller bundle (no shiki/sandpack), no RxJS overhead for collect-then-render | ✓ Good — module-level singleton, StrictMode-safe |
| Module-level pool singleton, never in React state | StrictMode double-mount safety | ✓ Good — no duplicate connections observed |
| rehype-sanitize, never rehype-raw | XSS safety on untrusted article bodies | ✓ Good — links re-flagged target=_blank post-sanitize |
| Top filter bar over left/right sidebar (D-01) | Simpler layout that still satisfies FILT-01/02 | ✓ Good — presentation delta, scope unchanged |
| Lift 21-cap, sort by reply count (260607-vqt) | Surface more-discussed articles; fixed cap felt arbitrary | ⚠️ Revisit — diverges from documented "21 most recent, newest first"; reconcile requirement text next milestone |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-07 after v1.0 milestone — all 4 phases shipped (scaffold/deploy, data layer, article list, filtering + inline reader). All 18 v1 requirements validated. Live at https://gsovereignty.github.io/soveng/.*
