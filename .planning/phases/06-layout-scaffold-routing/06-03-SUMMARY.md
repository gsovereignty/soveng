---
phase: 06-layout-scaffold-routing
plan: "03"
subsystem: App routing + ReadingPaneStub
tags: [routing, deep-link, hash, naddr, reading-pane, stub]
dependency_graph:
  requires: ["06-01", "06-02"]
  provides: [selectedNaddr-state, selectedArticle-memo, hashchange-sync, ReadingPaneStub, onSelectArticle-handler]
  affects: [src/App.tsx, src/components/ReadingPaneStub.tsx, src/components/ArticleList.tsx]
tech_stack:
  added: []
  patterns: [hash-based-routing, strictmode-safe-hashchange, selectedArticle-memo-append, try-catch-npub-fallback]
key_files:
  created:
    - src/components/ReadingPaneStub.tsx
  modified:
    - src/App.tsx
    - src/components/ArticleList.tsx
decisions:
  - "Hash-based deep linking via window.location.hash — no router library (v1.2 roadmap decision)"
  - "selectedNaddr initialized synchronously from URL hash (P12/P13) — lazy useState initializer reads hash.slice(1)"
  - "StrictMode-safe hashchange useEffect mirrors useClassification.ts:166–172 cleanup pattern (P16)"
  - "selectedArticle appended after filteredArticles — only chain append (P11); searches filteredArticles first, sortedArticles fallback for cold-load and filter-hidden (P2)"
  - "404 branch tied to status !== 'streaming' (stream lifecycle, not a timer — D-09)"
  - "getMonogram copied into ReadingPaneStub (not hoisted) — ArticleCard is deleted in Phase 7"
  - "ArticleList rows wrapped in clickable div (role=button) — additive, accordion expand preserved (Phase 7 deletes component)"
  - "ReadingPaneStub article header: no Markdown body (D-06) — Phase 7 inserts ArticleBody below this header"
metrics:
  duration: "4 minutes"
  completed: "2026-06-09"
---

# Phase 6 Plan 3: Deep-Link Routing and ReadingPaneStub Summary

**One-liner:** Hash-based deep-link routing wired end-to-end — selectedNaddr state + hashchange sync + selectedArticle reactive memo in AppShell, ReadingPaneStub component with four terminal states, and clickable sidebar rows that push naddr to the URL hash.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add selectedNaddr state, hashchange sync, selectedArticle memo | 56d6585 | src/App.tsx |
| 2 | Create ReadingPaneStub component (header + placeholder/loading/404 states) | 0f89825 | src/components/ReadingPaneStub.tsx |
| 3 | Wire row selection and mount ReadingPaneStub into reading pane | 9afba87 | src/App.tsx, src/components/ArticleList.tsx |

## What Was Built

**Task 1 — Routing state in AppShell (LINK-01..03):**
- `selectedNaddr` useState with synchronous lazy initializer reading `window.location.hash.slice(1) || ''` (P12/P13)
- StrictMode-safe hashchange useEffect: attaches `onHashChange` listener, cleanup calls `removeEventListener` with same reference (P16 — mirrors useClassification.ts:166–172)
- `selectedArticle` useMemo appended after `filteredArticles` (the only chain append — P11): returns null if no naddr; searches `filteredArticles` first (filter-hidden case), falls back to `sortedArticles` (cold-load reactive case — P2); deps `[selectedNaddr, filteredArticles, sortedArticles]`
- `onSelectArticle(article)` handler: computes naddr via `articleNaddr(article)`, calls `setSelectedNaddr(naddr)`, sets `window.location.hash = naddr` (hashchange listener keeps state in sync on back/forward — LINK-03)
- Frozen memo chain (`sortedArticles → visibleArticles → facets → dynamicCounts → filteredArticles`) byte-for-byte unchanged

**Task 2 — ReadingPaneStub (D-06..09):**
- Four render states: (a) `!selectedNaddr` → `> select an article to read`; (b) `selectedNaddr && !article && status === 'streaming'` → `> resolving article from relays…`; (c) `selectedNaddr && !article && status !== 'streaming'` → `[404] article not found on connected relays`; (d) article present → title + avatar + author + timestamp header
- Title fallback chain copied verbatim from ArticleCard.tsx:35–38 (DISP-01)
- Author name fallback with try/catch around `npubEncode` (03-01 / T-06-06), getMonogram helper inlined (ArticleCard deleted in Phase 7)
- Avatar + name + timestamp metadata row copied verbatim from ArticleCard.tsx:70–98 (grayscale/hue-rotate CRT-styled avatar, truncated name, `formatTimestamp(article.publishedAt)`)
- No AccordionItem/Trigger/Content wrapper; no Markdown body (D-06 — Phase 7 inserts ArticleBody below)
- All nostr-tools imports via subpath only (`nostr-tools/nip19`)

**Task 3 — Selection wiring (LINK-01):**
- `ArticleList`: added `onSelectArticle?: (article: Article) => void` prop; each row wrapped in `<div role="button" tabIndex={0} onClick onKeyDown>` around existing `<ArticleCard>` (additive — accordion expand preserved)
- `App.tsx`: passes `onSelectArticle={onSelectArticle}` to sidebar `ArticleList`
- `App.tsx`: static Plan-02 placeholder div replaced with `<ReadingPaneStub article={selectedArticle ?? null} profile={selectedArticle ? profiles.get(selectedArticle.pubkey) : undefined} selectedNaddr={selectedNaddr} status={status} />`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The ReadingPaneStub header renders title + author + timestamp with no Markdown body (intentional per D-06). Phase 7 will insert `<ArticleBody>` below the header stub. This is explicitly forward-compatible, not throwaway.

## Threat Surface Scan

- URL hash (`window.location.hash.slice(1)`) flows into `selectedNaddr` and is compared by string equality against `articleNaddr()` outputs only — a malformed or attacker-crafted naddr simply matches nothing and falls to the [404] state (T-06-04 mitigated)
- ReadingPaneStub renders title/name/timestamp as React text children (auto-escaped) and avatar via shadcn AvatarImage — no raw HTML, no Markdown body this phase (T-06-05 mitigated)
- `npubEncode` wrapped in try/catch in both getMonogram and displayName fallback paths — malformed pubkey falls back to hex slice (T-06-06 mitigated)
- No new network endpoints, new auth paths, or schema changes introduced

## Self-Check

- [x] src/App.tsx contains selectedNaddr, hashchange, removeEventListener, selectedArticle, onSelectArticle
- [x] src/components/ReadingPaneStub.tsx exists with all three exact copy strings
- [x] src/components/ArticleList.tsx onSelectArticle prop wired
- [x] Commits 56d6585, 0f89825, 9afba87 exist in git log
- [x] npx tsc --noEmit clean
- [x] npm run build succeeds

## Self-Check: PASSED
