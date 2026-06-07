# Stack Research

**Domain:** Nostr long-form article reader (kind:30023 / NIP-23), static SPA
**Researched:** 2026-06-05 (v1.0) / 2026-06-07 (v1.1 ML filtering additions)
**Confidence:** HIGH (core stack), MEDIUM (theming specifics), HIGH (ML filtering additions — npm-verified, Context7-verified)

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

---

## v1.1 Additions: In-Browser ML Content Filtering

The following section covers NEW additions for the v1.1 milestone only. The existing v1.0 stack above is unchanged.

### New Libraries — ML Filtering

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @huggingface/transformers | 4.2.0 | In-browser ONNX model inference via WASM | Current correct package; replaces legacy @xenova/transformers. Downloads ONNX models from HF CDN at runtime, caches in browser Cache API. |
| franc-min | 6.2.0 | Synchronous language detection | Smallest variant (127KB unpacked); covers 82 languages (8M+ speakers); synchronous; no model download; correctly identifies English for article title+body text. |

#### Why NOT @xenova/transformers

`@xenova/transformers` (latest: 2.17.2) is NOT deprecated as of June 2026, but it is the legacy package. The official v3+ package is `@huggingface/transformers`. Both are on npm; the HF package should be used for all new code. The HF package is 9.5MB unpacked — the runtime JS bundle contribution is much smaller because ONNX Runtime WASM files are loaded separately (not bundled).

---

## ONNX Model Selection for Spam/Quality Classification

### Critical Context: Model Size vs Task Fit

All common DistilBERT-based transformers.js models are 67–438MB even quantized. Only TinyBERT-class models are practical for first-visit browser downloads.

### Available Options (verified against HF Hub, June 2026)

| Model ID | Quantized Size (int8) | Task | Notes |
|----------|----------------------|------|-------|
| `onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX` | **4.49 MB** | Binary spam/ham | Best size. Trained on SMS (short text). Reasonable spam-pattern transfer to Nostr articles; limited on long-form. |
| `Xenova/ms-marco-TinyBERT-L-2-v2` | **4.5 MB** | Relevance reranking | Wrong task — trained on MS MARCO query relevance, not spam classification. Do not use for spam. |
| `Xenova/distilbert-base-uncased-finetuned-sst-2-english` | **67.4 MB** | Sentiment (POSITIVE/NEGATIVE) | Wrong task for spam; too large for first-visit download. |
| `Xenova/distilbert-base-uncased-mnli` | **67.4 MB** | Zero-shot NLI | Correct task capability but 67MB download. Usable only as an opt-in experience. |
| `Xenova/toxic-bert` | **110 MB** (smallest: q4f16 = 97MB) | Toxicity multi-label | Far too large; designed for long-form toxicity, not Nostr spam. |

### Recommended Model

**`onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX`** with `dtype: 'q8'` (int8 = 4.49 MB).

Rationale: The 4.49MB quantized size is the only option that passes the "reasonable first-visit download" bar for a GitHub Pages static app. Users on mobile or slow connections would abandon a site that silently downloads 67MB before showing content. The SMS training data is a limitation — Nostr spam often shares similar short, deceptive patterns (promotional text, repeated content, non-substantive posts) that transfer reasonably. For long-form article spam, the model will have more false negatives than a purpose-trained spam classifier. This is acceptable because filtering is fail-open by design: classification errors show more articles, never fewer.

**Labels output:** `SPAM` and `NOT_SPAM` (binary) — verified from base model `mrm8488/bert-tiny-finetuned-sms-spam-detection`.

**Why not zero-shot NLI for spam:** Zero-shot classification with `Xenova/distilbert-base-uncased-mnli` (67MB) runs multiple NLI passes per article, requires 67MB download, and takes 1–3 seconds per article on CPU WASM. With 20+ articles to classify, total latency is 20–60 seconds. Not viable as a default-on filter.

**Why not Xenova/toxic-bert:** 97–110MB quantized. Web.dev's own article on using it notes "notably larger than the median web page size (2.2MB)" and treats it as an exceptional one-time download. Not appropriate as a default-on filter for a reader app.

---

