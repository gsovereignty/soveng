<!-- GSD:project-start source:PROJECT.md -->

## Project

**Soveng — Nostr Long-Form Reader**

A single-page web app that fetches the 21 most recent kind:30023 (NIP-23 long-form)
articles from a default set of public Nostr relays and presents them as a browsable,
terminal-styled reading list. Each article shows its title, author (name + picture
resolved from kind:0 profile metadata), and timestamp. A faceted sidebar of hashtags —
derived from the articles' `t` tags, with per-tag counts and an AND/OR filter toggle —
lets readers narrow the list. Clicking an article expands its Markdown content inline.
It's a static site, built with Vite and deployable to GitHub Pages.

**Core Value:** Discover and read recent Nostr long-form articles, filtered by hashtag — with zero
backend, served entirely as a static GitHub Pages site.

### Constraints

- **Tech stack**: React + shadcn/ui + Vite — per standing preference to use existing
  shadcn components rather than build new UI components from scratch.

- **Hosting**: Must build to static assets deployable on GitHub Pages — no server-side
  runtime, no backend, no environment secrets.

- **Data source**: Live Nostr relays over WebSocket — must tolerate slow/unresponsive
  relays and partial results gracefully.

- **UI aesthetic**: Terminal look — monospace typography, terminal color palette
  (green-on-black phosphor default), themed via shadcn/Tailwind tokens.

- **Article count**: Fixed at 21 most recent — not a configurable feed length in v1.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | 8.0.16 | Build tooling and dev server | Fastest HMR, first-class static asset output, native ESM — standard for React SPAs in 2025 |
| React | 19.x | UI framework | Already decided; works with shadcn/ui React 19 components |
| TypeScript | 5.x | Type safety | Nostr event shapes benefit greatly from types; nostr-tools ships full typedefs |
| shadcn/ui | latest CLI | Component library | Already decided; new-york style, Tailwind v4, React 19 |
| Tailwind CSS | 4.3.0 | Utility styling | shadcn/ui now targets Tailwind v4 by default for new Vite projects; `@tailwindcss/vite` replaces the postcss plugin |
| nostr-tools | 2.23.5 | Nostr protocol primitives + SimplePool | Correct choice for this project — see rationale below |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-markdown | 10.1.0 | Render kind:30023 Markdown body | Inline article expand — uses React elements, never dangerouslySetInnerHTML |
| remark-gfm | 4.0.1 | GitHub Flavored Markdown plugin | Tables, strikethrough, autolinks common in Nostr articles |
| rehype-sanitize | 6.0.0 | Strip unsafe HTML from rendered output | Required when rendering untrusted Nostr content (any author can write the body) |
| @vitejs/plugin-react | 6.0.2 | React Fast Refresh + JSX transform | Standard Vite + React setup; no Babel config needed |
| @tailwindcss/vite | 4.3.0 | Tailwind v4 Vite integration | Replaces PostCSS-based setup; single `plugins: [tailwindcss()]` in vite.config |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| shadcn CLI (`npx shadcn@latest`) | Scaffold components into `src/components/ui/` | Run `init -t vite` for a new project; `add <component>` per component needed |
| gh-pages (`gh-pages@6.3.0`) | Programmatic publish to `gh-pages` branch | Alternative to GitHub Actions artifact deploy; Actions workflow is preferred (see deployment section) |

## Nostr Library Decision: nostr-tools 2.x

- NDK 3.0.3 has an unpacked size of 4.3MB. Its dependencies include `shiki` (code syntax highlighter) and `@codesandbox/sandpack-client` — neither of which serves this project and both of which bloat the bundle for a static GitHub Pages app.
- NDK adds outbox/gossip-model routing, caching, buffered subscription deduplication. These are valuable for write clients and social graph apps. For fetching 21 articles from 4 known relays, the added complexity and bundle cost is not justified.
- NDK 3.0.3 was at `beta` dist-tag for a long time and only recently reached `latest`. Its API changed significantly between 2.x and 3.x (subscribe options structure moved in v2.13). Stability risk exists.
- applesauce-relay 6.0.3 (164KB unpacked) is well-designed and used in noStrudel. It is built on RxJS, adding a mandatory RxJS peer dependency. RxJS is excellent for event-stream composition but introduces conceptual overhead (Observables, operators) for a simple collect-then-render use case.
- The applesauce suite (applesauce-core + applesauce-relay) is best suited when you need reactive event stores, model subscriptions, and complex state management across many event types. Overkill for 21 articles and profile metadata.
- Less community documentation and fewer Stack Overflow answers than nostr-tools.
- `SimplePool.querySync(relays, filter)` collects all events matching a filter across multiple relays, waits for all EOSE signals, and resolves with a deduplicated array. This matches the fetch-21-articles pattern exactly.
- `SimplePool.subscribe(relays, filters, { onevent, oneose })` supports streaming with EOSE callback — handles the profile metadata batch fetch (fire kind:0 requests after article pubkeys are known, close on EOSE).
- Ships TypeScript types for all Nostr event kinds including `LongFormArticle = 30023` and `Metadata = 0`.
- 4.3MB unpacked vs NDK's 4.3MB... but nostr-tools unpacked is 4.3MB while the actual gzipped bundle contribution is much smaller because most of the package is NIP implementations you never import.
- Smallest conceptual surface: no RxJS, no caching layer, no framework bindings needed.

