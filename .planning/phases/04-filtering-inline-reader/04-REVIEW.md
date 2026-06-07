---
phase: 04-filtering-inline-reader
reviewed: 2026-06-07T18:20:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/lib/facets.ts
  - src/lib/facets.test.ts
  - src/components/FilterBar.tsx
  - src/components/ArticleBody.tsx
  - src/components/ArticleCard.tsx
  - src/components/ArticleList.tsx
  - src/App.tsx
  - src/components/ui/accordion.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/toggle-group.tsx
  - src/components/ui/toggle.tsx
  - src/index.css
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-07T18:20:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase delivers hashtag faceting (`buildFacets` / `computeDynamicCounts` pure helpers, `FilterBar`, filter state in `App.tsx`) and an inline sanitized-Markdown reader (`ArticleBody`) wired into a controlled shadcn `Accordion`.

The XSS/sanitization pipeline in `ArticleBody.tsx` is sound: `rehype-sanitize` runs with its default schema, raw-HTML rehype is not used, and the `a`/`img` component overrides add presentation props (`target`, `rel`) via React after sanitization rather than loosening the schema. No XSS finding.

However, there is a serious correctness defect: the AND-mode filter predicate in `App.tsx` is inverted relative to the documented semantics and relative to the (correct) AND semantics implemented in `computeDynamicCounts`. The "Match ALL" filter will exclude valid articles and produce results that contradict the live tag counts shown in the sidebar. The pure-helper unit tests pass but do not cover the actual filter predicate, so the bug ships green.

## Critical Issues

### CR-01: AND ("Match ALL") filter predicate is inverted — excludes valid articles

**File:** `src/App.tsx:27-34`
**Issue:**
The filtered list is computed as:
```ts
return articles.filter(article =>
  matchMode === 'OR'
    ? article.hashtags.some(t => selectedTags.has(t))
    : article.hashtags.every(t => selectedTags.has(t)) // AND: must carry ALL selected
)
```
The AND branch reads "every hashtag on the article must be in the selected set" — which is the wrong relation. The intended semantics (and what the comment claims, and what `computeDynamicCounts` AND mode implements at `facets.ts:39-43`) is "the article must carry every selected tag."

Concrete trace: `selectedTags = {nostr}`, article `hashtags = ["nostr","bitcoin"]`.
- Intended AND: article carries `nostr` → **match**.
- Current code: `["nostr","bitcoin"].every(t => {nostr}.has(t))` → `bitcoin` not in set → `false` → **article wrongly excluded**.

This makes "Match ALL" behave roughly like "article's tag set is a subset of the selection," so adding a tag *shrinks* matches in a way that contradicts the dynamic counts displayed in `FilterBar` (those counts are computed with the correct AND semantics in `facets.ts`). The result: the sidebar shows e.g. "nostr (2)" while the list shows 0 or fewer articles — a visible inconsistency and incorrect filtering.

Additional edge case introduced by the same line: an article with `hashtags: []` returns `[].every(...) === true`, so untagged articles would *always* satisfy an AND filter — the opposite of intended.

**Fix:**
```ts
return articles.filter(article =>
  matchMode === 'OR'
    ? article.hashtags.some(t => selectedTags.has(t))
    : [...selectedTags].every(t => article.hashtags.includes(t)) // AND: article carries ALL selected tags
)
```
This mirrors the AND logic already used in `computeDynamicCounts` (`facets.ts:41`) and restores consistency between the count badges and the filtered list.

## Warnings

### WR-01: Filter predicate (the core feature logic) has no test coverage

