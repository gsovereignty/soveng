# Phase 4: Filtering & Inline Reader — Research

**Researched:** 2026-06-07
**Domain:** React faceted-search UI + Markdown rendering pipeline + shadcn Accordion/ToggleGroup/Checkbox
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Top filter bar, not a side rail. Horizontal bar above the article list.
- **D-02:** Sticky / pinned. Filter bar stays visible while article list scrolls.
- **D-03:** Accordion — one open at a time. shadcn `Accordion` preferred; `Collapsible` fallback if card anatomy proves incompatible.
- **D-04:** Full CRT in article body. No reduced-motion accommodation in v1.
- **D-05:** Links open in new tab (`target="_blank" rel="noopener noreferrer"`); images render inline. No `rehype-raw`. `rehype-sanitize` strips `<script>`, event handlers, unsafe attributes.
- **D-06:** Facets ordered by count descending; alphabetical tie-break.
- **D-07:** Show top N tags by default with `> more (N)` toggle. Exact N is Claude's discretion.
- **D-08:** Dynamic counts — each tag's count reflects the result set as if that tag were also toggled on (standard faceted-search semantics). Must never show misleading 0 for a selected tag.
- **D-09:** Segmented `Match ANY` / `Match ALL` control. Default = `Match ANY` (OR).
- **D-10:** Filter is source of truth. Changing filter collapses any open article that no longer matches.
- **D-11:** Distinct empty-filter state — terminal message + "clear filters" affordance; must NOT touch `NostrStatus`.

### Claude's Discretion
- Exact `N` for facet cap (D-07); alphabetical tie-break for equal counts (D-06).
- Selected-tag visual treatment (checkbox vs toggle-chip) within `terminal-*` tokens.
- Whether to use `Checkbox` + label, `Toggle`/`ToggleGroup` for tags, or styled buttons.
- Markdown element styling (headings, code blocks, lists, blockquotes) in terminal theme — bespoke via `terminal-*` tokens, no typography plugin.
- Exact copy for empty-filter message and AND/OR labels.
- Whether filtering is derived via `useMemo` (recommended — no new global state) and where selected-tags + match-mode live (local state in `AppShell` or `ArticleList`).

### Deferred Ideas (OUT OF SCOPE)
- Clickable tag pills on cards (v2 ENRICH-02)
- Summary + image on cards (v2 ENRICH-01)
- Per-relay connection status (v2 ENRICH-03)
- User-configurable relays / adjustable feed length (v2 CONF-01/02)
- `prefers-reduced-motion` / CRT dial-back — **explicitly declined** for v1
- URL-encoded filter state / shareable filtered views
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILT-01 | Derive hashtag facet list from `t` tags of fetched 21 articles, lowercased/normalized | `Article.hashtags[]` already lowercased; `buildFacets()` pure helper; sticky top bar layout |
| FILT-02 | Each hashtag facet shows a count of matching articles | Dynamic count algorithm (D-08) defined below |
| FILT-03 | User can select/deselect hashtags via checkboxes to filter article list | shadcn `Checkbox` component; `useMemo` filtered list |
| FILT-04 | AND/OR toggle between Match ALL and Match ANY; default OR | shadcn `ToggleGroup type="single"` segmented control; ToggleGroup deselection guard |
| DISP-04 | Clicking article expands full body as sanitized Markdown inline | react-markdown@10.1.0 + remark-gfm@4.0.1 + rehype-sanitize@6.0.0; shadcn Accordion |
</phase_requirements>

---

## Summary

Phase 4 adds two independent capabilities on top of the existing streaming article list: a sticky horizontal hashtag facet bar (filter) and an inline Markdown reader (expand/collapse). Both are pure UI additions — no relay or data-layer changes.

The Markdown rendering pipeline (`react-markdown@10.1.0` + `remark-gfm@4.0.1` + `rehype-sanitize@6.0.0`) is the highest-risk surface because the packages are not yet installed and must be wired correctly as ESM imports in the Vite build. The unified v11 ecosystem requires all three packages to be on compatible versions — the current locked versions satisfy this. `rehype-sanitize` is placed in the `rehypePlugins` array after remark processing; `remark-gfm` goes in `remarkPlugins`. The `components` prop handles terminal styling and link/image behavior without requiring `rehype-raw`.

The shadcn `Accordion` (one-open-at-a-time via `type="single" collapsible`) can host full card anatomy as children of `AccordionTrigger` — the trigger accepts arbitrary JSX, rendering it before an internal chevron icon. The `AccordionHeader` (`h3`) is wrapped internally by the shadcn component and its styling can be overridden via `className`. The filter bar uses `ToggleGroup type="single"` for the AND/OR segmented control (with a required deselection guard), and `Checkbox` primitives for individual tags.

The dynamic faceted count algorithm (D-08) resolves to: for each tag `T`, count articles in the **base result set** (filtered by all currently-selected tags except `T`) that carry `T`. In OR mode the base set is `allArticles`; in AND mode the base set is articles matching all currently-selected tags **other than** `T`. A selected tag always shows count ≥ 1 under this definition, never a misleading zero.

