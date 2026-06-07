---
phase: 03-article-list
plan: 01
subsystem: ui
tags: [react, shadcn, nostr-tools, tailwind, vitest, nip19, intl]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: Article and Profile TypeScript types, NostrContext, formatTimestamp input shape (publishedAt ms epoch)
provides:
  - src/lib/formatTimestamp.ts — pure ms-epoch to "YYYY-MM-DD HH:MM" UTC formatter
  - src/lib/formatTimestamp.test.ts — 39 Vitest tests including boundary values
  - src/components/ui/avatar.tsx — shadcn Avatar/AvatarImage/AvatarFallback (via CLI)
  - src/components/ArticleCard.tsx — single article entry with title fallback, author identity, timestamp
affects:
  - 03-02-PLAN (ArticleList composes ArticleCard; App.tsx wired to ArticleList)
  - Phase 4 (click-to-expand builds on ArticleCard card structure)

# Tech tracking
tech-stack:
  added:
    - radix-ui@^1.5.0 (unified Radix package; Avatar exposed via AvatarPrimitive from radix-ui — not the per-primitive @radix-ui/react-avatar; see deviation)
  patterns:
    - Intl.DateTimeFormat "sv-SE" module-level singleton for UTC ISO-8601 timestamp formatting
    - shadcn Avatar/AvatarImage/AvatarFallback composition for image-with-monogram-fallback
    - npubEncode from nostr-tools/nip19 (subpath import) wrapped in try/catch for pubkey display fallback
    - Title fallback chain: article.title → summary-clause → "(untitled)" inline in render
    - Author name fallback chain: profile.displayName → truncated npub (T-03-04 hardened)
    - All untrusted Nostr content rendered as React text children — never dangerouslySetInnerHTML

key-files:
  created:
    - src/lib/formatTimestamp.ts
    - src/lib/formatTimestamp.test.ts
    - src/components/ui/avatar.tsx
    - src/components/ArticleCard.tsx
  modified: []

key-decisions:
  - "radix-ui unified package used (not @radix-ui/react-avatar per-primitive) — current shadcn CLI installs the consolidated radix-ui package; user VERIFIED this is the official Radix package"
  - "npubEncode wrapped in try/catch in both displayName and monogram derivation (T-03-04 threat mitigation)"
  - "d-tag excluded from title fallback — not user-facing text per plan spec"
  - "AvatarFallback shows 2-char monogram from name initials or npub prefix — no gating on profile arrival"

patterns-established:
  - "Terminal card layout: Card + CardContent with border-terminal-border bg-terminal-surface p-4 font-mono text-sm"
  - "Green-tint avatar filter: grayscale brightness-75 sepia hue-rotate-90 saturate-200"
  - "Monogram derivation: 2 word initials if multi-word name, else first 2 chars uppercased, else npub prefix"
  - "Avatar upgrade in place: AvatarImage/AvatarFallback show immediately; image loads asynchronously"

requirements-completed: [DISP-01, DISP-02, DISP-03]

# Metrics
duration: ~10min
completed: 2026-06-07
---

# Phase 03 Plan 01: Article List Primitives Summary

**shadcn Avatar + pure Intl timestamp formatter + terminal-styled ArticleCard with title/author/timestamp, all untrusted content XSS-safe**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-07T08:35:00Z
- **Completed:** 2026-06-07T08:42:32Z
- **Tasks:** 3 (Tasks 1 and 2 by prior executor; Task 3 by this executor)
- **Files modified:** 4 created

## Accomplishments

