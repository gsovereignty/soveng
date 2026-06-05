# Roadmap: Soveng — Nostr Long-Form Reader

## Overview

Four vertical MVP phases that each leave the site deployable and incrementally more
capable: first a live Pages skeleton establishes the terminal theme and deploy pipeline;
then the data layer delivers clean normalized Nostr articles to the browser; then the
article list renders real content end-to-end; finally hashtag faceting and inline
Markdown reading complete the full v1 experience.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scaffold & Deploy** - Terminal-themed Vite + React app deployed live to GitHub Pages
- [ ] **Phase 2: Nostr Data Layer** - Robust relay fetching, dedup, timeout, and normalized article model
- [ ] **Phase 3: Article List** - Real articles rendered with title, author, timestamp, and error states
- [ ] **Phase 4: Filtering & Inline Reader** - Hashtag facet sidebar with AND/OR toggle and inline Markdown expand

## Phase Details

### Phase 1: Scaffold & Deploy
**Goal**: A terminal-themed React + shadcn/ui app is live on GitHub Pages serving a placeholder page
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):
  1. Visiting the GitHub Pages URL shows a styled placeholder page with monospace type and terminal color palette
  2. The Vite build produces static assets with the correct `base` path — no 404s when navigating the deployed URL
  3. A GitHub Actions push to main automatically builds and publishes the site, including a 404.html SPA fallback
**Plans**: 2 plans
Plans:
- [ ] 01-01-PLAN.md — Scaffold Vite+React+shadcn, terminal theme, reusable boot-sequence placeholder
- [ ] 01-02-PLAN.md — Vite base, SPA 404 fallback, GitHub Actions to Pages deploy
**UI hint**: yes

### Phase 2: Nostr Data Layer
**Goal**: The app connects to the default relay set, fetches and deduplicates kind:30023 articles, batch-resolves author profiles, and exposes a clean normalized article model with safe fallbacks
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. The app connects to all four default relays (damus.io, nos.lol, nostr.band, primal.net) on load
  2. Up to 21 kind:30023 articles are collected, deduped by `kind:pubkey:d` coordinate (newest wins), and sorted newest-first — with no stale or duplicate entries appearing in the list
  3. An EOSE/response timeout fires so that a hanging or unresponsive relay never blocks the page from rendering
  4. Author display data (name, picture) is resolved via a single batch kind:0 subscription covering all 21 pubkeys
  5. Articles with missing optional tags (`title`, `summary`, `image`, `published_at`) still produce a valid article record — no card crashes or blank fields due to absent metadata
**Plans**: TBD

### Phase 3: Article List
**Goal**: Real Nostr articles render end-to-end on the deployed Pages URL with title, author identity, timestamp, and correct loading/error/empty states
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-05
**Success Criteria** (what must be TRUE):
  1. Each article card shows its title (or a sensible fallback) along with the author's display name and picture
  2. Each article card shows a human-readable timestamp derived from `published_at` when present, else `created_at`
  3. A loading state is visible while the relay fetch is in progress
  4. A relay-error state (distinct from an empty-results state) is shown when all relays fail or time out
**Plans**: TBD
**UI hint**: yes

### Phase 4: Filtering & Inline Reader
**Goal**: Users can narrow the article list by hashtag with AND/OR logic and read any article's full Markdown content inline without leaving the page
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04, DISP-04
**Success Criteria** (what must be TRUE):
  1. A sidebar facet panel lists all hashtags derived from the fetched 21 articles' `t` tags, each showing a count of matching articles
  2. Checking one or more hashtag checkboxes filters the article list in real time
  3. The AND/OR toggle ("Match ALL" / "Match ANY") changes how selected hashtags combine — default is OR (Match ANY)
  4. An empty-filter state (no articles match the selected tags) is shown when the filter excludes all articles — distinct from the relay-error state
  5. Clicking an article expands its full body as sanitized Markdown rendered inline in the list; clicking again collapses it
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold & Deploy | 0/2 | Not started | - |
| 2. Nostr Data Layer | 0/? | Not started | - |
| 3. Article List | 0/? | Not started | - |
| 4. Filtering & Inline Reader | 0/? | Not started | - |