**Primary recommendation:** Add `Accordion`, `Checkbox`, and `ToggleGroup` via `npx shadcn add`; install `react-markdown remark-gfm rehype-sanitize`; implement filter state as `useState` local to `AppShell`; derive `filteredArticles` via `useMemo`; wire the dynamic count function as a separate `useMemo`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hashtag facet list derivation | Browser/Client (pure JS) | — | Pure computation over `articles[]` already in memory; no network involved |
| Filter state (selected tags + match mode) | Browser/Client (local React state) | — | UI-only state; does not belong in NostrContext which is data-layer |
| Filtered article list | Browser/Client (useMemo derived) | — | Pure function of filter state + articles; never stored, always computed |
| Dynamic facet counts | Browser/Client (useMemo derived) | — | Pure computation; recomputes when filter state changes |
| Empty-filter vs empty-relay distinction | Browser/Client (render branch) | — | Derived from `filteredArticles.length === 0` when `articles.length > 0`; must not touch `NostrStatus` |
| Markdown rendering | Browser/Client (react-markdown) | — | Client-side render; unified/remark/rehype pipeline produces React elements |
| Accordion open/close state | Browser/Client (Radix Accordion) | — | Controlled single-value state; D-10 clears it when filter changes |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 19.2.7 | UI framework | Installed |
| shadcn/ui (card, avatar) | latest CLI | Component library | Installed — accordion/checkbox/toggle-group need adding |
| nostr-tools | 2.23.5 | Nostr data layer | Installed — no changes this phase |
| Tailwind CSS | 4.3.0 | Utility styling | Installed |

### New — to install this phase
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | 10.1.0 | Render `article.content` Markdown inline | Secure by default (no `dangerouslySetInnerHTML`); React 19 compatible (peerDep `>=18`); unified v11 ecosystem [VERIFIED: npm registry] |
| remark-gfm | 4.0.1 | GitHub Flavored Markdown (tables, strikethrough, autolinks) | Common in Nostr long-form articles; unified v11 compatible [VERIFIED: npm registry] |
| rehype-sanitize | 6.0.0 | Strip unsafe HTML post-processing | Belt-and-suspenders against inline HTML from untrusted authors [VERIFIED: npm registry] |

### shadcn components — to add this phase
| Component | Add Command | Purpose |
|-----------|-------------|---------|
| accordion | `npx shadcn add accordion` | Inline reader expand/collapse (D-03) |
| checkbox | `npx shadcn add checkbox` | Hashtag facet checkboxes (FILT-03) |
| toggle-group | `npx shadcn add toggle-group` | AND/OR segmented control (D-09, FILT-04) |

### Supporting (already installed, may be referenced)
| Library | Version | Notes |
|---------|---------|-------|
| lucide-react | 1.17.0 | ChevronDown used internally by shadcn accordion; no separate import needed |
| radix-ui | 1.5.0 | Unified Radix package — already bundles `Accordion`, `Checkbox`, `ToggleGroup` |

**Installation:**
```bash
npm install react-markdown remark-gfm rehype-sanitize
npx shadcn add accordion checkbox toggle-group
```

**Version verification:** All three npm packages confirmed at their locked versions as of 2026-06-07. `react-markdown@10.1.0` is the `dist-tags.latest`. `remark-gfm@4.0.1` is latest. `rehype-sanitize@6.0.0` is latest (published 2023-11-20 — stable, no newer release). [VERIFIED: npm registry]

---

## Package Legitimacy Audit

