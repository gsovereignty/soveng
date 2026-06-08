---
phase: 05-ml-pipeline-infrastructure
plan: "01"
subsystem: content-filtering
tags: [classification, language-detection, types, tdd, franc-min]
dependency_graph:
  requires: []
  provides: [ClassificationLabel type contract, detectLanguage, countWords, languageDetect tests]
  affects: [src/types/nostr.ts, src/lib/languageDetect.ts]
tech_stack:
  added: [franc-min@6.2.0]
  patterns: [TDD red-green, fail-open allowlist, input-length guard (T-05-RX)]
key_files:
  created:
    - src/lib/languageDetect.ts
    - src/lib/languageDetect.test.ts
  modified:
    - src/types/nostr.ts
    - package.json
    - package-lock.json
decisions:
  - ClassificationLabel uses 6-member union with explicit hide allowlist (spam, non-english, short only)
  - isHidden is an allowlist-of-hides, not allowlist-of-shows, for safety (unknown labels show by default)
  - Input capped at 20000 chars before regex/franc work to bound ReDoS on adversarial bodies (T-05-RX)
  - MIN_DETECT_CHARS=200 and MIN_CONFIDENCE=0.75 per D-03 research defaults
  - stripNonNatural uses linear-time regexes only (no nested quantifiers)
metrics:
  duration: "5m 10s"
  completed: "2026-06-08T06:21:40Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 5 Plan 1: Language Gates and Classification Label Contract Summary

**One-liner:** Synchronous content-filter foundation — ClassificationLabel type contract with fail-open isHidden helper, plus franc-min language gate and 500-word word-count utility, proven by 10 Vitest tests covering all fail-open edge cases.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ClassificationLabel union and isHidden helper | f802aba | src/types/nostr.ts |
| 2 (RED) | Add failing tests for detectLanguage + countWords | e99eadd | src/lib/languageDetect.test.ts |
| 2 (GREEN) | Implement detectLanguage and countWords with franc-min | a4f2864 | src/lib/languageDetect.ts, package.json, package-lock.json |

## TDD Gate Compliance

- RED gate: commit `e99eadd` (`test(05-01): add failing tests...`) — tests failed as expected
- GREEN gate: commit `a4f2864` (`feat(05-01): implement...`) — all 10 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both gates are fully functional. No placeholder values or TODO paths.

## Threat Flags

No new threat surface beyond what the plan's threat model already covers.
- T-05-RX (input cap + linear regexes): mitigated in implementation as required
- T-05-LBL (explicit hide allowlist): implemented — only 3 values hide, everything else shows
- T-05-SC (franc-min package legitimacy): accepted per plan — franc-min is `wooorm`'s maintained package

## Verification Results

- `npm test -- languageDetect`: 10/10 tests pass
- `npx tsc --noEmit`: no errors in nostr.ts or languageDetect.ts
- `node -e "require('franc-min')"`: succeeds
- franc-min@6.2.0 present in package.json dependencies

## Self-Check: PASSED

Files exist:
- src/types/nostr.ts — contains `export type ClassificationLabel` (line 33) and `export function isHidden` (line 43)
- src/lib/languageDetect.ts — created, exports `detectLanguage` and `countWords`
- src/lib/languageDetect.test.ts — created, 10 tests all passing

Commits exist:
- f802aba: feat(05-01): add ClassificationLabel union and isHidden helper
- e99eadd: test(05-01): add failing tests for detectLanguage and countWords (RED)
- a4f2864: feat(05-01): implement detectLanguage and countWords with franc-min (GREEN)