## Language Detection: franc-min

**`franc-min@6.2.0`** is the correct choice.

### Comparison

| Library | Version | Unpacked Size | Languages | Sync? | Short Text Accuracy | Notes |
|---------|---------|---------------|-----------|-------|---------------------|-------|
| **franc-min** | 6.2.0 | **127KB** | 82 (8M+ speakers) | Yes | Fair (struggles under 50 chars) | Best for browser; use `{only: ['eng']}` to optimize |
| franc | 6.2.0 | 272KB | 187 (1M+ speakers) | Yes | Fair | More languages but 2x larger |
| tinyld | 1.3.4 | **12.2MB** | many | Yes | Good on short text | Far too large for browser use |
| eld | 2.0.3 | **9.1MB** | 60 | Yes | Good | Too large for browser use |

### Why franc-min

- At 127KB unpacked, it adds negligible bundle weight.
- Synchronous: no async overhead, no WASM, no model download.
- The `{only: ['eng']}` option restricts scoring to English alone, reducing computational cost and preventing false matches.
- Works well on article bodies (typically 200–2000 words). The documented weakness ("less accurate under 50 chars") is mitigated by using title + body together — Nostr long-form articles always have a body.
- ISO 639-3 code system: English is `'eng'`, not `'en'`. Call as `franc(titlePlusBody, { only: ['eng'] })` and check result === `'eng'`.

### Usage Pattern

```typescript
import { franc } from 'franc-min'

function isEnglish(title: string, body: string): boolean {
  // Combine title + first 500 chars of body for reliable detection
  const sample = `${title} ${body.slice(0, 500)}`
  return franc(sample, { only: ['eng'] }) === 'eng'
}
```

---

## Vite Configuration for ML Filtering

### Required vite.config.ts Changes

The existing vite.config.ts needs two additions for transformers.js + ONNX Runtime:

```typescript
export default defineConfig({
  base: '/soveng/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // v1.1 additions:
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],  // prevent Vite pre-bundling from parsing WASM imports
  },
  worker: {
    format: 'es',  // web workers must be ES modules for dynamic import() to work inside them
  },
})
```

No need for `assetsInclude: ['**/*.onnx']` because ONNX models are streamed from the HF CDN at runtime via `env.allowRemoteModels = true` (default) — they are not bundled with the app. If you ever self-host models, add `assetsInclude: ['**/*.onnx']`.

### Web Worker Pattern (mandatory)

ONNX inference is CPU-intensive. Running it on the main thread will jank the UI for 500ms–3s per article batch. Use a Web Worker with a singleton pipeline:

```typescript
// src/workers/classifier.worker.ts
import { pipeline, env } from '@huggingface/transformers'

// Force single-thread WASM — required for GitHub Pages (no COOP/COEP headers)
env.backends.onnx.wasm.numThreads = 1

// Disable local model lookup — always fetch from HF CDN
env.allowLocalModels = false

class SpamPipeline {
  static instance: ReturnType<typeof pipeline> | null = null

  static async get(onProgress?: (x: unknown) => void) {
    if (!this.instance) {
      this.instance = pipeline(
        'text-classification',
        'onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX',
        { dtype: 'q8', progress_callback: onProgress }
      )
    }
    return this.instance
  }
}

self.addEventListener('message', async (e) => {
  const { id, text } = e.data
  const classifier = await SpamPipeline.get((progress) => {
    self.postMessage({ type: 'progress', ...progress })
  })
  const result = await (await classifier)(text)
  self.postMessage({ type: 'result', id, result })
})
```

```typescript
// src/hooks/useSpamWorker.ts (React side)
const worker = useRef<Worker | null>(null)

useEffect(() => {
  worker.current = new Worker(
    new URL('../workers/classifier.worker.ts', import.meta.url),
    { type: 'module' }
  )
  return () => worker.current?.terminate()
}, [])
```

---

## GitHub Pages Header Constraints (Critical)

### The Problem

ONNX Runtime Web's multi-threaded WASM backend requires `SharedArrayBuffer`. `SharedArrayBuffer` requires [cross-origin isolation](https://web.dev/cross-origin-isolation-guide/), which requires these HTTP response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**GitHub Pages cannot set custom HTTP headers.** There is an open community request ([#13309](https://github.com/orgs/community/discussions/13309)) with no resolution as of June 2026.

