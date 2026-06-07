# Phase 4: Filtering & Inline Reader - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the v1 reading experience by adding **hashtag faceting** and an **inline Markdown
reader** on top of the existing streaming article list. Two capabilities:

1. **Hashtag facet filtering** — derive a facet list from the `t`-tags of the fetched ≤21
   articles (already on `Article.hashtags[]`, lowercased), show a per-tag count, let the
   reader select tags via checkboxes, and combine selected tags with an AND/OR toggle to
   filter the visible list in real time. Includes a distinct **empty-filter** state when the
   active filter excludes every article.
2. **Inline Markdown reader** — clicking an article expands its full `Article.content`
   (raw Markdown) body, rendered as **sanitized** Markdown inline; clicking again collapses.

Covers requirements **FILT-01** (facet list from `t`-tags, lowercased/normalized),
**FILT-02** (count per facet), **FILT-03** (checkbox select/deselect filtering),
**FILT-04** (AND/OR toggle, default OR), and **DISP-04** (inline sanitized-Markdown expand).

This is the **final v1 phase** — after this, all 18 v1 requirements are covered.

**Out of this phase (deferred / v2):** clickable tag pills on cards (v2 ENRICH-02),
summary/image on cards (v2 ENRICH-01), per-relay status indicator (v2 ENRICH-03),
user-configurable relays / adjustable feed length (v2 CONF-01/02). No new relay/data work —
the data layer (Phase 2) and card rendering (Phase 3) are unchanged inputs.

> ⚠ **Roadmap-wording reinterpretation (user-directed, see D-01):** ROADMAP.md / FILT-01
> describe a **"sidebar"** facet panel. The user chose a **top filter bar** instead. This is
> a layout/HOW choice that still satisfies FILT-01/02 (facet list + counts) — the panel's
> *position* is not a requirement. Flag for `/gsd-transition` as a presentation delta, not a
> scope change.

</domain>

<decisions>
## Implementation Decisions

### Layout — top filter bar, sticky (FILT-01; reinterprets "sidebar")
- **D-01:** **Top filter bar, not a side rail.** The hashtag facet panel is a horizontal
  bar **above** the article list — not a left/right sidebar. Keeps the single-column
  reading feel and is naturally mobile-friendly (no rail-collapse logic needed). Satisfies
  FILT-01/02; see the domain reinterpretation note.
- **D-02:** **Sticky / pinned.** The filter bar stays pinned to the top of the viewport
  while the article list scrolls beneath it, so tags + the AND/OR toggle are always
  reachable — reads like a persistent terminal command line.

### Inline reader — accordion, full CRT, standard link/image handling (DISP-04)
- **D-03:** **Accordion — one open at a time.** Expanding an article auto-collapses any
  other open one. Keeps the list compact and reading focused. Maps to a shadcn **Accordion**
  (add via `npx shadcn add accordion`) per the shadcn-only rule; do not hand-roll toggle state
  unless the planner finds Accordion can't host arbitrary card anatomy cleanly (then
  **Collapsible** with single-open state managed in the list is the fallback — still shadcn).
- **D-04:** **Full CRT in the article body — readability flag CLOSED.** The expanded
  long-form body keeps the **same** scanlines + glow + flicker as the rest of the UI.
  Aesthetic over reading comfort — the user's explicit call. This resolves the readability
  concern carried from Phase 1 (D-05/D-06 readability flag) and Phase 3 (deferred to the
  Phase 4 reader). **Note:** a `prefers-reduced-motion` accommodation was offered and
  **declined** — do not add reduced-motion handling for the body in v1.
- **D-05:** **Links new-tab, images inline.** Rendered Markdown links are clickable and open
  in a new tab with `rel="noopener noreferrer"`; images render inline. `rehype-sanitize`
  still strips `<script>`, event handlers, and unsafe attributes regardless. **Do NOT add
  `rehype-raw`** (XSS surface — explicitly forbidden by CLAUDE.md / STACK.md).

### Facet panel content — count-ranked, capped, dynamic counts (FILT-01, FILT-02)
- **D-06:** **Order by count, descending.** Most common tags first, surfacing the dominant
  themes of the current 21. Tie-break is Claude's discretion (alphabetical recommended for
  determinism).
