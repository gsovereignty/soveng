---
phase: 06-layout-scaffold-routing
plan: "06"
subsystem: Mobile responsive layout — single-pane CSS-visibility swap + back control
tags: [mobile, responsive, css-visibility, back-navigation, mobile-01, mobile-02, mobile-03]
dependency_graph:
  requires: ["06-05"]
  provides: [responsive-shell, mobile-back-control, handle-suppressed-below-md]
  affects:
    - src/App.tsx
    - src/components/ReadingPaneStub.tsx
tech_stack:
  added: []
  patterns:
    - css-visibility-swap-both-panes-mounted
    - responsive-class-toggling-cn
    - mobile-back-clears-selection-and-hash
key_files:
  created: []
  modified:
    - src/App.tsx
    - src/components/ReadingPaneStub.tsx
decisions:
  - "cn() imported from @/lib/utils for conditional className composition on always-mounted inner wrappers"
  - "Sidebar inner wrapper: cn('flex flex-col h-full', selectedNaddr ? 'hidden md:flex' : 'flex') — below md hides list when reading; always visible at md+"
  - "Reading pane inner wrapper: cn('flex-1 overflow-y-auto h-full', selectedNaddr ? 'block md:block' : 'hidden md:block') — complementary to sidebar"
  - "ResizableHandle gets className='hidden md:flex' — drag affordance suppressed below md (MOBILE-03 / Pitfall 5)"
  - "Both ResizablePanels remain in the React tree at all times — list scroll position preserved on back (MOBILE-01 / Pitfall 14)"
  - "onBack() in App.tsx: setSelectedNaddr('') + window.location.hash = '' mirrors onSelectArticle pattern"
  - "‹ back button uses md:hidden — visible only below md; desktop 2-pane makes it unnecessary"
  - "Back button placed at top of article-present branch (e) only — placeholder/loading/404/hidden-filter states do not receive it"
metrics:
  duration: "5 minutes"
  completed: "2026-06-09"
---

# Phase 6 Plan 6: Mobile Responsive Layout Summary

**One-liner:** CSS-visibility swap between sidebar and reading pane below the `md` breakpoint (both panes always mounted, list scroll preserved — Pitfall 14), with a terminal-styled `‹ back` mobile-only control in the article-present reading pane and a suppressed drag handle below `md` — desktop 2-pane Resizable split unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Responsive shell — CSS-visibility list/reader swap below md, desktop split at md+ | 654282c | src/App.tsx |
| 2 | Mobile '‹ back' control in reading pane | 6f41586 | src/App.tsx, src/components/ReadingPaneStub.tsx |

## What Was Built

**Task 1 — Responsive shell (MOBILE-01, MOBILE-03):**
- Imported `cn()` from `@/lib/utils` in App.tsx to compose conditional classNames
- Sidebar left panel inner wrapper (`div.flex.flex-col.h-full`) now uses `cn("flex flex-col h-full", selectedNaddr ? "hidden md:flex" : "flex")`:
  - Below `md` with no selection: `flex` (list visible, full-screen)
  - Below `md` with selection: `hidden` (list hidden, reader takes full-screen)
  - At `md+`: always `md:flex` regardless of selection
- Reading pane right panel inner scroll wrapper (`div.flex-1.overflow-y-auto.h-full`) now uses `cn("flex-1 overflow-y-auto h-full", selectedNaddr ? "block md:block" : "hidden md:block")`:
  - Below `md` with no selection: `hidden` (reader not shown until article selected)
  - Below `md` with selection: `block` (reader full-screen)
  - At `md+`: always `md:block`
- `ResizableHandle` gains `className="hidden md:flex"` — drag affordance not interactive on mobile (MOBILE-03 / Pitfall 5)
- Both `ResizablePanel` elements remain in the React tree — their children (ArticleList, ReadingPaneStub) are always mounted; only the inner wrapper visibility toggles (Pitfall 14: scroll position preserved)
- `key={selectedNaddr}` preserved on the reading pane scroll wrapper (READ-03 — scroll-reset on article switch)
- Frozen memo chain (7 useMemos) unchanged