### The Solution: Force Single-Thread WASM

Set `env.backends.onnx.wasm.numThreads = 1` in the worker before any inference runs. This disables multi-threading entirely and eliminates the `SharedArrayBuffer` requirement. ONNX Runtime falls back to single-threaded WASM, which works without COOP/COEP headers and runs in all modern browsers.

**Performance tradeoff:** Single-threaded WASM is 2–4x slower than multi-threaded. For a 4.49MB TinyBERT model running text classification on article-length text, single-threaded inference is approximately 200–500ms per article on a modern laptop. With 20 articles, total classification time is 4–10 seconds. This is acceptable because classification runs in a background worker after articles are already rendered (fail-open: articles show immediately, spam flag is applied asynchronously).

### The Workaround NOT Recommended: coi-serviceworker

`coi-serviceworker@0.1.7` (last published July 2023, 3 years old) patches COOP/COEP headers via a service worker. It works for some use cases but:
- Causes a page reload on first visit (poor UX)
- Has known issues with third-party embeds and cross-origin resources
- Is unmaintained (3 years since last release)
- Not needed if you use `numThreads = 1`

Use `numThreads = 1` instead.

### WebGPU Fallback

WebGPU (`device: 'webgpu'`) provides GPU-accelerated inference without `SharedArrayBuffer`. WebGPU does not require COOP/COEP. However, as of 2025, WebGPU is available in ~70% of browsers (Chrome 113+, Edge 113+, but limited Firefox and Safari). WebGPU support for this model architecture should be verified. Recommend: primary `device: 'wasm'` with `numThreads: 1`, with optional WebGPU if available:

```typescript
const device = navigator.gpu ? 'webgpu' : 'wasm'
// Only apply numThreads=1 if falling back to WASM
if (device === 'wasm') env.backends.onnx.wasm.numThreads = 1
```

---

## Bundle Size Impact

### Main Bundle: No Change

`@huggingface/transformers` must be excluded from `optimizeDeps` and is dynamically imported only inside the Web Worker file. With Vite's module worker build, the worker is compiled into a **separate chunk** and is not part of the main application bundle. The main bundle size is unchanged.

`franc-min` (127KB unpacked, ~40KB gzipped) is synchronous and small. Import it directly from the language-detection utility module. It will be included in the main bundle but at negligible cost (~1% of a typical React app bundle).

### What Loads at Runtime (not bundled)

- ONNX Runtime WASM binary: loaded by `onnxruntime-web` at first inference (~5MB, cached by browser)
- ONNX model file: `onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX` int8 variant, **4.49MB**, fetched from HF CDN (`huggingface.co/...`) on first visit, cached in browser's Cache API thereafter.
- Tokenizer files: small JSON files (<100KB total) fetched from HF CDN alongside the model.

Total first-visit extra network cost: approximately **10MB** (WASM runtime ~5MB + model 4.49MB + tokenizer/config ~0.5MB). Subsequent visits: 0 additional cost (all cached).

### Chunk Strategy Recommendation

No manual `manualChunks` configuration is required. Vite automatically isolates the worker into its own chunk. The main app does not `import` from `@huggingface/transformers` directly — only the worker file does.

---

## Integration with Existing Fetch Pipeline

The ML filtering integrates after the existing fetch→render pipeline, not before it:

```
fetch articles (nostr-tools SimplePool)
  → deduplicate, sort by reply count (existing)
  → render ArticleList with all articles visible (existing)
  → [NEW] start Web Worker, begin classification in background
  → for each classified article: update isSpam / isNonEnglish state
  → re-render: hide articles where isSpam || isNonEnglish
```

Language detection (franc-min) is synchronous and can run immediately after articles arrive, before the worker is even initialized. Spam classification runs asynchronously in the worker, article by article or in small batches.

**Fail-open guarantee:** If the worker fails to load the model (network error, quota exceeded, ONNX init error), articles remain visible. Classification state defaults to `{ isSpam: false, isNonEnglish: false }`.