- **D-07:** **Cap + "show more".** Show the top N most-common tags by default (exact N is
  Claude's discretion — ~10–12 suggested) with a `> more (N)` toggle to reveal the rest.
  Keeps the sticky bar compact.
- **D-08:** **Dynamic counts (faceted refinement).** Each tag's count reflects the
  **currently-filtered result set**, not a static count of all 21. ⚠ **Planning detail to
  pin down:** under **OR/Match-ANY** mode, selecting a tag *broadens* results, so "count of
  current results" is ambiguous. The planner must define the exact semantics — a common,
  intuitive choice is **"how many articles the result set would contain if this tag were
  also toggled on"** (the standard faceted-search count), which behaves sensibly under both
  AND and OR. Resolve this in research/planning; whatever is chosen must never show a
  misleading 0 for a tag that is currently selected.

### Filter interactions — segmented toggle, filter is source of truth (FILT-03, FILT-04)
- **D-09:** **Segmented `Match ANY` / `Match ALL` control**, always visible in the bar.
  Explicit wording over a terse any/all toggle. **Default = `Match ANY` (OR)** — locked by
  FILT-04 / success criterion 3. AND = article must carry all checked tags; OR = article
  carries any checked tag (per PROJECT.md hashtag semantics).
- **D-10:** **Filter is the source of truth.** When the active filter changes so that a
  currently-expanded article no longer matches, that article **disappears with the rest**
  (the accordion ends up with nothing open). No pinning of an open-but-non-matching card.
- **D-11:** **Distinct empty-filter state (DISP-05 extension).** When selected tags exclude
  every article, show a terminal-styled empty-**filter** message that is visually/textually
  **distinct** from the Phase 2/3 `empty` (relays returned zero) and `error` (all relays
  failed) states. This is a *derived/UI* state computed from the filtered set — it must not
  touch or be confused with the data-layer `NostrStatus`. A natural recovery affordance is
  "clear filters" (not relay `refetch()`).

### Claude's Discretion
- Exact `N` for the facet cap (D-07) and tie-break ordering for equal counts (D-06).
- Selected/checked-tag visual treatment in the terminal palette (checkbox vs toggle-chip
  styling) — keep within existing `terminal-*` tokens and the green-phosphor aesthetic.
- Whether to use shadcn `Checkbox` + custom chips, `Toggle`/`ToggleGroup`, or styled buttons
  for the tag controls — planner's call within the shadcn-only rule. shadcn components likely
  needed: `accordion` (D-03), and one of `checkbox` / `toggle-group` for tags + the AND/OR
  segmented control; `separator`/`scroll-area` optional.
- Markdown element styling (headings, code blocks, lists, blockquotes) in the terminal theme
  — react-markdown emits unstyled elements; Tailwind v4 has no typography plugin here, so
  prose styling is bespoke via `terminal-*` tokens. Keep it monospace/phosphor-consistent.
- Exact copy/wording for the empty-filter message and the AND/OR labels.
- Whether filtering is derived via `useMemo` over `articles` (recommended — no new global
  state) and where selected-tags + match-mode state lives (local to the list/bar).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — product definition; **hashtag semantics** (AND = all checked
  tags, OR = any; facets derived from fetched 21 only), constraints (zero backend, lean
  bundle, terminal aesthetic), Key Decisions
- `.planning/REQUIREMENTS.md` §FILT-01…FILT-04, §DISP-04, §DISP-05 — locked requirement text
- `.planning/ROADMAP.md` §"Phase 4: Filtering & Inline Reader" — goal + 5 success criteria
  (note: "sidebar" wording reinterpreted as a top bar per D-01)

### Research (Markdown rendering is the new/highest-risk surface — read closely)
- `.planning/research/STACK.md` §"Markdown Rendering Decision" (~lines 92–120, 252–256) —
  `react-markdown@10.1.0` + `remark-gfm@4.0.1` + `rehype-sanitize@6.0.0`; secure-by-default
  pipeline; **never `dangerouslySetInnerHTML`**; the `npx shadcn add` line lists
  `checkbox separator scroll-area` among components. These deps are **not yet installed**.
- `.planning/research/PITFALLS.md` — untrusted-author content / sanitization rationale
- `.planning/research/ARCHITECTURE.md` — component layout; derived/`useMemo` filtering
  guidance (note Zustand assumption is superseded — Phase 2 D-11 uses plain React context)

### Prior phase context (decisions Phase 4 inherits)
- `.planning/phases/03-article-list/03-CONTEXT.md` — `ArticleCard`/`ArticleList` anatomy,
  arrival-order no-resort (D-03), avatar/title/timestamp; **cards were to be built
  "expand-ready" but expand was deferred to Phase 4** — this phase implements it
- `.planning/phases/02-nostr-data-layer/02-CONTEXT.md` — `NostrStatus`
  (`streaming|done|empty|error`), lowercased `t`-tags in the model, `refetch()` (D-12),
  empty-vs-error distinction (the new empty-FILTER state must stay separate from these)
- `.planning/phases/01-scaffold-deploy/01-CONTEXT.md` — terminal palette + full CRT
  (D-05/D-06), monospace/JetBrains Mono (D-08), shadcn-only rule (D-09); the long-form-body
  readability flag is resolved here by D-04 (keep full CRT)

### Project guidance
- `CLAUDE.md` — tech stack, "use existing shadcn components" rule, react-markdown +
  remark-gfm + rehype-sanitize stack, **"What NOT to Use": no `rehype-raw`**, subpath imports

No additional user-supplied external specs/ADRs were referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ArticleList.tsx` — maps `articles` → `ArticleCard`. The **filter seam**:
  the rendered set becomes a `useMemo`-derived filtered list; the sticky filter bar mounts
  above the existing streaming/ready status header (D-02). Empty-filter branch (D-11) lives
  here (or in `App.tsx`) — distinct from the relay empty/error branches in `App.tsx`.
- `src/components/ArticleCard.tsx` — current card shows title + author + timestamp. The
  **expand seam**: the card gains a click-to-expand body rendering `article.content` via
  react-markdown. Built unstyled today; planner adds the accordion trigger + body region.
- `src/types/nostr.ts` — `Article.hashtags: string[]` (lowercased `t`-tags — facet source),
  `Article.content: string` (raw Markdown — reader source). **No type changes needed.**
- `src/App.tsx` — `AppShell` branches on `NostrStatus`: `streaming`(zero)→BootSequence,
  `error`/`empty`→terminal message + `refetch()`, else `<ArticleList>`. The empty-**filter**
  state is a NEW derived branch that must NOT be folded into the `empty`/`error` status arms.
- `src/index.css` — `terminal-*` tokens + `crt-glow`/`crt-scanlines`/`crt-flicker` helpers;
  the Markdown body uses these (full CRT, D-04).
- `src/context/NostrContext.tsx` — `useNostr()` → `{ status, articles, profiles, refetch }`.
  Filtering is pure-derived over `articles`; no provider changes expected.

### Established Patterns
- Plain React hooks + context for data state (Phase 2 D-11) — **no Zustand**. Selected-tags
  and match-mode are local UI state (`useState`); filtered list is `useMemo` over `articles`.
- shadcn components added via `npx shadcn add <name>` into `src/components/ui/`. Currently
  present: `card`, `avatar`. Phase 4 likely adds `accordion` + tag/toggle control(s).
- `nostr-tools/nip19` subpath imports; lean-bundle / zero-dependency-bias ethos
  (react-markdown stack is the sanctioned exception, already in research/CLAUDE.md).

### Integration Points
- Sticky top filter bar mounts inside `AppShell`'s `<main>` (currently `max-w-2xl` centered),
  above `ArticleList`. New Markdown deps (`react-markdown`, `remark-gfm`, `rehype-sanitize`)
  installed this phase. No relay/data-layer changes.

</code_context>

<specifics>
## Specific Ideas

- The filter bar should feel like a **persistent terminal command line** pinned at the top
  (D-02) — not a chrome-y app sidebar.
- The reader is unapologetically on-aesthetic: **full CRT even on long article bodies**
  (D-04) — the user prefers the look over maximal readability.
- Facets are **signal-forward** — popular tags first (D-06), with counts that **refine as you
  filter** (D-08), like real faceted search.
- Reading is **single-focus**: one article open at a time (D-03), and the filter is always
  the source of truth — no orphaned open cards (D-10).

</specifics>

<deferred>
## Deferred Ideas

- **Clickable tag pills on cards** (v2 ENRICH-02) — tapping a hashtag on a card to filter.
  Not in v1; facets live only in the top bar.
- **Summary + image on cards** (v2 ENRICH-01) — data exists on `Article`, not displayed.
- **Per-relay connection status indicator** (v2 ENRICH-03) — carried from Phase 2.
- **User-configurable relays / adjustable feed length** (v2 CONF-01/02) — fixed at 4 relays,
  21 articles.
- **`prefers-reduced-motion` / CRT dial-back for body text** — explicitly **declined** for v1
  (D-04). Could revisit if readability feedback warrants a "reading mode" toggle later.
- **URL-encoded filter state / shareable filtered views** — not raised, noted as a natural
  future enhancement; out of v1 scope.

None of the above expand Phase 4 scope.

</deferred>

---

*Phase: 4-Filtering & Inline Reader*
*Context gathered: 2026-06-07*
