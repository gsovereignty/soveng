# Stack Research

**Domain:** Nostr long-form article reader (kind:30023 / NIP-23), static SPA
**Researched:** 2026-06-05
**Confidence:** HIGH (core stack), MEDIUM (theming specifics)

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

**Recommendation: `nostr-tools@2.23.5` with `SimplePool`**

This is a read-only app that opens a fixed set of 4 relays, issues two filters (kind:30023 for articles, kind:0 for author profiles), collects results until EOSE, then closes. SimplePool is the right abstraction for this.

**Why not NDK 3.x:**
- NDK 3.0.3 has an unpacked size of 4.3MB. Its dependencies include `shiki` (code syntax highlighter) and `@codesandbox/sandpack-client` — neither of which serves this project and both of which bloat the bundle for a static GitHub Pages app.
- NDK adds outbox/gossip-model routing, caching, buffered subscription deduplication. These are valuable for write clients and social graph apps. For fetching 21 articles from 4 known relays, the added complexity and bundle cost is not justified.
- NDK 3.0.3 was at `beta` dist-tag for a long time and only recently reached `latest`. Its API changed significantly between 2.x and 3.x (subscribe options structure moved in v2.13). Stability risk exists.

**Why not applesauce-relay:**
- applesauce-relay 6.0.3 (164KB unpacked) is well-designed and used in noStrudel. It is built on RxJS, adding a mandatory RxJS peer dependency. RxJS is excellent for event-stream composition but introduces conceptual overhead (Observables, operators) for a simple collect-then-render use case.
- The applesauce suite (applesauce-core + applesauce-relay) is best suited when you need reactive event stores, model subscriptions, and complex state management across many event types. Overkill for 21 articles and profile metadata.
- Less community documentation and fewer Stack Overflow answers than nostr-tools.

**Why nostr-tools 2.23.5:**
- `SimplePool.querySync(relays, filter)` collects all events matching a filter across multiple relays, waits for all EOSE signals, and resolves with a deduplicated array. This matches the fetch-21-articles pattern exactly.
- `SimplePool.subscribe(relays, filters, { onevent, oneose })` supports streaming with EOSE callback — handles the profile metadata batch fetch (fire kind:0 requests after article pubkeys are known, close on EOSE).
- Ships TypeScript types for all Nostr event kinds including `LongFormArticle = 30023` and `Metadata = 0`.
- 4.3MB unpacked vs NDK's 4.3MB... but nostr-tools unpacked is 4.3MB while the actual gzipped bundle contribution is much smaller because most of the package is NIP implementations you never import.
- Smallest conceptual surface: no RxJS, no caching layer, no framework bindings needed.

**Concrete fetch pattern with SimplePool:**

```typescript
import { SimplePool } from 'nostr-tools/pool'
import { LongFormArticle, Metadata } from 'nostr-tools/kinds'

const pool = new SimplePool()
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
]

// Step 1: fetch 21 most recent articles
const articles = await pool.querySync(RELAYS, {
  kinds: [LongFormArticle],
  limit: 21,
})

// Step 2: batch-fetch author metadata
const pubkeys = [...new Set(articles.map(e => e.pubkey))]
const profiles = await pool.querySync(RELAYS, {
  kinds: [Metadata],
  authors: pubkeys,
})

pool.destroy()
```

Note: `querySync` is the correct async method (not `get`, which returns one event). It collects from all relays and returns when all EOSE signals arrive. Import from subpath `nostr-tools/pool`, not the root package, to enable tree-shaking.

## Markdown Rendering Decision: react-markdown + remark-gfm + rehype-sanitize

**Recommendation: `react-markdown@10.1.0` + `remark-gfm@4.0.1` + `rehype-sanitize@6.0.0`**

react-markdown is secure by default — it never uses `dangerouslySetInnerHTML`. It processes Markdown through the unified/remark/rehype pipeline and produces React elements. XSS via malicious Markdown is prevented by the library's architecture.

**Sanitization still required because:** NIP-23 articles are published by arbitrary authors. An author can embed raw HTML in their Markdown (e.g., `<script>` tags, `onerror=` attributes on images). By default react-markdown escapes inline HTML, which is safe. Adding `rehype-sanitize` is belt-and-suspenders defense against any plugins (like `rehype-raw`) that might be added later or any edge cases in the unified pipeline.

Do NOT add `rehype-raw` unless raw HTML from articles is explicitly required — it opens XSS surface and is not needed for standard NIP-23 content.