- Pure `formatTimestamp` utility using module-level `Intl.DateTimeFormat("sv-SE", UTC)` — zero dependencies, 39 Vitest tests passing including Unix epoch boundary
- shadcn Avatar scaffolded via CLI with `radix-ui` unified package; exports `Avatar`, `AvatarImage`, `AvatarFallback`
- `ArticleCard` component delivers DISP-01 (title fallback chain), DISP-02 (author name + green-tinted avatar with monogram), DISP-03 (YYYY-MM-DD HH:MM timestamp); no crash path on `undefined` profile
- All threat mitigations applied: no `dangerouslySetInnerHTML`, `npubEncode` wrapped in try/catch (T-03-04), `AvatarFallback` handles broken/mixed-content picture URLs (T-03-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: formatTimestamp util + TDD tests** - `b90f473` (feat)
2. **Task 2: shadcn Avatar via CLI** - `0336077` (feat)
3. **Task 3: ArticleCard component** - `da0c597` (feat)

**Plan metadata:** _(committed after this summary)_

## Files Created/Modified

- `src/lib/formatTimestamp.ts` — pure ms-epoch to "YYYY-MM-DD HH:MM" UTC formatter (Intl singleton, no deps)
- `src/lib/formatTimestamp.test.ts` — 39 Vitest boundary-value tests
- `src/components/ui/avatar.tsx` — shadcn Avatar/AvatarImage/AvatarFallback (scaffolded via CLI)
- `src/components/ArticleCard.tsx` — single article card: title fallback, author identity + green-tinted avatar, timestamp

## Decisions Made

- Used `radix-ui` unified package (not `@radix-ui/react-avatar`) — current shadcn CLI consolidates all Radix primitives under `radix-ui`; user verified this is the official Radix package (see Deviations)
- Excluded `article.d` from title fallback: d-tags are content-addressing slugs, not display-friendly text
- `npubEncode` wrapped in try/catch in both displayName and monogram computation paths (T-03-04 compliance)
- No gating on profile arrival — card renders immediately with monogram fallback; avatar upgrades in place when image loads

## Deviations from Plan

### Package Deviation (Human-Verified, Approved)

**[Task 2 - Package Shape] Current shadcn CLI installs consolidated `radix-ui` instead of per-primitive `@radix-ui/react-avatar`**

- **Found during:** Task 2 (shadcn Avatar CLI scaffold)
- **Issue:** Plan text referenced `@radix-ui/react-avatar` as the expected new dependency. The current `shadcn@latest` CLI (2025 version) installs `radix-ui@^1.5.0` — a unified consolidated package that exposes all Radix UI primitives under one package. `avatar.tsx` imports `{ Avatar as AvatarPrimitive } from "radix-ui"` rather than `import * as AvatarPrimitive from "@radix-ui/react-avatar"`.
- **Resolution:** Human checkpoint gate triggered (Task 2 `gate="blocking-human"`). User reviewed the package at npmjs.com and confirmed `radix-ui` is the **official Radix UI package** published by the Radix team — not a typosquat. User approved proceeding.
- **Files affected:** `src/components/ui/avatar.tsx`, `package.json`
- **Threat register:** T-03-SC fully mitigated — blocking-human gate was exercised as planned; legitimate package confirmed by user.

---

**Total deviations:** 1 (package shape change; human-verified and approved)
**Impact on plan:** No functional difference — `Avatar`, `AvatarImage`, `AvatarFallback` exports are identical. Build passes. Security gate exercised correctly.

## Issues Encountered

None beyond the package deviation above, which was handled by the human checkpoint gate.

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's threat model covers:

- T-03-01 (XSS via text): mitigated — all untrusted strings rendered as React text children, zero `dangerouslySetInnerHTML` occurrences confirmed via grep
- T-03-02 (XSS via picture URL): mitigated — `src` flows into `<img>` via AvatarImage; `javascript:`/`data:` fails image load; AvatarFallback renders monogram
- T-03-04 (npubEncode throw): mitigated — try/catch in both displayName derivation and monogram function
- T-03-SC (package legitimacy): mitigated — blocking-human gate exercised; user confirmed `radix-ui` is official

## Known Stubs

None — ArticleCard has no hardcoded placeholder data or TODO stubs. All fallback values (`"(untitled)"`, monogram, truncated-npub) are functional runtime fallbacks, not stubs.

## Next Phase Readiness

- `ArticleCard` is ready for composition into `ArticleList` (Plan 02)
- `ArticleList` will pass `articles: Article[]` and `profiles: Map<string, Profile>` from `useNostr()`, calling `<ArticleCard article={a} profile={profiles.get(a.pubkey)} />` per item
- `App.tsx` branch update (streaming+articles → ArticleList; boot screen only for zero-article streaming) is Plan 02 scope

---
*Phase: 03-article-list*
*Completed: 2026-06-07*
