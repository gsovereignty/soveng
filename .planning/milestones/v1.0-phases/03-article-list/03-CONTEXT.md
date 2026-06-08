# Phase 3: Article List - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Render real Nostr articles end-to-end as terminal-styled entries on the deployed Pages URL.
Each entry shows its **title** (with a sensible fallback), the **author identity**
(name + picture, resolved from the kind:0 profile and upgraded in place), and a
**human-readable timestamp**. The phase also wires the Phase 2 status surface
(`streaming → done | empty | error`) into the real rendered list view — replacing the
current debug `<pre>` in `App.tsx` with actual article rendering, and transitioning the
full-screen `BootSequence` into the live list.

Covers requirements **DISP-01** (title + fallback), **DISP-02** (author name +
picture, with display_name → name → truncated-npub fallback), **DISP-03** (human-readable
timestamp from `publishedAt`, which already encodes `published_at` → else `created_at`),
and **DISP-05** (distinct loading / empty / relay-error states).

**Out of this phase (Phase 4):** hashtag facet sidebar + AND/OR filtering (FILT-01…04),
empty-FILTER state, and clicking an article to expand inline sanitized Markdown (DISP-04).
The `summary`, `image`, and `t`-tag/hashtag data already exist on the `Article` model but
are **not displayed** in Phase 3 (summary/image card display is v2 ENRICH-01/02).

</domain>

<decisions>
## Implementation Decisions

### Streaming render — progressive boot-then-stream (DISP-05, honors Phase 2 D-01)
- **D-01:** **Progressive boot-then-stream.** The `BootSequence` plays **only while zero
  articles have been collected**. On the **first** `ARTICLE_RECEIVED` (first card in
  `state.articles`), swap from the boot screen to the live list view and **append cards as
  events stream in**. This realizes Phase 2's render-on-arrival intent (D-01) which the
  current `App.tsx` does not yet honor (it shows BootSequence for the entire `streaming`
  phase and only debug text on `done`).
- **D-02:** **Slim top status line.** While `status === 'streaming'`, show a one-line
  terminal-style header above the list (e.g. `> streaming… N/21 received`) that updates
  live as cards arrive and resolves to a `ready`/done line when the stream stops. This is
  the streaming-vs-done feedback affordance (not a blinking-cursor row).
- **D-03:** **Arrival order, no re-sort.** Cards render in the exact order events arrive and
  are **never re-sorted** — matching Phase 2's hard-freeze-at-21-in-arrival-order (D-02).
  No visible reorder/jump on `done`.

### Author avatar — green-tinted monochrome with monogram fallback (DISP-02)
- **D-04:** **Green-tinted monochrome image.** Render the real `profile.picture` but pass it
  through a CSS filter (grayscale + green tint / brightness) so avatars read as
  phosphor-on-black and stay cohesive with the CRT palette — recognizable, not raw full
  color.
- **D-05:** **Monogram fallback for missing/broken pictures.** When `picture` is absent OR
  the image fails to load, show a bordered monogram derived from the display name (first
  letter[s]), falling back to a truncated-npub glyph when no name is resolved yet. The
  avatar **upgrades in place** to the image if/when it loads (consistent with Phase 2 D-08
  profile-upgrade-in-place; no gating on profile arrival).
- **D-06:** **Use the shadcn `Avatar` component** (`npx shadcn add avatar`). It natively
  handles the image-load-then-fallback behavior described in D-04/D-05 and satisfies the
  standing "use existing shadcn components" rule (Phase 1 D-09). Do **not** hand-roll an
  `<img>` + `onError`.

### Timestamp — absolute terminal ISO, hand-rolled (DISP-03)
- **D-07:** **Terminal ISO absolute format** — `YYYY-MM-DD HH:MM` (e.g. `2026-06-01 14:32`),
  syslog/log-line style. Chosen over relative ("3 days ago") for the terminal aesthetic.