**File:** `src/lib/facets.test.ts` (entire), `src/App.tsx:27-34`
**Issue:**
`facets.test.ts` thoroughly tests `buildFacets` and `computeDynamicCounts`, but the actual OR/AND article-selection predicate lives inline in `App.tsx` and is untested. That is precisely why CR-01 (the inverted AND filter) passes CI green. The two AND implementations (the tested one in `facets.ts` and the untested one in `App.tsx`) diverged silently.
**Fix:**
Extract the filter predicate into a pure helper in `facets.ts`, e.g.:
```ts
export function filterArticles(
  articles: Article[],
  selectedTags: Set<string>,
  matchMode: 'OR' | 'AND',
): Article[] {
  if (selectedTags.size === 0) return articles
  return articles.filter(a =>
    matchMode === 'OR'
      ? a.hashtags.some(t => selectedTags.has(t))
      : [...selectedTags].every(t => a.hashtags.includes(t)),
  )
}
```
Then add tests for: OR match, AND match, AND with article missing one selected tag (must be excluded), and untagged article under AND (must be excluded). Consume it from `App.tsx` so there is a single source of truth.

### WR-02: "more (N)" toggle is one-way; cannot collapse the expanded tag list

**File:** `src/components/FilterBar.tsx:25,78-85`
**Issue:**
`showAll` is set to `true` by the "more" button but there is no control to set it back to `false`. Once a user expands the full facet list there is no way to re-collapse it for the session. Minor UX/robustness gap, but it means the `CAP` cap is effectively a one-time view.
**Fix:**
Render a "less" button when `showAll` is true:
```tsx
{showAll && hiddenCount > 0 && (
  <button onClick={() => setShowAll(false)} className="...">&gt; less</button>
)}
```

### WR-03: D-10 collapse-on-filter effect can desync when a refetch reuses an open id

**File:** `src/components/ArticleList.tsx:15-24`
**Issue:**
`openId` lives in `ArticleList`, which is unmounted/remounted by `App.tsx` depending on the `isFilterEmpty` branch (line 94-108). When the filter produces zero matches, `ArticleList` is replaced by the empty-state block, so `openId` state is lost; when the filter is cleared, `ArticleList` remounts with `openId === ''`. That is acceptable, but the D-10 effect that clears `openId` (lines 20-24) only runs while `ArticleList` is mounted. If a future change keeps `ArticleList` mounted across the empty state (or reuses it), the effect depends on `articleIds` identity recomputed every render via `useMemo([articles])` — fine today, but the open-article-collapse contract is split across two components (mount/unmount in `App`, effect in `ArticleList`) with no single owner. This is fragile rather than currently broken.
**Fix:**
Lift `openId` (and the collapse-on-exclusion effect) into `App.tsx` alongside `selectedTags`/`matchMode`, so filter changes and open-article state are coordinated in one place and survive the empty-state branch. Pass `value`/`onValueChange` down to `ArticleList`.

## Info

### IN-01: `computeDynamicCounts` recomputes `articles.filter(...)` per tag

**File:** `src/lib/facets.ts:33-45`
**Issue:**
For OR mode this is O(tags × articles); for AND mode it is O(tags × selected × articles) due to the nested `every`/`includes` over arrays. With the fixed 21-article cap this is negligible, so it is not a v1 concern — flagged only for awareness. Correctness is fine.
**Fix:** None required for v1. If article count ever becomes configurable, precompute a `tag -> Set<articleId>` index.

### IN-02: Two near-identical npub-truncation fallbacks duplicated

**File:** `src/components/ArticleCard.tsx:11-25` and `44-52`
**Issue:**
`getMonogram` and the inline `displayName` block both call `npubEncode(...).slice(...)` inside a try/catch with a hex fallback. The npub-encode-with-fallback pattern is duplicated.
**Fix:** Extract a `safeNpub(pubkey: string): string` helper and derive both the monogram and the truncated display name from it.

### IN-03: Magic number `CAP = 10` and `21` article literal lack shared provenance

**File:** `src/components/FilterBar.tsx:6`, `src/components/ArticleList.tsx:32`
**Issue:**
`CAP = 10` is a local constant (fine), and the `21` article count is hard-coded into the status string (`{articles.length}/21 received`). The `21` is a product constraint defined in CLAUDE.md; duplicating the literal in a template string risks drift if the cap ever changes.
**Fix:** Export the article cap as a named constant from a shared config/types module and reference it in the status line.

---

_Reviewed: 2026-06-07T18:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