**Task 2 — Mobile back control (MOBILE-02):**
- `onBack()` handler added to AppShell next to `onSelectArticle`: calls `setSelectedNaddr('')` and `window.location.hash = ''` — clearing selection triggers CSS-visibility swap back to list; `hashchange` listener keeps state in sync
- `onBack` prop passed to `<ReadingPaneStub>` (2 occurrences in App.tsx: definition + prop pass)
- `onBack: () => void` added to `ReadingPaneStubProps` interface
- `‹ back` button added at the top of the article-present branch (e) in `ReadingPaneStub`:
  - `className="md:hidden ..."` — invisible at desktop, visible only on mobile
  - Terminal styling: `crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-3 py-1 mb-4 hover:bg-terminal-surface transition-colors cursor-pointer`
  - Label: `&#x2039; back` (‹ single left-angle, per MOBILE-02 spec)
  - `onClick={onBack}`
- Back control only in article-present branch — placeholder/cold-load/404/hidden-by-filter states do not show it (correct; those appear only when a hash is set and no article resolved or it is filtered)
- `setSelectedNaddr` does not appear in ReadingPaneStub — pane never mutates selection directly (Pitfall 3 preserved)

## Deviations from Plan

**1. [Rule 1 - Bug] Missing `cn` import**
- **Found during:** Task 1
- **Issue:** `cn()` utility was not imported in App.tsx; TypeScript reported `Cannot find name 'cn'` at lines 179 and 232
- **Fix:** Added `import { cn } from "@/lib/utils"` — the standard shadcn helper already present in the project
- **Files modified:** src/App.tsx
- **Commit:** 654282c (inline fix, same task)

## Threat Surface Scan

All threats from the plan's threat model are mitigated:
- T-06-06-01 (Mobile list scroll lost on back): CSS-visibility swap keeps both panes mounted; `onBack()` clears selection without unmounting the list — scroll position preserved (Pitfall 14)
- T-06-06-02 (Resizable drag handle on touch): `ResizableHandle` has `className="hidden md:flex"` — not rendered or interactive below `md`; resize is desktop-only (Pitfall 5)

No new trust boundaries, network endpoints, auth paths, or schema changes introduced. This plan is layout/visibility only.

## Known Stubs

None — MOBILE-01, MOBILE-02, and MOBILE-03 are fully implemented. No placeholder behavior remains in this plan's scope.

## Self-Check

- [x] `grep -c "hidden md:flex" src/App.tsx` = 2 (sidebar wrapper + ResizableHandle)
- [x] `grep -n "ResizableHandle" src/App.tsx` shows `className="hidden md:flex"` on the handle
- [x] `grep -c "key={selectedNaddr}" src/App.tsx` = 1 (reading pane scroll wrapper, READ-03 preserved)
- [x] No conditional unmount: `grep -E "selectedNaddr && <Resizable|selectedNaddr \? <" src/App.tsx` = 0
- [x] `grep -c "useMemo" src/App.tsx` = 7 (frozen memo chain unchanged)
- [x] `grep -c "onBack" src/components/ReadingPaneStub.tsx` = 3 (interface, destructure, onClick)
- [x] `grep -c "onBack" src/App.tsx` = 2 (definition + prop pass)
- [x] `grep -n "md:hidden" src/components/ReadingPaneStub.tsx` shows back button className
- [x] `grep -c "window.location.hash" src/App.tsx` = 4 (lazy init read + hashchange handler + onSelectArticle + onBack)
- [x] `grep -c "ArticleList" src/App.tsx` = 2 (import + mount — no conditional mount guard)
- [x] `npx tsc -b --noEmit` clean
- [x] `npx vitest run` passes — 113 tests in 7 files
- [x] `npx vite build` succeeds

## Self-Check: PASSED