- **D-08:** **Hand-rolled pure formatter** — a small `formatTimestamp()` util using
  `Intl.DateTimeFormat` (no `date-fns` or other dependency), per the lean / zero-backend
  bundle ethos. Source field is `Article.publishedAt` (already encodes the
  `published_at` → `created_at` fallback per the type definition).

### Carried forward from prior phases (locked — do not re-litigate)
- **Loading state = `BootSequence`** (Phase 1 D-07 / Phase 2) — reused as the zero-articles
  streaming aesthetic per D-01 above.
- **Empty + relay-error states with retry already exist in `App.tsx`** (Phase 2 D-06/D-12):
  `empty` = relays responded, zero articles; `error` = all relays errored. Both render a
  terminal-styled message + `refetch()` retry button. Phase 3 **keeps these** and renders
  the list only in the `done`/`streaming`-with-articles paths. The error/empty copy and
  retry control are already implemented — Phase 3 should not regress them.
- **Profile upgrade-in-place, no gating** (Phase 2 D-08/D-09) — cards render immediately
  with the npub/monogram fallback and upgrade as kind:0 events arrive. There is **no**
  `loadingProfiles` gate.
- **Aesthetic** (Phase 1 D-05/D-06): green phosphor on black, full CRT (scanlines, glow,
  flicker), monospace everywhere. Existing tokens: `terminal-bg`, `terminal-surface`,
  `terminal-green`, `terminal-green-dim`, `terminal-amber`, `terminal-border`,
  `terminal-muted`; helpers `crt-glow`, `crt-scanlines`, `crt-flicker`.
  - ⚠ Phase 1's readability flag about dialing CRT back on long-form **body** text is a
    **Phase 4** concern (inline reader); Phase 3 renders only short metadata (title/author/
    timestamp), so full CRT on cards is fine.
- **Component rule** (Phase 1 D-09): use existing shadcn components only (`Card` exists;
  add `Avatar`). No bespoke UI primitives.

### Claude's Discretion
- **Card anatomy / layout** (not deep-dived by user): default to terminal log-line-style
  entries built on the existing shadcn **`Card`** (`src/components/ui/card.tsx`) — title
  prominent, author avatar + name and the ISO timestamp arranged as a compact metadata row.
  Exact spacing, line arrangement, and whether each article is a bordered Card vs a leaner
  list row is the planner's/implementer's call within the terminal aesthetic.
- **Title fallback (DISP-01)** default: `title` → first line/clause of `summary` (truncated)
  → `(untitled)`. The raw `d`-tag is **not** a user-friendly fallback and should not be the
  primary fallback. Implementer may refine the exact truncation length.
- **List container / scroll behavior**: the current `max-w-2xl` centered column is the
  default; 21 cards scroll vertically. No virtualization needed at this fixed small count.
- Exact CSS filter values for the green-tint avatar treatment (D-04) — tune visually.
- Exact wording/format of the slim streaming status line (D-02) and the done resolution.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — product definition, constraints (zero backend, lean bundle), Key Decisions
- `.planning/REQUIREMENTS.md` §DISP-01, §DISP-02, §DISP-03, §DISP-05 — locked requirement text
  (note DISP-04 = Phase 4; FILT-01…04 = Phase 4)
- `.planning/ROADMAP.md` §"Phase 3: Article List" — goal + 4 success criteria

### Prior phase context (decisions Phase 3 inherits)
- `.planning/phases/02-nostr-data-layer/02-CONTEXT.md` — status surface (D-06), profile
  upgrade-in-place / no-gating (D-08/D-09), `refetch()` (D-12), arrival-order freeze (D-02)
- `.planning/phases/01-scaffold-deploy/01-CONTEXT.md` — terminal palette + full CRT (D-05/D-06),
  reusable `BootSequence` loading aesthetic (D-07), monospace/JetBrains Mono (D-08),
  shadcn-only component rule (D-09)

