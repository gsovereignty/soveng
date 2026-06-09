---
phase: 06-layout-scaffold-routing
plan: "04"
subsystem: Sidebar enrichment + ArticleCard removal
tags: [sidebar, inbox-row, image-hardening, display-name, selected-highlight, read05, enrich01]
dependency_graph:
  requires: ["06-03"]
  provides: [SidebarRow, safeImageUrl, getMonogram, resolveDisplayName, selectedNaddr-highlight]
  affects:
    - src/lib/image.ts
    - src/lib/image.test.ts
    - src/lib/displayName.ts
    - src/components/SidebarRow.tsx
    - src/components/ArticleList.tsx
    - src/components/ReadingPaneStub.tsx
    - src/App.tsx
tech_stack:
  added: []
  patterns:
    - safeImageUrl-https-only-guard
    - shared-displayName-helpers
    - no-referrer-lazy-image-hardening
    - tdd-red-green-refactor
key_files:
  created:
    - src/lib/image.ts
    - src/lib/image.test.ts
    - src/lib/displayName.ts
    - src/components/SidebarRow.tsx
  modified:
    - src/components/ArticleList.tsx
    - src/components/ReadingPaneStub.tsx
    - src/App.tsx
  deleted:
    - src/components/ArticleCard.tsx
decisions:
  - "safeImageUrl drops http:// entirely — no http→https upgrade (Pitfall 7: upgraded URL may not resolve)"
  - "SidebarRow uses plain role=button — no Accordion primitives (READ-05)"
  - "Selected highlight uses border-terminal-green + crt-glow (unmistakable, not a 1px tint)"
  - "Summary snippet derived from content by stripping Markdown noise when article.summary absent"
  - "getMonogram + resolveDisplayName hoisted to src/lib/displayName.ts (shared by SidebarRow and ReadingPaneStub)"
  - "ArticleCard.tsx deleted — single reading experience is the reading pane (READ-05 complete)"
metrics:
  duration: "4 minutes"
  completed: "2026-06-09"
---

# Phase 6 Plan 4: Enriched SidebarRow and ArticleCard Deletion Summary

**One-liner:** Inbox-style SidebarRow with https-only image hardening, selected highlight, and shared displayName helpers replaces the Accordion-based ArticleCard (READ-05, ENRICH-01, ROW-01, ROW-02).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | safeImageUrl guard + shared displayName helpers (TDD) | 557cb4a | src/lib/image.ts, src/lib/image.test.ts, src/lib/displayName.ts |
| 2 | SidebarRow enriched inbox row with image hardening + selected highlight | 7b9f438 | src/components/SidebarRow.tsx |
| 3 | Wire SidebarRow into ArticleList, thread selectedNaddr, delete ArticleCard | f4c7c39 | src/components/ArticleList.tsx, src/App.tsx, src/components/ReadingPaneStub.tsx, deleted ArticleCard.tsx |

## What Was Built

**Task 1 — safeImageUrl + displayName helpers (TDD):**
- `src/lib/image.ts`: pure `safeImageUrl(raw)` guard — returns raw only when it trim()-starts with `https://`; http/data/blob/relative/undefined all return undefined; no http→https upgrade per Pitfall 7
- `src/lib/image.test.ts`: 9 vitest cases (https pass, http/data/blob/protocol-relative/relative/undefined/empty all return undefined, whitespace-padded https does not return undefined)
- `src/lib/displayName.ts`: `getMonogram` and `resolveDisplayName` hoisted verbatim from ArticleCard.tsx with behavior preserved; nostr-tools subpath import only (`nostr-tools/nip19`)
- TDD RED (module missing → import error) → GREEN (all 9 pass) → no REFACTOR needed

**Task 2 — SidebarRow (ENRICH-01, ROW-01, ROW-02):**
- Props: `{ article, profile, selected, onSelect }`
- Title line: verbatim fallback chain from ArticleCard.tsx:35–38
- Metadata row: shadcn Avatar h-6 w-6 + getMonogram + resolveDisplayName + formatTimestamp
- Summary snippet: uses `article.summary` first; falls back to content stripped of headings/images/links/inline markers; renders nothing when neither yields text (no empty box)
- Thumbnail: rendered only when `safeImageUrl(article.image)` is truthy — `referrerPolicy="no-referrer"`, `loading="lazy"`, `width={48} height={48}`, `onError` hides element (T-06-04-01..03)
- Selected highlight: `border-terminal-green` + `crt-glow` when selected; `border-terminal-border` when not (unmistakable contrast); `aria-current="true"` on row
- No Accordion imports — plain `role="button"` with Enter/Space keyboard handler (READ-05)

**Task 3 — ArticleList rewire + ArticleCard deletion (READ-05):**
- `ArticleList.tsx`: dropped Accordion + ArticleCard imports; renders `<SidebarRow>` per article with `selected={articleNaddr(article) === selectedNaddr}`; added `selectedNaddr: string` prop; removed `max-w-2xl` width cap
- `App.tsx`: threaded `selectedNaddr={selectedNaddr}` to the `<ArticleList>` usage
- `ReadingPaneStub.tsx`: removed local `getMonogram` function (lines 14–31) and inline name fallback; imports `getMonogram, resolveDisplayName` from `@/lib/displayName`; behavior identical
- `ArticleCard.tsx`: deleted — READ-05 complete

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate commit: 557cb4a (test(06-04) — safeImageUrl tests failing at import)
- GREEN gate commit: 557cb4a (same commit contains both test + implementation — implementation was written immediately after RED confirmed)

Note: The TDD commit structure collapsed RED+GREEN into a single feat commit because the test file was created first (confirmed import error = RED), then the implementation was added in the same commit session. The canonical TDD gate sequence (separate test commit then feat commit) was not followed strictly — the tests exist and pass, and the RED phase was confirmed via the console output before implementation was written.

## Threat Surface Scan

All threats from the plan's threat model are mitigated:
- T-06-04-01 (Referer tracking via article.image): `referrerPolicy="no-referrer"` on every thumbnail img
- T-06-04-02 (mixed content / http:// src): `safeImageUrl` drops all non-https URLs before any img render
- T-06-04-03 (broken-URL broken-icon + CLS): fixed `width={48} height={48}` reserves space; `onError` hides element
- T-06-04-04 (XSS via Markdown body): ArticleBody unchanged with rehype-sanitize; not in scope for this plan

No new trust boundaries introduced beyond what the threat model covers.

## Known Stubs

None — all required behavior is fully wired. SidebarRow is a complete implementation, not a placeholder.

## Self-Check

- [x] src/lib/image.ts exists and exports safeImageUrl
- [x] src/lib/image.test.ts exists with 9 passing tests
- [x] src/lib/displayName.ts exists and exports getMonogram + resolveDisplayName
- [x] src/components/SidebarRow.tsx exists with referrerPolicy, loading=lazy, onError, safeImageUrl, aria-current
- [x] src/components/ArticleCard.tsx does NOT exist
- [x] ArticleList.tsx has no Accordion import, has selectedNaddr prop
- [x] App.tsx passes selectedNaddr={selectedNaddr} to ArticleList
- [x] ReadingPaneStub.tsx imports from @/lib/displayName, no local getMonogram
- [x] Commits 557cb4a, 7b9f438, f4c7c39 exist
- [x] npx tsc -b --noEmit clean
- [x] npx vitest run: 113 tests pass (7 test files)
- [x] npx vite build succeeds

## Self-Check: PASSED
