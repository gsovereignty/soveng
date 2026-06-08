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

## Current State

**Shipped:** v1.1 Local ML Content Filtering (2026-06-08) — on top of v1.0 MVP (2026-06-07). Live at https://gsovereignty.github.io/soveng/.

The reader now hides spam, non-English, and sub-500-word articles using in-browser ML — a transformers.js ONNX spam classifier and a franc-min language gate, running off the main thread in a Web Worker, fail-open throughout. User-facing controls (on-by-default toggle, model download progress, hidden-article count, spam-confidence slider) ship alongside, with the zero-backend, works-for-every-visitor property intact.

**Next milestone goals (TBD via `/gsd-new-milestone`):** candidate work includes spam-quality follow-ups (domain-tuned model SPAM-05, "why filtered" disclosure SPAM-06), a pubkey mute list (MUTE-01), and the carried-forward v2 enrichment/config items. Also: reconcile the DATA-02 "21 most recent" text with shipped uncapped/reply-sorted behavior.

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
- [x] Hide non-English articles via in-browser language detection (franc-min, fail-open) — *Validated in Phase 5: ML Content Filtering (LANG-01/02)* — v1.1
- [x] Hide spam via an in-browser ML classifier (transformers.js ONNX) at a conservative ~0.90 threshold, fail-open — *Validated in Phase 5 (SPAM-01→04; GO verdict pinned 0.90)* — v1.1
- [x] Hide sub-500-word articles via an always-on length gate — *Validated in Phase 5 (LEN-01)* — v1.1
- [x] Run classification off the main thread in a Web Worker, under the /soveng/ base path, cached per event id, progressive hide-on-arrival — *Validated in Phase 5 (MLINF-01→03)* — v1.1
- [x] User-facing filter controls — on-by-default toggle (persisted), download progress, hidden count, spam-confidence slider (slider-at-max recovers false positives) — *Validated in Phase 5 (CTRL-01→06)* — v1.1

### Active

*v1.0 + v1.1 shipped — all requirements validated. Next-milestone requirements TBD via `/gsd-new-milestone`. Candidates: domain-tuned spam model (SPAM-05), per-article "why filtered" disclosure (SPAM-06), pubkey mute list (MUTE-01); carried v2 work — per-relay status (ENRICH-03), summary/image on cards (ENRICH-01), clickable tag pills (ENRICH-02), user-configurable relays (CONF-01), adjustable feed length (CONF-02). Also: reconcile DATA-02 text with the shipped uncapped/reply-sorted behavior.*

### Out of Scope

- Authoring / publishing articles — read-only discovery client, not a writing tool
- Login / signing / NIP-07 — no user identity needed to browse public content
- Comments, likes, zaps, or other social interactions — discovery only, not engagement
- Pagination / infinite scroll beyond the 21 articles — fixed-size curated view
- User-configurable relays (v1) — ships with a fixed default relay set
- Server / backend / database — static site only, all fetching happens client-side
- Server-side / build-time classification (v1.1) — violates zero-backend; all ML runs in the visitor's browser
- Multi-language support beyond English (v1.1) — the language gate is a binary is-English test
- Per-article spam-score badges on visible articles (v1.1) — clutters the reading view; hidden-count + slider cover transparency

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
- **Current state (after v1.1):** Shipped and live at https://gsovereignty.github.io/soveng/.
  v1.1 added in-browser ML content filtering across 1 phase / 6 plans (41 files, +7,583 / −632).
  Stack additions: @huggingface/transformers (ONNX spam classifier in a Web Worker singleton,
  numThreads=1, version-pinned wasmPaths CDN), franc-min (language gate). Base stack unchanged:
  Vite 8 + React 19 + TS 5, shadcn/ui (new-york, Tailwind v4), nostr-tools 2.23.5 (SimplePool,
  subpath imports), react-markdown + remark-gfm + rehype-sanitize, Vitest for pure helpers/reducer/hook.
- **Content-filtering model:** classification runs only in the browser, off the main thread,
  fail-open everywhere; spam threshold pinned at 0.90 after a live-URL GO verdict. The 500-word
  length gate is always on; spam + language filtering is on-by-default and user-toggleable.

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
| In-browser ML only (no backend classification) — v1.1 | Preserve zero-backend, works-for-every-visitor property | ✓ Good — transformers.js ONNX in a Web Worker, verified on live /soveng/ |
| SPAM_THRESHOLD = 0.90 (not SMS-model 0.50) — v1.1 | Domain shift from SMS training data; avoid over-filtering crypto/Nostr articles | ✓ Good — live GO verdict confirmed legitimate articles not over-filtered; pinned with validation comment |
| Worker + ONNX as module-level singleton, numThreads=1, pinned wasmPaths — v1.1 | StrictMode-safe; works under /soveng/ base path with no SAB/wasm-404 issues | ✓ Good — all 5 ML-on-Pages pitfalls cleared on live URL |
| Cheap-gates-first, score-cache + instant re-threshold — v1.1 | Avoid inference on cheaply-cut articles; slider re-thresholds without re-running the model | ✓ Good — single visibleArticles memo, surgical integration |
| Fold Phases 6 & 7 into Phase 5 — v1.1 | Filter feature + controls ship as one coherent slice | ✓ Good — single-phase milestone, no orphaned scope |
| CTRL-06 folded into the spam-confidence slider — v1.1 | Slider-at-max disables spam filtering, surfacing false positives — no separate "show hidden" control needed | ✓ Good — one fewer control, recovery still possible |

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
*Last updated: 2026-06-08 after v1.1 milestone — Phase 5 shipped in-browser ML content filtering (spam + language + length, fail-open, with user controls). All 16 v1.1 requirements validated (CTRL-06 reinterpreted into the slider). Live at https://gsovereignty.github.io/soveng/.*
