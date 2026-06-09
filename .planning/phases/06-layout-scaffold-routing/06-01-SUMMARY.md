---
phase: 06-layout-scaffold-routing
plan: "01"
subsystem: lib/nostr + styles + ui-primitives
tags: [nostr, nip19, height-chain, shadcn, resizable, tdd]
dependency_graph:
  requires: []
  provides: [articleNaddr, height-chain, shadcn-resizable]
  affects: [src/lib/nostr.ts, src/index.css, src/components/ui/resizable.tsx]
tech_stack:
  added: [react-resizable-panels]
  patterns: [nip19-subpath-import, try-catch-fallback, shadcn-cli-add]
key_files:
  created:
    - src/components/ui/resizable.tsx
  modified:
    - src/lib/nostr.ts
    - src/lib/nostr.test.ts
    - src/index.css
    - package.json
    - package-lock.json
decisions:
  - "naddrEncode subpath import (nostr-tools/nip19) — root barrel explicitly forbidden (CLAUDE.md)"
  - "coordinate fallback on encode failure — never throws (T-06-01 mitigation)"
  - "height:100% + overflow:hidden on html/body/#root — page scroll guard before ResizablePanel layout"
metrics:
  duration: "5 minutes"
  completed: "2026-06-09"
---

# Phase 6 Plan 1: Layout Scaffold Foundations Summary

**One-liner:** NIP-19 naddr deep-link helper, full-height CSS chain for panel layout, and shadcn resizable primitive — three isolated foundations every later plan in the phase depends on.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | articleNaddr helper (TDD) | 6b774ae | src/lib/nostr.ts, src/lib/nostr.test.ts |
| 2 | Full-height chain in index.css (P9) | 4854eac | src/index.css, src/lib/nostr.test.ts |
| 3 | shadcn resizable primitive | 2dacdde | src/components/ui/resizable.tsx, package.json, package-lock.json |

## What Was Built

**Task 1 — articleNaddr (TDD, LINK-01):**
- Exported `articleNaddr(article: Article): string` from `src/lib/nostr.ts`
- Imports `naddrEncode` from `nostr-tools/nip19` subpath (never root barrel)
- Wraps `naddrEncode({ kind: 30023, pubkey, identifier: d })` in try/catch; returns `article.coordinate` on failure (T-06-01 mitigation)
- Three test cases: naddr1 prefix, round-trip decode (kind:30023 + pubkey + identifier), malformed-pubkey coordinate fallback

**Task 2 — Height chain (P9/LAYOUT-02):**
- Added `html, body, #root { height: 100%; }` inside `@layer base` in `src/index.css`
- Added `html, body { overflow: hidden; }` page-scroll guard
- Existing `body` declaration and all other rules left intact

**Task 3 — shadcn resizable (LAYOUT-02):**
- Ran `npx shadcn@latest add resizable` to generate the CLI-canonical component
- `src/components/ui/resizable.tsx` exports `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`
- `react-resizable-panels` added to `package.json` dependencies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] naddrDecode does not exist in nostr-tools/nip19**
- **Found during:** Task 1 (TDD GREEN phase, build verification in Task 2)
- **Issue:** Plan specified `import { naddrDecode } from "nostr-tools/nip19"` for the round-trip test assertion; this export does not exist in nostr-tools 2.x. The correct API is `decode` (the generic NIP-19 decode function).
- **Fix:** Used `import { decode as nip19Decode } from "nostr-tools/nip19"` and added a type-narrowing guard (`if (decoded.type !== "naddr") throw`) so TypeScript could access `AddressPointer` fields on `decoded.data`.
- **Files modified:** src/lib/nostr.test.ts
- **Commit:** 6b774ae (initial), 4854eac (TypeScript narrowing fix)

**2. [Rule 1 - Bug] shadcn CLI alias resolution — file placed in @/ not src/**
- **Found during:** Task 3
- **Issue:** `npx shadcn@latest add resizable` created the file at `@/components/ui/resizable.tsx` (literal `@` directory) rather than resolving the `@` alias to `src/`. The `components.json` `aliases.ui` is `@/components/ui` but the CLI did not resolve it in this environment.
- **Fix:** Moved the generated file from `@/components/ui/resizable.tsx` to `src/components/ui/resizable.tsx` and removed the spurious `@/` directory. File contents are unmodified (CLI-generated).
- **Files modified:** src/components/ui/resizable.tsx (path only)
- **Commit:** 2dacdde

## Known Stubs

None — this plan adds infrastructure only (no UI-visible stubs).

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `articleNaddr` only produces URL fragments from already-trusted application state. `react-resizable-panels` is a UI library with no network surface. No threat flags.

## Self-Check

- [x] src/lib/nostr.ts exists and exports articleNaddr
- [x] src/lib/nostr.test.ts exists with 34 passing tests
- [x] src/index.css contains height:100% chain and overflow:hidden
- [x] src/components/ui/resizable.tsx exists with all three exports
- [x] Commits 6b774ae, 4854eac, 2dacdde exist in git log

## Self-Check: PASSED
