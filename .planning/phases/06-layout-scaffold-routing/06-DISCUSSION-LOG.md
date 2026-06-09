# Phase 6: Layout Scaffold & Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 6-layout-scaffold-routing
**Areas discussed:** Split ratio & resize bounds, Sidebar control placement, Phase-6 reading-pane content, Cold-load & not-found UX

---

## Split ratio & resize bounds

| Option | Description | Selected |
|--------|-------------|----------|
| 35/65, sidebar 25–50% | Sidebar 35% (room for Phase 7 enriched rows), reading pane 65%; drag clamps 25–50%. Reading-focused. | ✓ |
| 40/60, sidebar 30–55% | Wider sidebar (40%) for denser rows; pane 60%; drag clamps 30–55%. Email-client balance. | |
| 30/70, sidebar 20–45% | Narrow sidebar (30%), maximal pane (70%); drag clamps 20–45%. Most immersive. | |

**User's choice:** 35/65, sidebar clamped 25–50%
**Notes:** Reading-focused split chosen — this is a long-form reader first, not a balanced email client. Width persistence is out of scope per REQUIREMENTS.md.

---

## Sidebar control placement

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned header, list scrolls | Controls in a fixed-height header; only the article list below scrolls. Controls always reachable; avoids sticky-in-scroll fragility. | ✓ |
| Everything scrolls together | Controls + list share one scroll context; controls scroll out of view. Simplest port but controls become unreachable. | |
| Collapsible controls section | Pinned but collapsible to reclaim space. More UI work; closer to Phase 7+ territory. | |

**User's choice:** Pinned header, list scrolls below
**Notes:** Resolves the research-flagged sticky-positioning gap — FilterBar's `sticky top-0` is dropped, not preserved, since the pinned header replaces its purpose.

---

## Phase-6 reading-pane content

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal article-header stub | Title + author + timestamp (no Markdown body). Proves naddr resolution; verifies success criteria 3 & 4. Phase 7 adds ArticleBody below. | ✓ |
| Placeholder only | Always shows `> select an article to read`. Routing works under the hood but nothing confirms which article resolved. | |
| Title only | Just the resolved title. Lighter; less to verify against. | |

**User's choice:** Minimal article-header stub
**Notes:** Forward-compatible — Phase 7 inserts `<ArticleBody>` beneath the same header, not a throwaway.

---

## Cold-load & not-found UX

| Option | Description | Selected |
|--------|-------------|----------|
| Loading until stream ends, then not-found | Terminal loading line while unresolved + streaming; `[404]` notice once streaming ends unresolved. Tied to relay lifecycle, no timer. | ✓ |
| Fixed timeout (e.g. 10s) | Loading, then not-found after a fixed wait. Simpler but false-negatives on slow relays. | |
| Loading forever | Loading indefinitely; never declare not-found. Lowest effort but bad naddr spins forever. | |

**User's choice:** Loading until stream ends, then not-found
**Notes:** Resolution is reactive via the `selectedArticle` memo's fallback to `sortedArticles` — no polling. Planner to confirm exact non-streaming status value(s) in `nostrReducer.ts`.

---

## Claude's Discretion

- Resize-handle visual styling within the terminal aesthetic.
- StrictMode-safe `hashchange` listener add/remove cleanup (pitfall P16).
- `#`-strip-before-decode and naddr encode/decode call sites (P12/P13) — follow research PITFALLS.md.
- Whether the stub sidebar list reuses existing `ArticleList`/`ArticleCard` or a thin throwaway — rows just need to set `selectedNaddr`.

## Deferred Ideas

- Persisted sidebar width (`onLayout`→localStorage) — out of scope per REQUIREMENTS.md.
- Collapsible controls section — rejected for Phase 6 (extra UI, Phase 7+ territory).
- Mobile list/reader swap (MOBILE-01..03) — Phase 8; not scaffolded here.
- j/k keyboard navigation + ARIA listbox baseline — Phase 7 / deferred v1.x.
- wouter router / shadcn Sidebar — rejected by research consensus; recorded so it isn't revisited.
