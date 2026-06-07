---
phase: 03-article-list
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/App.tsx
  - src/components/ArticleCard.tsx
  - src/components/ArticleList.tsx
  - src/components/ui/avatar.tsx
  - src/lib/formatTimestamp.ts
  - src/lib/formatTimestamp.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the article-list rendering layer: `App.tsx` shell/status routing, `ArticleList`/`ArticleCard` presentation, the shadcn `avatar` primitive, and the `formatTimestamp` pure helper plus its tests. The code is generally careful about untrusted content — all author/title text is rendered as React text children (auto-escaped), and the avatar uses a fallback monogram for missing/broken pictures. However there is a real XSS vector via the unvalidated `picture` URL passed to `<img src>`, and several robustness gaps in fallback/derivation logic that can crash a render or produce wrong output on malformed but protocol-valid Nostr data.

Note: `src/components/ui/avatar.tsx` is shadcn-generated and reviewed lightly per instructions.

## Critical Issues

### CR-01: Untrusted `profile.picture` URL flows unvalidated into `<img src>` — `javascript:`/`data:` XSS vector

**File:** `src/components/ArticleCard.tsx:72` (and the data origin in the profile fetch layer)
**Issue:** `profile?.picture` comes directly from a kind:0 event authored by an arbitrary, untrusted Nostr pubkey. It is passed straight to `AvatarImage` → Radix `<img src>` with no scheme validation. While `<img src="javascript:...">` does not execute in modern browsers, attacker-controlled URLs reaching an image element are still an SSRF/tracking-beacon and content-injection surface, and the project's own CLAUDE.md mandates treating *all* author-supplied content as untrusted (the same rationale that requires `rehype-sanitize` for the Markdown body). A `picture` value of `data:image/svg+xml,...` can carry an SVG, and depending on render path SVG is a known XSS carrier. The article body is sanitized; the profile picture URL is not — an inconsistent trust boundary.
**Fix:** Validate the scheme before binding. Only allow `https:` (and optionally `http:`):
```ts
function safeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    return u.protocol === "https:" || u.protocol === "http:" ? url : undefined
  } catch {
    return undefined
  }
}
// ...
<AvatarImage src={safeImageUrl(profile?.picture)} alt={displayName} ... />
```
Centralize this in the profile-normalization layer so every consumer is protected, not just this component.

## Warnings

### WR-01: `getMonogram` can throw on multibyte / surrogate-pair display names, crashing the card render

**File:** `src/components/ArticleCard.tsx:13-16`
**Issue:** `words[0][0] + words[1][0]` indexes by UTF-16 code unit. For names whose first character is an emoji or astral-plane glyph (extremely common in Nostr display names, e.g. "🚀 Satoshi"), `[0]` returns a lone surrogate half, producing a mojibake monogram (mostly cosmetic). More importantly, the `words.length >= 2` branch assumes `words[1]` exists and `words[1][0]` is defined — `split(/\s+/).filter(Boolean)` guarantees non-empty strings so `[0]` is safe, but the `name.slice(0, 2)` single-word branch combined with surrogate pairs yields a broken half-character. There is no crash here, but the output is incorrect for a large real-world class of names.
**Fix:** Use `Array.from(name)` to iterate by code point:
```ts
const chars = Array.from(name)
return words.length >= 2
  ? (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase()
  : chars.slice(0, 2).join("").toUpperCase()
```

### WR-02: `formatTimestamp` produces garbage ("Invalid Date" / wrong values) for NaN, negative, or out-of-range epochs

**File:** `src/lib/formatTimestamp.ts:24-25`
**Issue:** The function does no input validation. `new Date(NaN)` → `Intl.format` throws a `RangeError` ("Invalid time value"), which would crash the card render. `publishedAt` originates from `published_at`/`created_at` tag parsing upstream; a malformed tag (non-numeric, missing) could surface NaN here. The slice-to-16 also silently assumes the locale output is always ≥16 chars — true for sv-SE today, but fragile. The test suite (`formatTimestamp.test.ts`) covers only valid inputs (epoch 0, fixed dates) and never exercises NaN/negative/non-finite, so this gap is untested.
**Fix:** Guard non-finite input:
```ts
export function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) return "-----�--�-- --:--"
  return _fmt.format(new Date(ms)).slice(0, 16)
}
```
Add a test case: `expect(formatTimestamp(NaN)).toBe(...)`.