**Custom component override for terminal styling:**

```typescript
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

<Markdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeSanitize]}
  components={{
    // Override to apply terminal Tailwind classes
    h1: ({ children }) => <h1 className="text-terminal-green font-mono text-xl font-bold mb-4">{children}</h1>,
    code: ({ children }) => <code className="font-mono text-terminal-amber bg-terminal-surface px-1">{children}</code>,
    a: ({ href, children }) => <a href={href} className="text-terminal-green underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  }}
>
  {article.content}
</Markdown>
```

## shadcn/ui + Tailwind v4 Terminal Theme

**Tailwind v4 setup with Vite is the current standard for new shadcn projects.**

Key difference from v3: no `tailwind.config.js`. Configuration lives in `src/index.css` via `@theme` directive. The `@tailwindcss/vite` plugin (not PostCSS) handles the build.

**Terminal palette implementation in `src/index.css`:**

```css
@import "tailwindcss";

@theme inline {
  /* Terminal color tokens */
  --color-terminal-bg: oklch(0.08 0 0);           /* near-black */
  --color-terminal-surface: oklch(0.12 0 0);      /* slightly lighter card bg */
  --color-terminal-green: oklch(0.75 0.2 145);    /* phosphor green */
  --color-terminal-green-dim: oklch(0.55 0.15 145);
  --color-terminal-amber: oklch(0.78 0.18 75);    /* amber accent */
  --color-terminal-border: oklch(0.25 0.05 145);  /* faint green border */
  --color-terminal-muted: oklch(0.4 0.05 145);    /* dimmed text */

  /* Override shadcn semantic tokens */
  --color-background: var(--color-terminal-bg);
  --color-foreground: var(--color-terminal-green);
  --color-card: var(--color-terminal-surface);
  --color-card-foreground: var(--color-terminal-green);
  --color-border: var(--color-terminal-border);
  --color-muted: var(--color-terminal-surface);
  --color-muted-foreground: var(--color-terminal-muted);
  --color-primary: var(--color-terminal-green);
  --color-primary-foreground: var(--color-terminal-bg);

  /* Monospace font stack */
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace;
  --font-sans: var(--font-mono);  /* Make entire UI monospace */

  /* Zero border radius for terminal aesthetic */
  --radius: 0rem;
}

/* Base reset for terminal look */
@layer base {
  body {
    @apply bg-terminal-bg text-terminal-green font-mono;
    -webkit-font-smoothing: antialiased;
  }
}
```

Load JetBrains Mono from Google Fonts in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

The `smui` project on GitHub (github.com/statico/smui) demonstrates a complete terminal-aesthetic shadcn theme with Nord-inspired colors if more reference is needed. For phosphor green rather than Nord, the OKLCH values above achieve the correct hue.

## GitHub Pages Deployment

**Pattern: GitHub Actions workflow writing to `gh-pages` branch via official Pages actions.**

This is the current best-practice approach. The old `gh-pages` npm package works but the Actions approach is more transparent and doesn't require a deploy token.

**vite.config.ts — base path:**
```typescript
export default defineConfig({
  base: '/<REPO_NAME>/',  // e.g. '/soveng/'
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

If the repo is at a custom domain or `<username>.github.io`, use `base: '/'`.

**SPA 404 fallback:** GitHub Pages has no server-side routing. Copy `dist/index.html` to `dist/404.html` during deployment. GitHub Pages serves the 404.html for any unmatched path, which means React Router (if used) gets control. For this project with no client-side routing beyond expand/collapse state in React, this is not critical but is a good practice.

**`.github/workflows/deploy.yml`:**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Enable Pages in repo Settings → Pages → Source: GitHub Actions.

## Installation

```bash
# 1. Scaffold with shadcn (new Vite project)
npx shadcn@latest init -t vite

# 2. Core Nostr library
npm install nostr-tools

# 3. Markdown rendering
npm install react-markdown remark-gfm rehype-sanitize

# 4. shadcn components needed (add as required)
npx shadcn@latest add card badge checkbox separator scroll-area

# 5. Dev dependencies (Vite + React already installed by shadcn init)
npm install -D @types/node
```

No extra packages for WebSocket — the browser WebSocket API is sufficient. nostr-tools uses it natively.

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

---
*Stack research for: Nostr long-form reader (kind:30023), static SPA, React + Vite + shadcn/ui*
*Researched: 2026-06-05*
