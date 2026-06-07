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

### Active

- [ ] Fetch the 21 most recent kind:30023 articles from a default set of public relays
- [ ] Resolve each article author's name and picture from kind:0 profile metadata
- [ ] Show a hashtag facet list (from `t` tags) with a count per hashtag
- [ ] Hashtags are selectable via checkboxes to filter the article list
- [ ] AND/OR toggle controls whether selected hashtags combine inclusively or exclusively
- [ ] Clicking an article expands its Markdown content inline
- [ ] Terminal-styled UI built with React + shadcn/ui (monospace type, terminal palette)
- [ ] Builds to static assets and deploys to GitHub Pages

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
| React + shadcn/ui + Vite over vanilla HTML | Standing preference for shadcn components; Vite gives clean static GitHub Pages builds | — Pending |
| Default relay set (damus/nos.lol/nostr.band/primal) | Broad coverage of public long-form content without user config | — Pending |
| Inline Markdown expand over external reader link | Keeps reading experience in-app; no dependency on njump.me | — Pending |
| Terminal visual style | User preference; distinctive, fits a developer-oriented Nostr tool | — Pending |
| Resolve authors via kind:0 metadata | Standard Nostr way to get display name + picture for a pubkey | — Pending |
| Hashtag facets derived from fetched 21 only | Keeps counts truthful to the visible set; no extra relay queries | — Pending |

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
*Last updated: 2026-06-07 — Phase 3 (article-list) complete: real Nostr articles render end-to-end with title, author, and timestamp.*
