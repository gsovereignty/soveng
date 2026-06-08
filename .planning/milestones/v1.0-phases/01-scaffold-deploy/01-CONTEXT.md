# Phase 1: Scaffold & Deploy - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a terminal-themed Vite + React + TypeScript app, styled with shadcn/ui
(new-york) on Tailwind v4, wired to a GitHub Actions → GitHub Pages pipeline, and
deployed live as a styled **placeholder page**. This is the skeleton every later phase
builds on — no Nostr fetching, no article rendering, no faceting in this phase.

Covers requirements **UI-01** (terminal-themed shadcn/ui), **DEPLOY-01** (Vite static
build with correct `base`), **DEPLOY-02** (Actions → Pages workflow with SPA 404 fallback).

</domain>

<decisions>
## Implementation Decisions

### Hosting & Base Path (DEPLOY-01)
- **D-01 (CORRECTED):** Hosted as a **project subpath page** — repository is `gsovereignty/soveng`,
  served at `https://gsovereignty.github.io/soveng/`. Therefore Vite **`base: '/soveng/'`** (project
  subpath), NOT `'/'`. Built asset URLs become `/soveng/assets/...`.
  _Original assumption (base '/') was incorrect and caused PITFALLS #5 — asset 404s on the live URL._
- **D-02 (CORRECTED):** Repository is `gsovereignty/soveng` — a standard **project repo**, NOT a
  `username.github.io` root-page repo. GitHub Pages serves it at `https://gsovereignty.github.io/soveng/`.
  _Original assumption (username.github.io root-page model) was incorrect — corrected after user
  clarified the actual repo name and live URL during 01-02 execution._

> **DEVIATION NOTE (01-02):** Plans 01-02 Task 1 and 2 were initially committed with `base: '/'`
> based on the incorrect assumption that the repo was a root-page (`username.github.io`) type.
> The user confirmed the actual repo is `gsovereignty/soveng` and the live URL is
> `https://gsovereignty.github.io/soveng/` (project-subpath model). `vite.config.ts` was updated
> to `base: '/soveng/'` after the Task 3 checkpoint. The deploy.yml needs no change — it uploads
> the `dist` artifact regardless of base; GitHub Pages handles the subpath routing automatically.
> This corrects the exact PITFALLS #5 scenario the plan was designed to prevent.

### Deploy Pipeline (DEPLOY-02)
- **D-03:** GitHub **Actions → Pages** (artifact deploy), not the `gh-pages` npm package —
  matches research recommendation; no deploy token, no extra branch commit.
- **D-04:** SPA fallback: copy `dist/index.html` → `dist/404.html` as part of the build so
  deep links resolve. (Lower risk here since the app is single-view, but include it per
  success criterion #3.)

### Terminal Aesthetic (UI-01)
- **D-05:** Palette = **classic green phosphor on black**. Implement via Tailwind v4
  `@theme inline` OKLCH tokens; force `--font-sans: var(--font-mono)` so the whole app is
  monospace.
- **D-06:** **Full CRT** treatment — scanline overlay, text glow/bloom, and a faint
  flicker. This is the committed look for the app chrome and placeholder.
  - ⚠ **Readability flag for Phase 4:** full scanlines/glow can degrade long-form article
    body readability. Phase 4 (inline Markdown reader) should consider dialing CRT effects
    back on body text while keeping them on chrome. Not a Phase 1 concern (placeholder only).

### Placeholder Content
- **D-07:** First deploy shows a **fake terminal boot sequence** — lines like
  `soveng v0.1 — connecting to relays... [OK]` resolving to a **blinking prompt/cursor**.
  Designed to double as the natural **loading aesthetic** in later phases (reuse intent —
  build it as a small reusable component, not throwaway markup).

### Typography
- **D-08:** **JetBrains Mono**, **self-hosted via `@fontsource/jetbrains-mono`** — no
  Google Fonts network request, keeps the static/zero-backend ethos fully self-contained.

### Component Usage (standing constraint)
- **D-09:** Per global instruction, use **existing shadcn/ui components** only — do not
  author bespoke UI primitives. CRT effects and the boot sequence are CSS/layout layered on
  top of shadcn primitives, not new component types.

### Claude's Discretion
- Exact OKLCH hue/lightness values for the green phosphor palette (research notes these
  are a starting point needing visual iteration).
- Specific boot-sequence log lines and timing/animation cadence.
- Project structure, Vite config details, TS config, shadcn init flags, Actions workflow
  YAML specifics, and which (if any) initial shadcn components to scaffold for the
  placeholder.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — overall product definition, constraints, key decisions
- `.planning/REQUIREMENTS.md` §UI-01, §DEPLOY-01, §DEPLOY-02 — locked requirement text
- `.planning/ROADMAP.md` §"Phase 1: Scaffold & Deploy" — goal + 3 success criteria

### Research (stack & pitfalls relevant to this phase)
- `.planning/research/STACK.md` — pinned versions: Vite, React 19, Tailwind v4 +
  `@tailwindcss/vite`, shadcn/ui (new-york), `@fontsource/jetbrains-mono`
- `.planning/research/SUMMARY.md` §"Phase 1" — deploy-first rationale; confirms Phase 1 is
  standard patterns (can skip phase-research)
- `.planning/research/PITFALLS.md` #5 — wrong Vite `base` causes asset 404s only when
  deployed (mitigated here by `base: '/'`)
- `.planning/research/ARCHITECTURE.md` — overall component plan (later phases; informs
  where the reusable boot/loading component should live)

### Project guidance
- `CLAUDE.md` — tech-stack table, terminal-theme guidance, "use existing shadcn components"
  standing rule

No additional user-supplied external specs/ADRs were referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield. Only `CLAUDE.md` and `.planning/` exist; no `src/`, no `package.json`,
  no git remote.

### Established Patterns
- None yet. This phase **establishes** the foundational patterns: project layout, Tailwind
  v4 `@theme` token convention, monospace-everywhere font stack, CRT styling approach, and
  the Actions → Pages deploy workflow that all later phases inherit.

### Integration Points
- The boot-sequence placeholder should be built as a reusable component (D-07) so Phase 2/3
  can repurpose it as the relay-fetch loading state.

</code_context>

<specifics>
## Specific Ideas

- Boot sequence line example: `soveng v0.1 — connecting to relays... [OK]` → blinking prompt.
- "Full CRT" = scanlines + text glow/bloom + faint flicker (the user explicitly chose the
  most immersive option over subtle/none).
- Green-on-black phosphor is the deliberate, committed default — not a placeholder choice.

</specifics>

<deferred>
## Deferred Ideas

- **CRT-effect toggle / reduced-motion handling** — full CRT immersion vs readability; revisit
  for the article body in **Phase 4** (inline reader). Consider `prefers-reduced-motion`.
- **Light/alternate theme toggle** — not requested; green phosphor is the single v1 theme.
- **Custom domain** — not chosen. Project is served at `gsovereignty.github.io/soveng/` (project-subpath model, D-02 corrected). Custom domain is a possible future addition.

None of the above expand Phase 1 scope.

</deferred>

---

*Phase: 1-Scaffold & Deploy*
*Context gathered: 2026-06-06*
