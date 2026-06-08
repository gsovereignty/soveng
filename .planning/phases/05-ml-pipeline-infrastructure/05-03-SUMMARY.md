---
phase: "05-ml-pipeline-infrastructure"
plan: "03"
subsystem: "ml-hook-orchestration"
tags: ["classification", "useClassification", "franc-gate", "length-gate", "onnx-worker", "re-thresholding", "tdd", "jsdom"]
dependency_graph:
  requires:
    - "05-01 (ClassificationLabel + detectLanguage + countWords)"
    - "05-02 (getClassifierWorker singleton)"
  provides:
    - "useClassification(articles, threshold) hook"
    - "ClassificationState return contract: { map, version, scores, downloadProgress, modelFailed }"
  affects:
    - "src/App.tsx (Plan 05 wires useClassification)"
    - "src/components/ContentFilterControls.tsx (Plan 04 consumes downloadProgress + modelFailed)"
tech_stack:
  added:
    - "@testing-library/react (devDependency — renderHook for hook testing)"
    - "jsdom (devDependency — vitest jsdom environment)"
  patterns:
    - "TDD red-green (test commit then implementation)"
    - "useRef Map + version counter pattern (ARCHITECTURE Pattern 2)"
    - "Cheap-gates-first pipeline (franc gate -> length gate -> worker)"
    - "Re-thresholding without re-inference (D-02)"
    - "Fail-open on all error paths (SPAM-04)"
    - "removeEventListener cleanup, never terminate (mirrors never-close-pool)"
key_files:
  created:
    - src/hooks/useClassification.ts
    - src/hooks/useClassification.test.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Hook accepts threshold as a parameter so App slider can drive re-thresholding without re-inference"
  - "scoresRef stores raw ONNX scores separately from resultsRef labels, enabling instant label recompute"
  - "countWords from languageDetect.ts reused for the 500-word gate (consistent with Plan 01)"
  - "modelFailed is true only when successCount==0 AND errorCount>0 (all-error state)"
  - "downloadProgress resets to null at progress==100 (not at final result arrival)"
  - "DEFAULT_SPAM_THRESHOLD=0.90 and MIN_WORDS=500 exported as named constants for Plan 04 UI"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-08T14:38:00Z"
  tasks_completed: 1
  files_changed: 4
---

# Phase 5 Plan 3: useClassification Hook Summary

**One-liner:** Orchestration hook — franc language gate + 500-word length gate + ONNX worker dispatch with per-id score cache, instant re-thresholding from stored scores, and fail-open on all error paths; proven by 20 jsdom Vitest tests with a mocked worker.

## Return-Object Contract (for Plan 04 and Plan 05)

```typescript
interface ClassificationState {
  map: Map<string, ClassificationLabel>   // per-event-id label (mutable, keyed by article.id)
  version: number                         // increments on every map mutation -- useMemo dependency
  scores: Map<string, number>             // raw ONNX scores 0-1, keyed by article.id
  downloadProgress: number | null         // 0-100 during model download, null when idle
  modelFailed: boolean                    // true when ALL results from worker were 'error'
}
```

**Usage:**

```typescript
const { map, version, scores, downloadProgress, modelFailed } =
  useClassification(sortedArticles, spamThreshold)
```

`version` must be listed as a useMemo dependency for `visibleArticles` to re-evaluate as results stream in:

```typescript
const visibleArticles = useMemo(
  () => sortedArticles.filter(a => !isHidden(map.get(a.id))),
  [sortedArticles, version]
)
```

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for useClassification | abbd5d2 | src/hooks/useClassification.test.ts, package.json, package-lock.json |
| 1 (GREEN) | Implement useClassification hook | ecd7c6e | src/hooks/useClassification.ts |

## TDD Gate Compliance

- RED gate: commit `abbd5d2` (`test(05-03): add failing tests...`) — 20 tests failed as expected (hook file did not exist)
- GREEN gate: commit `ecd7c6e` (`feat(05-03): implement useClassification...`) — all 20 tests pass

## Pipeline Gate Ordering

Articles flow through three sequential gates inside `useEffect` (articles):

1. **franc language gate** (sync, main thread): `detectLanguage(title + content)` -> `'non-english'` articles labeled and skipped. Worker is never called. (LANG-01)
2. **500-word length gate** (sync): `countWords(content) < MIN_WORDS` -> `'short'` articles labeled and skipped. Worker is never called. (LEN-01, D-05, SPAM-03)
3. **ONNX worker dispatch**: English >=500-word survivors labeled `'pending'`, `worker.postMessage({ id, text: content.slice(0, 512) })` called once per article. (T-05-PAYLOAD)

## Constants Exported

| Constant | Value | Rationale |
|----------|-------|-----------|
| `DEFAULT_SPAM_THRESHOLD` | `0.90` | Domain-shift from SMS training data; PITFALLS.md Pitfall 1, D-02 |
| `MIN_WORDS` | `500` | LEN-01 boundary; short texts are highest domain-shift risk |

## Deviations from Plan

None — plan executed exactly as written.

**Dependencies installed (not a deviation, plan-directed):**
- `@testing-library/react` added as devDependency (plan explicitly directed: "install if absent")
- `jsdom` added as devDependency (required for vitest jsdom environment; vitest.config.ts uses `node` global but test uses `// @vitest-environment jsdom` docblock per plan)

## Known Stubs

None. The hook is fully functional:
- Gate logic is real (detectLanguage + countWords from Plan 01)
- Worker dispatch uses the real getClassifierWorker singleton from Plan 02
- All score/label storage is wired end to end
- No placeholder values or TODO paths

## Threat Flags

No new threat surfaces beyond the plan's documented threat model. All four threats mitigated in implementation:

| Threat | Mitigation |
|--------|-----------|
| T-05-PAYLOAD (DoS via large postMessage) | `content.slice(0, 512)` before postMessage |
| T-05-REINFER (re-inference on re-render) | resultsRef Map cache by id; `has(article.id)` skip check |
| T-05-FAILOPEN (hiding on error) | 'error' label stored; isHidden('error') === false |
| T-05-RDR (unknown message shapes) | Only acts on `type === 'result'` and `type === 'progress'`; all other types silently ignored |

## Verification Results

- `npm test -- useClassification`: 20/20 tests pass (jsdom vitest suite with mocked worker)
- `npx tsc --noEmit`: no TypeScript errors
- Re-thresholding path exercised: score 0.95 at threshold 0.90 -> 'spam'; same score at threshold 0.99 -> 'ham', zero new postMessage calls
- Cache-by-id exercised: re-rendering with same article id produces exactly 1 postMessage call total
- isHidden('error') === false confirmed by Plan 01's isHidden implementation

## Self-Check: PASSED

Files exist:
- src/hooks/useClassification.ts -- exports `useClassification`, `DEFAULT_SPAM_THRESHOLD`, `MIN_WORDS`
- src/hooks/useClassification.test.ts -- 20 tests, all passing

Commits exist:
- abbd5d2: test(05-03): add failing tests for useClassification hook (RED)
- ecd7c6e: feat(05-03): implement useClassification with gate ordering, score cache, re-thresholding