## Markdown Rendering Decision: react-markdown + remark-gfm + rehype-sanitize

## shadcn/ui + Tailwind v4 Terminal Theme

## GitHub Pages Deployment

## Installation

# 1. Scaffold with shadcn (new Vite project)

# 2. Core Nostr library

# 3. Markdown rendering

# 4. shadcn components needed (add as required)

# 5. Dev dependencies (Vite + React already installed by shadcn init)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| nostr-tools SimplePool | NDK 3.x | NDK makes sense for write clients, gossip/outbox routing, or apps needing persistent caching and reactive event stores. The bundle cost (shiki, sandpack) is acceptable if you use those features. |
| nostr-tools SimplePool | applesauce-relay + applesauce-core | Applesauce is the right choice when building a complex reactive client (like noStrudel) that needs RxJS-based event streams, model subscriptions, and an in-memory EventStore. The RxJS requirement is fine if your team knows reactive programming. |
| react-markdown | markdown-to-jsx | markdown-to-jsx is lighter but has less active maintenance and no typed component override API. Use it only if bundle size is critical. |
| Tailwind v4 + @tailwindcss/vite | Tailwind v3 + PostCSS | Use v3 only if you need to match an existing codebase's Tailwind version. shadcn/ui CLI defaults to v4 for new projects. |
| GitHub Actions Pages deploy | gh-pages npm package | gh-pages package is fine for simpler setups but requires a deploy token and creates an extra commit. Actions is cleaner for CI. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| NDK 3.x for this project | Ships `shiki` and `@codesandbox/sandpack-client` as dependencies; 4.3MB unpacked. Adds substantial bundle weight for features (syntax highlighting, sandpack) this read-only app will never use. | nostr-tools SimplePool |
| rehype-raw (without rehype-sanitize) | Allows raw HTML from untrusted Nostr article content to reach the DOM, enabling XSS | rehype-sanitize (or just omit rehype-raw entirely) |
| nostr-relaypool (npm) | Unmaintained; last meaningful commit was 2022. SimplePool in nostr-tools supersedes it. | nostr-tools SimplePool |
| tailwind.config.js patterns from v3 tutorials | Tailwind v4 dropped the JS config file; @theme directive in CSS replaces it. v3-style configs silently do nothing in a v4 project. | @theme inline in index.css |
| `import { ... } from 'nostr-tools'` (root import) | The root barrel import defeats tree-shaking. Import from subpaths: `nostr-tools/pool`, `nostr-tools/kinds`, `nostr-tools/nip19`. | Subpath imports |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| nostr-tools@2.23.5 | nostr-tools/pool, /kinds, /nip19 subpaths | Dual-published as `nostr-tools` (npm) and `@nostr/tools` (JSR); use the npm name for now |
| react-markdown@10.1.0 | remark-gfm@4.0.1, rehype-sanitize@6.0.0 | All on unified v11 ecosystem; compatible. Do NOT mix with older unified v9 plugins. |
| tailwindcss@4.3.0 | @tailwindcss/vite@4.3.0 | Versions must match — install both at the same version |
| shadcn/ui (new-york style, Tailwind v4) | React 19, Tailwind 4.x | shadcn CLI detects the installed Tailwind version; do not mix Tailwind v3 components with a v4 setup |
| NDK@3.0.3 | NOT recommended for this project | Listed for reference only |

## Sources

- `/nbd-wtf/nostr-tools` (Context7) — SimplePool API, Relay class, kind constants
- `/nostr-dev-kit/ndk` (Context7) — subscription options, multi-relay API
- `/remarkjs/react-markdown` (Context7) — sanitization docs, skipHtml, rehype pipeline
- https://ui.shadcn.com/docs/theming — CSS variable system, dark mode tokens
- https://ui.shadcn.com/docs/tailwind-v4 — Tailwind v4 migration, @theme directive, new-york defaults
- https://ui.shadcn.com/docs/installation/vite — Vite setup steps, @tailwindcss/vite config
- https://vite.dev/guide/static-deploy.html — GitHub Pages base path and Actions workflow
- https://github.com/statico/smui — terminal-aesthetic shadcn reference implementation
- https://applesauce.build/typedoc/modules/applesauce-relay.html — applesauce-relay architecture (RxJS, RelayPool, RelayGroup)
- npm registry — version verification: nostr-tools@2.23.5, @nostr-dev-kit/ndk@3.0.3, react-markdown@10.1.0, remark-gfm@4.0.1, rehype-sanitize@6.0.0, tailwindcss@4.3.0

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