---

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
# Existing v1.0 dependencies (already installed)
# nostr-tools, react-markdown, remark-gfm, rehype-sanitize, shadcn components

# v1.1 NEW additions
npm install @huggingface/transformers franc-min
```

No additional dev dependencies required. `@huggingface/transformers` ships TypeScript types in the package.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| nostr-tools SimplePool | NDK 3.x | NDK makes sense for write clients, gossip/outbox routing, or apps needing persistent caching and reactive event stores. The bundle cost (shiki, sandpack) is acceptable if you use those features. |
| nostr-tools SimplePool | applesauce-relay + applesauce-core | Applesauce is the right choice when building a complex reactive client (like noStrudel) that needs RxJS-based event streams, model subscriptions, and an in-memory EventStore. The RxJS requirement is fine if your team knows reactive programming. |
| react-markdown | markdown-to-jsx | markdown-to-jsx is lighter but has less active maintenance and no typed component override API. Use it only if bundle size is critical. |
| Tailwind v4 + @tailwindcss/vite | Tailwind v3 + PostCSS | Use v3 only if you need to match an existing codebase's Tailwind version. shadcn/ui CLI defaults to v4 for new projects. |
| GitHub Actions Pages deploy | gh-pages npm package | gh-pages package is fine for simpler setups but requires a deploy token and creates an extra commit. Actions is cleaner for CI. |
| @huggingface/transformers | @xenova/transformers | Use @xenova/transformers only if maintaining code that was already written against the v2.x API. For all new v1.1 code, use @huggingface/transformers (the canonical v3+ package). |
| franc-min | tinyld | tinyld is more accurate on short text but 12MB unpacked — not suitable for browser use. Use tinyld in Node.js server contexts only. |
| franc-min | eld | eld is 9MB unpacked — same problem as tinyld. Very accurate but too large for browser. |
| onnx-community/bert-tiny-sms-spam (4.5MB q8) | Xenova/distilbert-mnli for zero-shot | Zero-shot: 67MB download + 1–3s per article × 20 articles = 20–60s latency. Only viable as opt-in, not default-on. |
| WASM single-thread (numThreads=1) | coi-serviceworker + multi-threaded WASM | coi-serviceworker is unmaintained (3 years), causes page reload on first visit, and adds complexity. Single-thread WASM is 2–4x slower but avoids all cross-origin isolation issues. Performance is acceptable for this use case. |
| WASM single-thread | WebGPU | WebGPU is faster and does not require SharedArrayBuffer. Use it as an enhancement when `navigator.gpu` is available. Do not require it as the primary path — ~30% of users lack WebGPU support. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| NDK 3.x for this project | Ships `shiki` and `@codesandbox/sandpack-client` as dependencies; 4.3MB unpacked. Adds substantial bundle weight for features (syntax highlighting, sandpack) this read-only app will never use. | nostr-tools SimplePool |
| rehype-raw (without rehype-sanitize) | Allows raw HTML from untrusted Nostr article content to reach the DOM, enabling XSS | rehype-sanitize (or just omit rehype-raw entirely) |
| nostr-relaypool (npm) | Unmaintained; last meaningful commit was 2022. SimplePool in nostr-tools supersedes it. | nostr-tools SimplePool |
| tailwind.config.js patterns from v3 tutorials | Tailwind v4 dropped the JS config file; @theme directive in CSS replaces it. v3-style configs silently do nothing in a v4 project. | @theme inline in index.css |
| `import { ... } from 'nostr-tools'` (root import) | The root barrel import defeats tree-shaking. Import from subpaths: `nostr-tools/pool`, `nostr-tools/kinds`, `nostr-tools/nip19`. | Subpath imports |
| Xenova/toxic-bert (97–438MB) | Even the smallest quantized variant (q4f16 = 97MB) is an unreasonable default-on browser download. The 111MB quantized variant is what web.dev's own article calls "notably larger than the median web page size." | onnx-community/bert-tiny (4.5MB) |
| tinyld or eld for language detection | Both are 9–12MB unpacked — unacceptable bundle cost for a browser app when franc-min at 127KB does the job. | franc-min |
| coi-serviceworker | Unmaintained (last release July 2023), causes full page reload on first visit, has known issues with third-party resources. Not needed when numThreads=1. | env.backends.onnx.wasm.numThreads = 1 |
| @xenova/transformers for new code | Legacy package (v2.17.2); the current canonical package is @huggingface/transformers. Both still work, but @xenova/transformers has no v3+ features. | @huggingface/transformers |
| Running inference on main thread | Blocks UI rendering for 200ms–3s per article, causing jank during article list display | Web Worker with singleton pipeline |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| nostr-tools@2.23.5 | nostr-tools/pool, /kinds, /nip19 subpaths | Dual-published as `nostr-tools` (npm) and `@nostr/tools` (JSR); use the npm name for now |
| react-markdown@10.1.0 | remark-gfm@4.0.1, rehype-sanitize@6.0.0 | All on unified v11 ecosystem; compatible. Do NOT mix with older unified v9 plugins. |
| tailwindcss@4.3.0 | @tailwindcss/vite@4.3.0 | Versions must match — install both at the same version |
| shadcn/ui (new-york style, Tailwind v4) | React 19, Tailwind 4.x | shadcn CLI detects the installed Tailwind version; do not mix Tailwind v3 components with a v4 setup |
| NDK@3.0.3 | NOT recommended for this project | Listed for reference only |
| @huggingface/transformers@4.2.0 | @vitejs/plugin-react, Vite 8.x | Requires `optimizeDeps.exclude: ['@huggingface/transformers']` and `worker.format: 'es'` in vite.config.ts |
| franc-min@6.2.0 | React 19, TypeScript 5.x, Vite 8.x | Pure JS, no special configuration needed |
| onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX | @huggingface/transformers@4.2.0 | Use `dtype: 'q8'` for the 4.49MB int8 quantized variant |

## Sources

- `/nbd-wtf/nostr-tools` (Context7) — SimplePool API, Relay class, kind constants
- `/nostr-dev-kit/ndk` (Context7) — subscription options, multi-relay API
- `/remarkjs/react-markdown` (Context7) — sanitization docs, skipHtml, rehype pipeline
- `/huggingface/transformers.js` (Context7) — pipeline API, Web Worker singleton pattern, env configuration, WASM backend options
- https://ui.shadcn.com/docs/theming — CSS variable system, dark mode tokens
- https://ui.shadcn.com/docs/tailwind-v4 — Tailwind v4 migration, @theme directive, new-york defaults
- https://ui.shadcn.com/docs/installation/vite — Vite setup steps, @tailwindcss/vite config
- https://vite.dev/guide/static-deploy.html — GitHub Pages base path and Actions workflow
- https://github.com/statico/smui — terminal-aesthetic shadcn reference implementation
- https://applesauce.build/typedoc/modules/applesauce-relay.html — applesauce-relay architecture (RxJS, RelayPool, RelayGroup)
- https://huggingface.co/blog/transformersjs-v4 — v4 release notes, package name change, WebGPU runtime
- https://huggingface.co/onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX — model card, ONNX file sizes verified
- https://huggingface.co/Xenova/toxic-bert — file sizes verified (111MB quantized — too large)
- https://github.com/vitejs/vite/discussions/15962 — Vite + onnxruntime-web configuration, assetsInclude and optimizeDeps
- https://github.com/orgs/community/discussions/13309 — GitHub Pages COOP/COEP header limitation (unresolved)
- https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html — numThreads flag, single-thread configuration
- https://github.com/wooorm/franc — franc-min documentation, language codes, {only} option
- https://web.dev/articles/ai-detect-toxicity-build — Xenova/toxic-bert usage and size context (111MB)
- npm registry — version verification: @huggingface/transformers@4.2.0, @xenova/transformers@2.17.2 (not deprecated), franc-min@6.2.0, franc@6.2.0, tinyld@1.3.4, eld@2.0.3

---
*Stack research for: Nostr long-form reader (kind:30023), static SPA, React + Vite + shadcn/ui*
*v1.0 researched: 2026-06-05*
*v1.1 ML filtering additions researched: 2026-06-07*