### WR-03: `App.tsx` status routing — `done` status with zero articles renders empty `ArticleList` instead of the empty state

**File:** `src/App.tsx:19-48`
**Issue:** The ternary chain handles `streaming && length===0` → boot, `error`, `empty`, else → `ArticleList`. But the `empty` *status* is the only thing that triggers the empty UI. If the reducer ever lands on `status === "done"` with `articles.length === 0` (e.g. relays EOSE'd cleanly but a downstream filter removed all articles, or a race where `done` is dispatched before `empty`), the final `else` branch renders `<ArticleList>` with an empty array — showing "ready — 0 articles loaded" and a blank list instead of the intended empty state. The comment on line 46 ("articles.length > 0") asserts an invariant the control flow does not actually guarantee.
**Fix:** Make the empty case depend on article count, not solely on the `empty` literal:
```tsx
) : (status === "empty" || articles.length === 0) ? (
  /* empty state */
```
Or assert the invariant in the reducer so `done` with 0 articles is impossible and document it.

### WR-04: `formatTimestamp` renders in UTC with no timezone indicator — misleading to readers

**File:** `src/lib/formatTimestamp.ts:24` and usage at `src/components/ArticleCard.tsx:94`
**Issue:** Timestamps are formatted in UTC but displayed bare ("2026-06-01 14:32") with no "UTC"/"Z" suffix. A reader in any non-UTC timezone will reasonably interpret this as local time and mis-judge article recency — a correctness/UX defect for a "most recent articles" reader where recency is the core value proposition. This is a deliberate design choice (D-07) but the absence of a zone marker makes the displayed value ambiguous/wrong from the user's perspective.
**Fix:** Either append a marker (e.g. return `... + " UTC"`, or add a trailing "Z") so the absolute reference is unambiguous, or format in the viewer's local timezone (drop `timeZone: "UTC"`). If UTC is intentional, surface it in the UI.

## Info

### IN-01: Dead `cn()` wrapper with a single static class string

**File:** `src/components/ArticleCard.tsx:56-59` and `src/components/ArticleList.tsx:13`
**Issue:** `cn("border-terminal-border bg-terminal-surface w-full",)` and `cn("w-full max-w-2xl flex flex-col")` call the class-merge utility with a single literal string and no conditional/variadic input. The `cn` call adds nothing and the trailing comma in ArticleCard is noise.
**Fix:** Use the literal string directly: `className="border-terminal-border bg-terminal-surface w-full"`.

### IN-02: `summary`-derived title fallback can yield an empty/near-empty string before reaching "(untitled)"

**File:** `src/components/ArticleCard.tsx:34-37`
**Issue:** `article.summary?.trim().split(/[.!?\n]/)[0]?.slice(0, 80)` — if `summary` is a string consisting solely of a leading delimiter (e.g. `". real summary"`), `split(...)[0]` is the empty string `""`, which is falsy, so it correctly falls through to `"(untitled)"`. That path is fine. But a summary like `"!!!"` splits to `[""]` → `""` → falls through; a summary like `"   x   "` after trim becomes `"x"` → a single-char title. The fallback is acceptable but the slice(0,80) can cut mid-word with no ellipsis, producing an awkward truncated title.
**Fix:** Add a word-boundary-aware trim or an ellipsis when truncated at 80 chars; low priority.

### IN-03: `AvatarImage` filter classes assume a picture exists; no `loading`/`referrerPolicy` on third-party images

**File:** `src/components/ArticleCard.tsx:71-75`
**Issue:** The phosphor filter classes (`grayscale brightness-75 sepia hue-rotate-90 saturate-200`) are always applied but only matter when `src` is present. More notably, loading arbitrary third-party image URLs without `referrerPolicy="no-referrer"` leaks the app's referrer (and reading activity) to whatever host the author put in `picture` — a privacy leak for a "zero backend" privacy-friendly reader. Also no `loading="lazy"`.
**Fix:** Add `referrerPolicy="no-referrer"` (and optionally `loading="lazy"`) to `AvatarImage`. Pairs naturally with the CR-01 URL hardening.

---

_Reviewed: 2026-06-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