### Research (display layer)
- `.planning/research/ARCHITECTURE.md` — component plan / where article-list + card components live
- `.planning/research/STACK.md` — shadcn (new-york) + how to add components (`Avatar`); pinned versions
- `.planning/research/PITFALLS.md` #3 — optional NIP-23 tags (drives title/timestamp fallbacks)

### Project guidance
- `CLAUDE.md` — tech stack, "use existing shadcn components" rule, react-markdown stack
  (Phase 4, not needed here)

No additional user-supplied external specs/ADRs were referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/card.tsx` — shadcn Card (`Card`, `CardContent`, etc.); the base for
  each article entry. Already used by `BootSequence`.
- `src/components/BootSequence.tsx` (Phase 1 D-07) — the zero-articles streaming screen;
  Phase 3 swaps **out** of it on first article (D-01) but does not modify it.
- `src/App.tsx` — `AppShell` already branches on `status`: `streaming` → BootSequence,
  `error` / `empty` → terminal message + `refetch()` button, else debug `<pre>`. **The
  `done`/has-articles branch (currently the debug `<pre>`) is the integration seam Phase 3
  replaces with the rendered list.** Also: the `streaming` branch must change to show the
  list once `articles.length > 0` (D-01).
- `src/context/NostrContext.tsx` — `useNostr()` exposes `{ status, articles: Article[],
  profiles: Map<string, Profile>, refetch }`. Look up an article's author via
  `profiles.get(article.pubkey)`.
- `src/types/nostr.ts` — `Article` (`title?`, `summary?`, `image?`, `publishedAt` ms,
  `createdAt` ms, `content`, `hashtags[]`, `pubkey`, `coordinate`, `d`) and `Profile`
  (`displayName?`, `picture?`, `pubkey`, `createdAt`).
- `src/index.css` — terminal theme tokens + `crt-*` helper classes (see decisions).

### Established Patterns
- Plain React hooks + context for state (Phase 2 D-11) — no Zustand. Article list is a pure
  render of `useNostr()` output; no new global state needed.
- Terminal/CRT styling via Tailwind tokens + `crt-glow`/`crt-scanlines`/`crt-flicker`.
- shadcn components added via `npx shadcn add <name>` into `src/components/ui/`.
- npb/npub display fallback: use `nostr-tools/nip19` (already a dependency) to encode a
  truncated npub for the author when no profile name is resolved.

### Integration Points
- New article-list + article-card components mount inside `AppShell`'s `<main>` (currently
  `max-w-2xl`), reading from `useNostr()`. The slim streaming status line (D-02) sits above
  the list. Empty/error/retry branches stay as-is.

</code_context>

<specifics>
## Specific Ideas

- Streaming feel the user chose: boot screen plays only at zero articles, then **cards
  append live** as relay events arrive — "alive" terminal streaming, not a wait-then-dump.
- Avatars should look like they belong on a green-phosphor CRT (monochrome green tint), not
  raw full-color photos punched into the terminal.
- Timestamps as machine-log lines (`2026-06-01 14:32`), not chatty relative phrasing.

</specifics>

<deferred>
## Deferred Ideas

- **Inline Markdown article expand** (DISP-04) — clicking a card to render sanitized
  Markdown body is **Phase 4**. Phase 3 cards may be built expand-ready but must not
  implement the expand.
- **Hashtag facet sidebar + AND/OR filter + empty-filter state** (FILT-01…04) — **Phase 4**.
- **Summary + image on cards** (v2 ENRICH-01) and **clickable tag pills** (v2 ENRICH-02) —
  the data exists on `Article` but is not displayed in Phase 3.
- **Relative-time display / "X ago"** — considered and declined for v1 in favor of absolute
  ISO (D-07); could revisit as a hover/secondary format later.
- **Per-relay connection status indicator** (v2 ENRICH-03) — carried from Phase 2 deferred.
- **CRT-effect dial-back / `prefers-reduced-motion` for body text** — Phase 4 reader concern
  (Phase 1 readability flag).

None of the above expand Phase 3 scope.

</deferred>

---

*Phase: 3-Article List*
*Context gathered: 2026-06-07*
