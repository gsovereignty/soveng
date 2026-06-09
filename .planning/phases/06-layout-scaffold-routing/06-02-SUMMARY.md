---
phase: 06-layout-scaffold-routing
plan: "02"
subsystem: App shell + FilterBar
tags: [layout, resizable, sidebar, viewport, shadcn]
dependency_graph:
  requires: ["06-01"]
  provides: [2-pane-shell, sidebar-controls, reading-pane-placeholder]
  affects: [src/App.tsx, src/components/FilterBar.tsx]
tech_stack:
  added: []
  patterns: [resizable-panel-group, inner-overflow-y-auto-wrapper, h-screen-flex-shell, shrink-0-pinned-header]
key_files:
  created: []
  modified:
    - src/App.tsx
    - src/components/FilterBar.tsx
decisions:
  - "ResizablePanelGroup uses orientation prop (not direction) — react-resizable-panels API"
  - "overflow-y-auto on inner div inside each ResizablePanel, never on the panel itself (P4/#3548)"
  - "h-screen + overflow-hidden outer shell for full-viewport height chain (P9)"
  - "shrink-0 pinned header inside sidebar flex-col for controls; flex-1 overflow-y-auto sibling for list"
  - "Status branch error/empty branches kept as full-shell overlays with inline p-8 padding"
metrics:
  duration: "5 minutes"
  completed: "2026-06-09"
---

# Phase 6 Plan 2: Layout Shell Summary

**One-liner:** Full-viewport 2-pane Resizable shell replacing the centered column — sidebar (pinned filter controls header + independent scroll list, 35/25-50%) and reading-pane placeholder — with CRT aesthetic covering both panes and memo chain untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Drop sticky positioning from FilterBar (D-05) | 10f6f36 | src/components/FilterBar.tsx |
| 2 | Rebuild AppShell as 2-pane Resizable shell | 5849eee | src/App.tsx |

## What Was Built

**Task 1 — FilterBar de-sticky (D-05):**
- Removed `sticky top-0 z-20` from FilterBar root div (line 30)
- Retained `bg-terminal-bg border-b border-terminal-border py-2 px-0 mb-4` exactly
- No change to props interface, ToggleGroup, Checkbox facet list, or expander
- Controls now live in a `shrink-0` pinned header in Task 2 — sticky is both unnecessary and the research-flagged fragility (D-05)

**Task 2 — 2-pane AppShell (LAYOUT-01..04):**
- Outer wrapper: `crt-scanlines crt-flicker h-screen bg-terminal-bg flex flex-col overflow-hidden` — full-viewport shell with CRT aesthetic, both panes covered (LAYOUT-03)
- `ResizablePanelGroup orientation="horizontal"` as `flex-1` child handles the horizontal split
- Left `ResizablePanel` `defaultSize={35} minSize={25} maxSize={50}` (D-01/D-02): flex-col with `shrink-0` pinned header (title line + ContentFilterControls + FilterBar) and `flex-1 overflow-y-auto` inner div for the article list (P4/#3548 inner-scroll pattern)
- Right `ResizablePanel`: `h-full overflow-y-auto` inner div with `> select an article to read` placeholder (D-07)
- `ResizableHandle withHandle` between panels
- Status branch ladder preserved: error/empty branches render full-shell with `p-8` inline padding; boot branch renders BootSequence unchanged
- Frozen memo chain `sortedArticles → visibleArticles → facets → dynamicCounts → filteredArticles` (lines 37-77) byte-for-byte unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ResizablePanelGroup uses `orientation` prop, not `direction`**
- **Found during:** Task 2 (build verification — `npm run build` TypeScript error)
- **Issue:** Plan specified `direction="horizontal"` for ResizablePanelGroup; the react-resizable-panels library uses `orientation` (per type definitions in `node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts`). TypeScript error: `Property 'direction' does not exist`.
- **Fix:** Changed `direction="horizontal"` to `orientation="horizontal"` on ResizablePanelGroup.
- **Files modified:** src/App.tsx
- **Commit:** 5849eee

## Known Stubs

- Reading pane shows static `> select an article to read` placeholder — intentional per D-07; reading pane content arrives in Plan 03.
- Sidebar list reuses existing `ArticleList`/`ArticleCard` as stub — these components are deleted in Phase 7 per plan.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Reading pane renders a static terminal string only (T-06-02 accepted). Layout refactor reuses existing ArticleList/ArticleBody sanitization verbatim (T-06-03 accepted). No threat flags.

## Self-Check

- [x] src/components/FilterBar.tsx: `grep -c "sticky"` returns 0
- [x] src/components/FilterBar.tsx: `grep -c "border-b border-terminal-border"` returns 1
- [x] src/App.tsx: imports ResizablePanelGroup, ResizablePanel, ResizableHandle from @/components/ui/resizable
- [x] src/App.tsx: outer wrapper contains h-screen and overflow-hidden; min-h-screen = 0
- [x] src/App.tsx: left panel defaultSize=35 minSize=25 maxSize=50
- [x] src/App.tsx: overflow-y-auto on inner divs (3 occurrences), not on ResizablePanel
- [x] src/App.tsx: reading-pane contains `> select an article to read` placeholder
- [x] src/App.tsx: no selectedNaddr, window.location.hash, hashchange, selectedArticle references
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` succeeds
- [x] Commits 10f6f36, 5849eee exist in git log

## Self-Check: PASSED