> `slopcheck` was not installable in this environment. All packages are tagged `[ASSUMED]` per graceful-degradation protocol — however, all three are well-established packages from the `remarkjs/rehypejs` GitHub organizations (unified collective) with years of history.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-markdown | npm | 11 yrs (2015-05-09) | ~10M/wk [ASSUMED] | github.com/remarkjs/react-markdown | unavailable | Approved [ASSUMED] |
| remark-gfm | npm | ~4 yrs | ~10M/wk [ASSUMED] | github.com/remarkjs/remark-gfm | unavailable | Approved [ASSUMED] |
| rehype-sanitize | npm | ~3 yrs | ~2M/wk [ASSUMED] | github.com/rehypejs/rehype-sanitize | unavailable | Approved [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged [SUS]:** none

**Manual legitimacy signals:** All three packages are from the unified collective (remarkjs/rehypejs GitHub organizations), ship no `postinstall` scripts [VERIFIED: npm registry], and are documented in the project's `CLAUDE.md` and `STACK.md` as the approved Markdown stack. No additional verification required before install.

---

## Architecture Patterns

### System Architecture Diagram

```
AppShell (reads NostrContext)
    │
    ├── [filter state: selectedTags: Set<string>, matchMode: 'OR'|'AND']
    │
    ├── useMemo → filteredArticles   (from articles + selectedTags + matchMode)
    ├── useMemo → facets             (from articles — static base counts)
    ├── useMemo → dynamicCounts      (from articles + selectedTags + matchMode)
    │
    ├── <FilterBar>                  ← NEW sticky component
    │       ├── tag checkboxes       (shadcn Checkbox × N)
    │       ├── "show more" toggle   (plain button)
    │       └── AND/OR segmented     (shadcn ToggleGroup type="single")
    │
    └── {filteredArticles.length === 0 && articles.length > 0}
            ? <EmptyFilterState>     ← NEW derived branch
            : <ArticleList>          ← EXISTING — receives filteredArticles
                    └── Accordion type="single" collapsible  ← wraps cards
                            └── ArticleCard (title/author/ts trigger + Markdown body)
                                    └── react-markdown pipeline
```

**Data flow for filter interaction:**
```
User checks tag checkbox
    → setSelectedTags(prev => toggle tag in Set)
    → filteredArticles useMemo recomputes
    → dynamicCounts useMemo recomputes
    → ArticleList re-renders with new array
    → D-10: Accordion controlled value reset if open article no longer in filteredArticles
```

**Data flow for article expand:**
```
User clicks AccordionTrigger (card header)
    → Accordion internal state → sets openArticleId
    → AccordionContent mounts with react-markdown pipeline
    → Markdown body renders sanitized, terminal-styled
```

### Recommended Project Structure Changes

```
src/
├── components/
│   ├── ArticleList.tsx        # MODIFY — receives filteredArticles, wraps in Accordion
│   ├── ArticleCard.tsx        # MODIFY — add AccordionItem/Trigger/Content anatomy
│   ├── FilterBar.tsx          # NEW — sticky hashtag facet bar
│   ├── ArticleBody.tsx        # NEW — react-markdown renderer
│   └── ui/
│       ├── accordion.tsx      # NEW (shadcn add)
│       ├── checkbox.tsx       # NEW (shadcn add)
│       └── toggle-group.tsx   # NEW (shadcn add)
├── lib/
│   └── facets.ts              # NEW — buildFacets(), computeDynamicCounts()
└── App.tsx                    # MODIFY — add filter state, useMemo chain
```

### Pattern 1: Markdown Rendering Pipeline (DISP-04)

**What:** react-markdown with remark-gfm and rehype-sanitize, custom `components` for terminal styling and secure link/image behavior.

**Plugin order matters:** `remarkPlugins` runs in the Markdown→mdast phase; `rehypePlugins` runs in the hast→React phase. `rehype-sanitize` must be in `rehypePlugins` and does NOT require `rehype-raw`.

**Import syntax (ESM, Vite-compatible):**
```typescript
// Source: npm registry + github.com/remarkjs/react-markdown README
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
```

**The `defaultSchema` from `rehype-sanitize` blocks `target` attribute on `<a>` by default.** To allow `target="_blank"` while keeping all other security controls, extend the schema:

```typescript
// Source: github.com/rehypejs/rehype-sanitize README
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ['target', '_blank'],
      ['rel', 'noopener', 'noreferrer'],
    ],
  },
}
```

**Full ArticleBody component pattern:**
```typescript
// Source: github.com/remarkjs/react-markdown + github.com/rehypejs/rehype-sanitize
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ['target', '_blank'], ['rel', 'noopener', 'noreferrer']],
  },
}

export function ArticleBody({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      components={{
        // Terminal heading styles — bespoke, no typography plugin
        h1: ({ children }) => <h1 className="crt-glow text-terminal-green font-mono text-lg font-bold mt-6 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-terminal-green font-mono text-base font-semibold mt-5 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-terminal-green-dim font-mono text-sm font-semibold mt-4 mb-1">{children}</h3>,
        // Paragraphs
        p: ({ children }) => <p className="font-mono text-sm text-terminal-green-dim mb-3 leading-relaxed">{children}</p>,
        // Code blocks
        code: ({ children, className }) => (
          <code className={`font-mono text-terminal-amber bg-terminal-surface px-1 text-xs ${className ?? ''}`}>{children}</code>
        ),
        pre: ({ children }) => <pre className="bg-terminal-surface border border-terminal-border p-3 overflow-x-auto text-xs mb-3">{children}</pre>,
        // Links — new tab, no rehype-raw needed
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-terminal-green underline hover:text-terminal-amber">{children}</a>
        ),
        // Images — inline, constrained width
        img: ({ src, alt }) => (
          <img src={src} alt={alt ?? ''} className="max-w-full h-auto my-3 border border-terminal-border" />
        ),
        // Blockquotes
        blockquote: ({ children }) => <blockquote className="border-l-2 border-terminal-border pl-4 text-terminal-muted italic mb-3">{children}</blockquote>,
        // Lists
        ul: ({ children }) => <ul className="list-disc list-inside text-terminal-green-dim text-sm mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside text-terminal-green-dim text-sm mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="font-mono">{children}</li>,
        // Horizontal rule
        hr: () => <hr className="border-terminal-border my-4" />,
        // Strong / em
        strong: ({ children }) => <strong className="text-terminal-green font-bold">{children}</strong>,
        em: ({ children }) => <em className="text-terminal-amber not-italic">{children}</em>,
      }}
    >
      {content}
    </Markdown>
  )
}
```

**Key safety properties:**
- No `rehype-raw` → inline HTML from authors is escaped, not rendered as DOM
- `rehype-sanitize` is belt-and-suspenders for any edge-case HTML that slips through
- `a` component override handles `target="_blank"` via React props, not raw HTML attributes
- Images use `src` from the safe mdast AST — no `javascript:` URLs reach `<img src>`

### Pattern 2: shadcn Accordion for Inline Reader (D-03)

**What:** `Accordion type="single" collapsible` wraps all `ArticleCard` items. One article open at a time; clicking the open article collapses it.

**The shadcn `AccordionTrigger` component:**
- Internally wraps `AccordionPrimitive.Header` (renders as `h3`) and `AccordionPrimitive.Trigger`
- Accepts arbitrary JSX `children` — the full card anatomy (title row + author/timestamp row) works as trigger content
- Appends a `ChevronDown` icon that rotates 180° on open via `[data-state=open]` selector
- The `h3` semantic is cosmetically invisible given `--radius: 0rem` and the terminal CSS reset; style it with `className` if needed

**Controlled accordion for D-10 (filter clears open article):**
```typescript
// In ArticleList or AppShell
const [openId, setOpenId] = useState<string>('')

// D-10: when filteredArticles changes, check if open article still present
const filteredIds = useMemo(() => new Set(filteredArticles.map(a => a.id)), [filteredArticles])
useEffect(() => {
  if (openId && !filteredIds.has(openId)) setOpenId('')
}, [filteredIds, openId])

// Render:
<Accordion
  type="single"
  collapsible
  value={openId}
  onValueChange={setOpenId}
>
  {filteredArticles.map(article => (
    <AccordionItem key={article.id} value={article.id}>
      <AccordionTrigger className="font-mono text-left [&>svg]:shrink-0">
        {/* Full card anatomy here — title + author/timestamp */}
        <div className="flex flex-col gap-1 flex-1">
          <span className="crt-glow text-terminal-green font-semibold">{displayTitle}</span>
          <div className="flex items-center gap-2 text-xs text-terminal-green-dim">
            {/* avatar + name + separator + timestamp */}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <ArticleBody content={article.content} />
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

**Note on `ArticleCard` refactor:** The current `ArticleCard` is a standalone `Card` component. Phase 4 restructures it to use the Accordion anatomy. Options:
1. Replace `Card` + `ArticleCard` with `AccordionItem` + `AccordionTrigger` + `AccordionContent` directly in `ArticleList`
2. Keep `ArticleCard` as a wrapper that internally renders as `AccordionItem`

Option 1 is simpler. The `Card`/`CardContent` wrapper from Phase 3 may be retained as a visual container inside `AccordionContent` (for the body), or the terminal border styling can be applied directly to `AccordionItem`.

### Pattern 3: AND/OR Segmented Control (D-09, FILT-04)

**What:** `ToggleGroup type="single"` from shadcn, always-active (one mode always selected).

**Critical pitfall — deselection fires `onValueChange("")`:** When the user clicks the already-selected toggle item, `ToggleGroup type="single"` calls `onValueChange("")`. For a mode switch that must always have a value, guard against empty:

```typescript
// Source: verified from @radix-ui/react-toggle-group source (onItemDeactivate calls setValue(""))
const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR')

<ToggleGroup
  type="single"
  value={matchMode}
  onValueChange={(val) => {
    // Guard: ignore empty string (user clicked already-selected item)
    if (val === 'or' || val === 'all') setMatchMode(val === 'or' ? 'OR' : 'AND')
  }}
  className="font-mono text-xs border border-terminal-border"
>
  <ToggleGroupItem value="or" className="px-3 py-1 text-xs font-mono data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green">
    Match ANY
  </ToggleGroupItem>
  <ToggleGroupItem value="all" className="px-3 py-1 text-xs font-mono data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green">
    Match ALL
  </ToggleGroupItem>
</ToggleGroup>
```

### Pattern 4: Dynamic Faceted Count Algorithm (D-08)

**Problem:** A naive count of "articles containing this tag in the current filtered set" breaks in OR mode — selecting tag A narrows the set, so tag B's count drops even though B is now independent of A.

**Standard faceted-search semantics (industry standard, Algolia et al.):**
> Each tag's count = "how many articles would be in the result set if this tag were also selected in addition to all current filters"

**Concrete algorithm for this project:**

For OR mode (Match ANY):
- A tag `T`'s count = number of articles in `allArticles` that carry `T`
- Reason: in OR mode, adding `T` to the selection always broadens (or keeps same) the set. The meaningful question is "how many articles does `T` contribute?" which equals its static count over the full set.
- Selected tags never show 0 because their count is over `allArticles`.

For AND mode (Match ALL):
- A tag `T`'s count = number of articles that carry `T` AND all currently-selected tags (minus `T` itself)
- Reason: "if I add `T` to my current AND filter, how many articles remain?"
- `T`'s count when T is selected = `filteredArticles.length` (the current result set already satisfies all AND conditions including `T`)

**Implementation:**
```typescript
// Source: faceted-search standard pattern — [ASSUMED] (no single official spec)
function computeDynamicCounts(
  articles: Article[],
  selectedTags: Set<string>,
  matchMode: 'OR' | 'AND',
): Map<string, number> {
  const counts = new Map<string, number>()
  const allTags = new Set(articles.flatMap(a => a.hashtags))

  for (const tag of allTags) {
    if (matchMode === 'OR') {
      // OR: count articles that carry this tag across all articles
      counts.set(tag, articles.filter(a => a.hashtags.includes(tag)).length)
    } else {
      // AND: count articles that carry this tag AND all other selected tags
      const otherSelected = new Set([...selectedTags].filter(t => t !== tag))
      const base = otherSelected.size > 0
        ? articles.filter(a => [...otherSelected].every(t => a.hashtags.includes(t)))
        : articles
      counts.set(tag, base.filter(a => a.hashtags.includes(tag)).length)
    }
  }
  return counts
}
```

**Why this never shows misleading 0 for a selected tag:**
- In OR mode: counts are over `allArticles`, so any selected tag always has count ≥ 1 (it's in the set because at least one article has it)
- In AND mode: a selected tag `T` shows `filteredArticles.length` (the current AND result already includes `T`'s constraint), which is ≥ 1 unless the entire filter produces 0 results (in which case ALL tags show 0, which is the correct signal)

### Pattern 5: Filter State Architecture (FILT-03, FILT-04)

**Where filter state lives:** Local to `AppShell` (not in `NostrContext`, not in a new context). `NostrContext` is data-layer only.

```typescript
// In AppShell
const { status, articles, profiles, refetch } = useNostr()

// Filter state — local UI state
const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
const [matchMode, setMatchMode] = useState<'OR' | 'AND'>('OR')

// Derived: static facet list for display order
const facets = useMemo(() => buildFacets(articles), [articles])

// Derived: dynamic counts for display
const dynamicCounts = useMemo(
  () => computeDynamicCounts(articles, selectedTags, matchMode),
  [articles, selectedTags, matchMode]
)

// Derived: filtered article list
const filteredArticles = useMemo(() => {
  if (selectedTags.size === 0) return articles  // empty selection → show all
  return articles.filter(article =>
    matchMode === 'OR'
      ? article.hashtags.some(t => selectedTags.has(t))
      : article.hashtags.every(t => selectedTags.has(t))
  )
}, [articles, selectedTags, matchMode])

// Derived: is this the empty-FILTER state (distinct from status === 'empty')?
const isFilterEmpty = selectedTags.size > 0 && filteredArticles.length === 0
```

**Helper: buildFacets (static, for ordering)**
```typescript
// Returns tags sorted by count desc, alpha tie-break
function buildFacets(articles: Article[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    for (const tag of article.hashtags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
```

### Pattern 6: Empty-Filter State (D-11)

**Condition:** `selectedTags.size > 0 && filteredArticles.length === 0`

**Must NOT be confused with:** `status === 'empty'` (relay returned 0 events) or `status === 'error'`.

**Render branch in AppShell** (added alongside existing status branches, not inside them):
```typescript
{isFilterEmpty ? (
  <div className="font-mono text-sm">
    <p className="text-terminal-muted mb-4">
      [FILTER] no articles match the selected tags
    </p>
    <button
      onClick={() => setSelectedTags(new Set())}
      className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
    >
      &gt; clear filters
    </button>
  </div>
) : (
  <ArticleList articles={filteredArticles} profiles={profiles} status={status} />
)}
```

### Anti-Patterns to Avoid

- **Storing `filteredArticles` in `NostrContext`:** Creates synchronization requirements. Filtering is UI state; data is data.
- **Adding `rehype-raw`:** Explicitly forbidden (CLAUDE.md, STACK.md). The `components` prop handles link/image customization without it.
- **Using `import Markdown from 'react-markdown/esm'` or any subpath:** react-markdown@10.x exposes a single export (`./index.js`). Use `import Markdown from 'react-markdown'`.
- **Importing `defaultSchema` from `hast-util-sanitize` directly:** Import it from `rehype-sanitize` — it re-exports `defaultSchema` correctly.
- **Not guarding `ToggleGroup onValueChange("")`:** Forgetting the deselection guard leaves `matchMode` as empty string, breaking the filter logic silently.
- **Treating `isFilterEmpty` as a `NostrStatus` variant:** The data layer has four fixed statuses. Filter-empty is a derived UI boolean computed from `filteredArticles.length`, not dispatched through the reducer.
- **Folding the Accordion `value` into `NostrContext`:** Accordion open state is ephemeral UI concern; keep it local to `ArticleList` or `AppShell`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expand/collapse with one-at-a-time constraint | Custom `expandedId` state + conditional render in `ArticleList` | shadcn `Accordion type="single" collapsible` | Accessibility (ARIA keyboard nav, `aria-expanded`), animation, `data-state` hooks — Radix handles it |
| Markdown sanitization | Custom HTML parser or allowlist | `rehype-sanitize` with `defaultSchema` | Edge cases in HTML parsing are security-critical; library has 100% test coverage |
| Markdown → React rendering | `dangerouslySetInnerHTML` with marked/DOMPurify | `react-markdown` | Produces React elements, not HTML strings; no XSS attack surface |
| AND/OR segmented control | Two `<button>` elements with manual active-state CSS | shadcn `ToggleGroup` | ARIA `role="radiogroup"`, keyboard navigation, Radix managed state |
| Facet checkboxes | `<input type="checkbox">` with custom styling | shadcn `Checkbox` | ARIA `role="checkbox"`, indeterminate state, `CheckedState` type, consistent terminal theme |

**Key insight:** For this domain (untrusted content + accessibility), the cost of correctness bugs in hand-rolled solutions is disproportionate to the simplicity of the use case. The library choices handle the hard parts.

---

## Common Pitfalls

### Pitfall 1: rehype-sanitize Strips `target="_blank"` on Links

**What goes wrong:** The `defaultSchema` from `rehype-sanitize` does not allow `target` on `<a>` elements. Passing `rehypePlugins={[rehypeSanitize]}` (no schema extension) results in all `target="_blank"` attributes being stripped — links open in same tab.

**Why it happens:** The default sanitization schema is conservative. `target` is an attribute that could be used for tab-napping (old `window.opener` attack), so it is blocklisted by default.

**How to avoid:** Extend `defaultSchema` to allow `['target', '_blank']` on `a`, AND also allow `['rel', ...]` so that the `components` prop's `rel="noopener noreferrer"` is not stripped. Alternatively, rely entirely on the React `components` prop override for `a` elements — the `components` override runs after sanitization in the rendering pipeline and can add `target` via React props even if the hast attribute was stripped. The `components.a` override approach is **simpler and sufficient for this project** because it does not depend on the sanitization schema allowing `target`.

**Recommended approach for this project:** Keep `rehypeSanitize` with default schema (or minimal extension); handle `target="_blank"` exclusively via `components.a` React prop. The React component override applies at render time, after the hast tree is already sanitized.

**Warning signs:** Links open in same tab; `console.log` of rendered HTML shows no `target` attribute.

---

### Pitfall 2: ToggleGroup Deselects to Empty String

**What goes wrong:** User clicks the already-active "Match ANY" toggle. `onValueChange("")` fires. If the handler does `setMatchMode(val as 'OR' | 'AND')`, `matchMode` becomes `''`. The filter predicate (`matchMode === 'OR'`) silently evaluates false; `filteredArticles` may return 0 articles or all articles depending on implementation.

**Why it happens:** `ToggleGroup type="single"` is built on `Toggle` primitives which can be on/off. Radix calls `onItemDeactivate` → `setValue("")` when the pressed item is clicked again. [VERIFIED: @radix-ui/react-toggle-group source]

**How to avoid:** Guard the `onValueChange` callback — only update state when the incoming value is a known mode string:
```typescript
onValueChange={(val) => { if (val === 'or' || val === 'all') setMatchMode(val === 'or' ? 'OR' : 'AND') }}
```

**Warning signs:** After clicking a toggle item twice, the filter stops working. `matchMode` logs as `''`.

---

### Pitfall 3: Accordion AccordionHeader Semantic Collision

**What goes wrong:** The shadcn `AccordionTrigger` component internally wraps content in `AccordionPrimitive.Header` which renders as `<h3>`. If the article title is also semantically a heading, the page has nested heading elements or incorrect heading hierarchy.

**Why it happens:** Radix Accordion uses `h3` for the accordion header for ARIA compliance. The shadcn component wraps the Radix primitive without exposing `AccordionHeader` to consumers.

**How to avoid:** In a terminal/CRT aesthetic with zero `--radius` and a full CSS reset, the `h3` renders with no visible difference from a `div`. Do not add an additional heading inside the `AccordionTrigger` children — render the title as a styled `span` or `div`, not an `h3`/`h2`. The semantic heading is the `AccordionPrimitive.Header` itself.

**Warning signs:** Multiple nested `h3` elements in DevTools; browser accessibility tree shows duplicate headings.

---

### Pitfall 4: Dynamic Count Shows 0 for Selected Tag in AND Mode

**What goes wrong:** A naive count of "articles in `filteredArticles` that have this tag" shows 0 for any tag not present in the current AND result. If the filter is aggressive, all non-selected tags show 0. This makes the UI appear broken.

**Why it happens:** AND mode with N selected tags already constrains the result set to articles carrying ALL N tags. Adding a new tag `T` to the set further constrains; the count of the current result that also has `T` may be 0 even though `T` is common.

**How to avoid:** Use the "count if also toggled on" algorithm described in Pattern 4. A selected tag in AND mode shows `filteredArticles.length` (correct), not a sub-count of the already-filtered set.

**Warning signs:** All unselected tags show count 0 after selecting 2+ tags in AND mode. Interface appears to have no matching tags.

---

### Pitfall 5: ESM Import for react-markdown

**What goes wrong:** `import { Markdown } from 'react-markdown'` (named import) fails because react-markdown@10.x uses a default export. TypeScript may not catch this depending on `moduleResolution` settings.

**Why it happens:** The package exports a single default component. Some developers expect a named export.

**How to avoid:** Always use default import: `import Markdown from 'react-markdown'`

**Warning signs:** Runtime error "Markdown is not a function" or "Element type is invalid".

---

### Pitfall 6: filter-state useMemo Dependency on Set Identity

**What goes wrong:** `useMemo(() => filteredArticles, [articles, selectedTags, matchMode])` — `selectedTags` is a `Set<string>`. Sets in JavaScript are reference-equal only when it is literally the same object. If the state update does `setSelectedTags(prev => { prev.add(tag); return prev; })` (mutating the existing Set), the `useMemo` never recomputes because the reference hasn't changed.

**Why it happens:** Forgetting that `useMemo` does shallow equality on dependencies. A mutated Set has the same reference.

**How to avoid:** Always create a new Set on update:
```typescript
setSelectedTags(prev => {
  const next = new Set(prev)
  if (next.has(tag)) next.delete(tag) else next.add(tag)
  return next
})
```

**Warning signs:** Checking/unchecking a tag does not update the article list. `filteredArticles` appears to cache stale results.

---

## Code Examples

### Minimal react-markdown (secure, terminal-styled)

```typescript
// Source: github.com/remarkjs/react-markdown README + github.com/rehypejs/rehype-sanitize README
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// Minimal — uses defaultSchema (no target="_blank" extension needed when using components.a)
<Markdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeSanitize]}
  components={{
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
         className="text-terminal-green underline">
        {children}
      </a>
    ),
  }}
>
  {content}
</Markdown>
```

### Accordion single-open with D-10 controlled clear

```typescript
// Source: @radix-ui/react-accordion API (type definitions + Radix docs)
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

const [openId, setOpenId] = useState<string>('')

// D-10: clear open article when it filters out
useEffect(() => {
  if (openId && !filteredArticles.find(a => a.id === openId)) {
    setOpenId('')
  }
}, [filteredArticles, openId])

<Accordion type="single" collapsible value={openId} onValueChange={setOpenId}>
  {filteredArticles.map(article => (
    <AccordionItem key={article.id} value={article.id}
                   className="border-terminal-border">
      <AccordionTrigger className="font-mono text-left hover:no-underline px-4 py-3">
        {/* card anatomy as children — arbitrary JSX OK */}
        <div className="flex flex-col gap-1 flex-1 text-left">
          <span className="crt-glow text-terminal-green font-semibold text-sm leading-snug">
            {article.title ?? '(untitled)'}
          </span>
          <span className="text-terminal-green-dim text-xs">
            {/* author + timestamp */}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <ArticleBody content={article.content} />
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

### Checkbox facet tag control

```typescript
// Source: @radix-ui/react-checkbox API
import { Checkbox } from '@/components/ui/checkbox'

<div className="flex items-center gap-2">
  <Checkbox
    id={`tag-${tag}`}
    checked={selectedTags.has(tag)}
    onCheckedChange={(checked) => {
      setSelectedTags(prev => {
        const next = new Set(prev)
        if (checked) next.add(tag) else next.delete(tag)
        return next
      })
    }}
    className="border-terminal-border data-[state=checked]:bg-terminal-green data-[state=checked]:border-terminal-green"
  />
  <label htmlFor={`tag-${tag}`} className="font-mono text-xs text-terminal-green-dim cursor-pointer">
    #{tag}
    <span className="ml-1 text-terminal-muted">({dynamicCounts.get(tag) ?? 0})</span>
  </label>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-markdown` v6-v8 (unified v9/v10) | v10.x (unified v11) | 2024 | Plugin import syntax unchanged but v11 plugins are ESM-only; mixing v9/v11 plugins silently fails |
| Tailwind `prose` plugin for Markdown styling | Bespoke `components` prop with Tailwind utility classes | This project (no typography plugin installed) | Must style every element explicitly — but gains full terminal-theme control |
| Radix accordion `@radix-ui/react-accordion` direct import | `radix-ui` unified package (`import { Accordion } from "radix-ui"`) | shadcn CLI circa 2024 | Avatar component confirmed using `radix-ui` unified package; accordion/checkbox/toggle-group follow same pattern |

**Deprecated/outdated:**
- `react-markdown` v6-v8: incompatible `remarkPlugins`/`rehypePlugins` API differences. Do not reference old tutorials.
- `tailwind.config.js` with `require('@tailwindcss/typography')`: Tailwind v4 dropped JS config. If typography plugin is needed in a future phase, it would be `@tailwindcss/typography` via `@plugin` directive in CSS — but it is NOT used in this project.
- `@radix-ui/react-accordion` direct import: the project uses the unified `radix-ui` package. shadcn CLI will scaffold the component using that package (confirmed from `avatar.tsx` pattern: `import { Avatar as AvatarPrimitive } from "radix-ui"`).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-markdown`, `remark-gfm`, `rehype-sanitize` download counts (~10M/wk, ~2M/wk) | Package Legitimacy Audit | Low — packages are from unified collective, well-established |
| A2 | shadcn CLI `add accordion` generates a component using `import { Accordion as AccordionPrimitive } from "radix-ui"` (unified package, matching avatar.tsx pattern) | Standard Stack | Low — confirmed by avatar.tsx; if different, adjust import in component |
| A3 | Dynamic count algorithm (Pattern 4) matches user's expectation of "standard faceted-search counts" | Architecture Patterns | Medium — the algorithm is the standard approach but the specific OR-mode choice (counts over all articles) differs from some implementations that count over the current OR result |
| A4 | `rehype-sanitize`'s `defaultSchema` does not allow `target` attribute on `<a>` | Pattern 1 pitfall | Low — confirmed by rehype-sanitize README; the `components.a` workaround is documented |

---

## Open Questions

1. **`Card` wrapper in the accordion trigger**
   - What we know: `ArticleCard` currently wraps in shadcn `Card` with `border-terminal-border bg-terminal-surface`. `AccordionItem` has its own border.
   - What's unclear: Whether to keep the `Card` as an inner container for visual consistency or replace it entirely with accordion item styling.
   - Recommendation: Replace `Card` with direct `AccordionItem` styling; apply `bg-terminal-surface border-terminal-border` to `AccordionItem` via `className`. The planner decides.

2. **"show more" toggle for D-07 cap**
   - What we know: Top N tags shown, rest hidden behind a toggle. N is Claude's discretion (~10–12 suggested).
   - What's unclear: Whether to use shadcn `Collapsible` or a plain `useState` boolean with conditional render.
   - Recommendation: Plain `useState` boolean — this is a simple two-state show/hide with no animation requirement. The `Collapsible` component adds animation but the filter bar should feel fast/instant. Use `isExpanded` boolean + conditional render.

3. **FilterBar scroll behavior in the sticky bar**
   - What we know: D-02 requires the bar to be sticky. With many tags and the `> more` toggle expanded, the bar could grow tall.
   - What's unclear: Whether tags should wrap freely or be horizontally scrollable.
   - Recommendation: `flex-wrap` with `gap-2` — terminal command line feel allows wrapping. The "show more" cap keeps default height manageable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Install react-markdown stack | ✓ | 22.x [ASSUMED] | — |
| `npx shadcn` | Add accordion/checkbox/toggle-group components | ✓ | 4.10.0 [VERIFIED: shadcn info] | — |
| Internet access (npm registry) | `npm install` | ✓ [ASSUMED] | — | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Static site, no auth |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Public read-only content |
| V5 Input Validation | Yes | `rehype-sanitize` with `defaultSchema`; `components` prop overrides for a/img |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns for Markdown + Nostr content

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `<script>` in NIP-23 article body | Tampering (XSS) | `rehype-sanitize` strips script elements; react-markdown never uses `dangerouslySetInnerHTML` |
| `onerror=` / event handler attributes on `<img>` in body | Tampering (XSS) | `rehype-sanitize defaultSchema` strips all event handler attributes |
| `javascript:` href in Markdown links | Tampering (XSS) | `rehype-sanitize` strips non-http/https href values; `components.a` override only passes `href` prop |
| Tab-napping via `target="_blank"` (window.opener) | Spoofing | `rel="noopener noreferrer"` on all links (enforced in `components.a` override) |
| Data exfiltration via `<img src="attacker.com/...">` | Information Disclosure | Images allowed by design (D-05); no sensitive data in the browser's rendering context |
| `rehype-raw` added in future (XSS regress) | Tampering | Explicitly forbidden in CLAUDE.md and STACK.md; document in component comments |

**Security constraint from CLAUDE.md:** `rehype-raw` is forbidden. This constraint is architecturally enforced by using `components` prop overrides for all HTML customization instead of re-enabling raw HTML parsing.

---

## Sources

### Primary (HIGH confidence)
- `@radix-ui/react-accordion` v1.2.13 type definitions — `type="single"`, `collapsible`, `AccordionSingleProps`, `AccordionTrigger` children [VERIFIED: node_modules]
- `@radix-ui/react-toggle-group` v1.1.12 source (`index.mjs`) — `onItemDeactivate` calls `setValue("")` [VERIFIED: node_modules]
- `@radix-ui/react-checkbox` v1.3.4 type definitions — `checked`, `onCheckedChange`, `CheckedState` [VERIFIED: node_modules]
- `radix-ui` v1.5.0 `index.d.ts` — exports `Accordion`, `Checkbox`, `ToggleGroup` [VERIFIED: node_modules]
- npm registry — version verification: react-markdown@10.1.0, remark-gfm@4.0.1, rehype-sanitize@6.0.0 [VERIFIED: npm view]
- npm registry — peer dependencies: react-markdown@10.1.0 requires `react >=18` (React 19 compatible) [VERIFIED: npm view]
- npm registry — postinstall scripts: none on any of the three packages [VERIFIED: npm view]
- `package.json` (project) — installed deps: nostr-tools@2.23.5, radix-ui@1.5.0 [VERIFIED: project file]
- `src/components/ui/avatar.tsx` — confirms `import { Avatar as AvatarPrimitive } from "radix-ui"` pattern [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- github.com/rehypejs/rehype-sanitize README — `defaultSchema` import from `rehype-sanitize`; schema extension pattern for `target` attribute [CITED: github.com/rehypejs/rehype-sanitize]
- github.com/remarkjs/react-markdown README — `components` prop API; `remarkPlugins`/`rehypePlugins` array ordering; ESM default import [CITED: github.com/remarkjs/react-markdown]
- ui.shadcn.com/docs/components/toggle-group — `type="single"`, controlled `value`/`onValueChange` [CITED: ui.shadcn.com]
- ui.shadcn.com/docs/components/accordion — `type="single"`, `collapsible`, arbitrary children in trigger [CITED: ui.shadcn.com]
- ui.shadcn.com/docs/components/checkbox — `checked`/`onCheckedChange` controlled pattern [CITED: ui.shadcn.com]
- github.com/shadcn-ui/ui issue #4732 + PR #4323 — AccordionTrigger accepts arbitrary JSX children; asChild history [CITED: github.com/shadcn-ui/ui]
- shadcn CLI `info` output — version 4.10.0, Tailwind v4, new-york style, radix base [VERIFIED: CLI output]

### Tertiary (LOW confidence)
- Algolia faceted-search engineering blog — dynamic faceting algorithm semantics (OR mode independent counts) [CITED: algolia.com — confirms industry standard, not authoritative for this specific algorithm]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified on npm registry; peer deps confirmed
- Architecture: HIGH — based on reading actual type definitions and source from node_modules
- Markdown Pipeline: HIGH — pattern verified against official READMEs; pitfalls confirmed from source
- Dynamic Count Algorithm: MEDIUM — standard faceted-search approach documented but no single authoritative spec; logic is self-consistent
- Pitfalls: HIGH — ToggleGroup deselection verified from source; accordion h3 semantic verified from type defs

**Research date:** 2026-06-07
**Valid until:** 2026-08-07 (60 days — packages are stable, Radix and shadcn APIs are settled)
