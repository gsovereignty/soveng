# Project Research Summary

**Project:** Soveng — Nostr Long-Form Reader, v1.1 (Local ML Content Filtering)
**Domain:** In-browser ML spam classification + language detection, static SPA on GitHub Pages
**Researched:** 2026-06-07
**Confidence:** HIGH

## Executive Summary

Soveng v1.1 adds client-side content filtering to the shipped v1.0 reader: a `franc-min`
synchronous language gate (non-English detection) and an ONNX spam classifier running in
a Web Worker via `@huggingface/transformers`. The architecture change is surgical — a
single `visibleArticles` memo inserted between `sortedArticles` and the three downstream
memos that already exist (`buildFacets`, `computeDynamicCounts`, `filterArticles`). Every
piece of code outside that insertion point is unchanged. Four new files, two modified files.

The headline risk that all four research dimensions surface independently is false positives
from an SMS-trained spam model operating on a Bitcoin/Nostr/crypto corpus. The only ONNX
spam model small enough for a first-visit browser download (4.49MB,
`onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX`) was trained on 5,570 consumer
SMS messages with zero Bitcoin, Lightning, or Nostr representation. Domain-shift research
shows accuracy dropping from 99% in-domain to ~60% on out-of-domain text. Vocabulary like
"sats," "zap," "pump," "wallet," and "free" are strong SMS spam signals that appear in every
legitimate Nostr Bitcoin article. This model at default threshold (>=0.50) will silently
filter a material fraction of the legitimate article set on day one. The required mitigations
— confidence threshold >=0.90, minimum-length bypass for articles under 100 words, and
fail-open on all ambiguous cases — must ship with the initial implementation, not as
post-ship tuning. There is also a live open product question: whether ML spam classification
is worth shipping at all for this corpus, versus relying on language-detection alone (which
handles the largest spam category cleanly) plus a manual pubkey denylist.

Two additional deployment constraints are non-negotiable for this hosting environment. GitHub
Pages cannot set COOP/COEP HTTP headers, which means `SharedArrayBuffer` is unavailable,
which means ONNX Runtime's multi-threaded WASM backend cannot be used —
`env.backends.onnx.wasm.numThreads = 1` is mandatory. The app is also served at the
`/soveng/` sub-path rather than at origin root, which means
`env.backends.onnx.wasm.wasmPaths` must be explicitly pinned to a CDN URL at the exact
`onnxruntime-web` version that transformers.js installs as a transitive dependency — a
mismatch here produces a cryptic `TypeError` in WASM with no indication of the real cause.

## Key Findings

### Recommended Stack

The v1.0 stack (React 19, Vite 8, TypeScript 5, shadcn/ui, Tailwind v4, nostr-tools
2.23.5) is unchanged. v1.1 adds two runtime dependencies: `@huggingface/transformers@4.2.0`
(the canonical v3+ package — not the legacy `@xenova/transformers`) and `franc-min@6.2.0`.
The HF transformers package is excluded from Vite's `optimizeDeps` and loaded only inside
the Web Worker chunk; it has zero impact on the main bundle. `franc-min` is 127KB unpacked,
synchronous, no WASM, no model download, and runs on the main thread in microseconds. Vite
requires two config additions: `optimizeDeps: { exclude: ['@huggingface/transformers'] }` and
`worker: { format: 'es' }`.

**New libraries for v1.1:**
- `@huggingface/transformers@4.2.0`: ONNX model inference via WASM in a Web Worker — only viable model runner for browser at the size constraint imposed by first-visit UX
- `franc-min@6.2.0`: synchronous language detection (127KB, 82 languages) — synchronous gate that costs nothing before ONNX inference begins

**Model selection:**
- `onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX` with `dtype: 'q8'` (4.49MB) — the only option that clears the first-visit download bar; all alternatives are 67-438MB
- Total first-visit network cost: ~10MB (5MB ORT WASM runtime + 4.49MB model + ~0.5MB tokenizer); zero on subsequent visits (Cache API)

**What NOT to use:**
- `coi-serviceworker`: unmaintained (2023), causes page reload on first visit, unnecessary when `numThreads=1`
- `@xenova/transformers`: legacy package; use `@huggingface/transformers` for all new code
- `tinyld` or `eld` for language detection: 9-12MB unpacked, unacceptable for browser
- `Xenova/distilbert-mnli` for zero-shot spam: 67MB download, 1-3s per article = 20-60s total latency for 21 articles

### Expected Features

**Must have (P1 — v1.1 launch):**
- Filter ON by default, state initializes to `filterEnabled: true`
- Fail-open progressive rendering: articles show immediately, disappear as classification results arrive
- Model download progress indicator — single ambient status strip, not per-article spinners
- Filter toggle (on/off) — users need an escape hatch; every automatic filter ever shipped has needed one
- "N articles filtered" count — without this, a shorter-than-expected list looks like a bug
- `franc-min` English-only gate — synchronous, no model, runs post-fetch on main thread
- Session-scoped classification cache keyed by event ID — module-level `Map` to survive StrictMode double-mount and hashtag filter changes

**Should have (P2 — after user feedback; high probability given corpus risk):**
- Per-article "why filtered" disclosure: "FILTERED: non-English (lang=zh)" or "FILTERED: spam (score=0.93)"
- Confidence threshold slider — default 0.90, range 0.50-0.99; threshold re-evaluates at render time against stored float, no re-inference

**Should have (P3):**
- "Show filtered" peek toggle — reveals hidden articles without disabling filtering globally

**Defer to v2+:**
- Cross-session localStorage cache — adds invalidation complexity; session scope is sufficient for v1.1
- Non-English allow-list (show French, Spanish, German) — binary English-only is sufficient for the default relay corpus
- Custom model fine-tuned on kind:30023 corpus — requires curated Nostr training data and server-side tooling

**Open product decision (unresolved by research):**
Whether to ship ML spam classification at all, versus relying solely on language detection
plus a pubkey denylist. Research establishes that (a) the language gate handles the largest
spam category, (b) the spam model has documented domain-shift risk on this corpus, and (c)
the remaining spam categories may not be meaningfully addressed at any threshold. Resolve
after inspecting real spam scores against 20+ representative Nostr articles.

### Architecture Approach

The v1.0 pipeline is: relay events → `nostrReducer` → `sortedArticles` useMemo →
`buildFacets` / `computeDynamicCounts` / `filterArticles` useMemos → `ArticleList`. The
v1.1 integration inserts `visibleArticles` between `sortedArticles` and those three
downstream memos. That is the only change to `App.tsx`. All components, the reducer, the
context, the fetch hooks, and the library utilities are untouched.

**New files (4):**
1. `src/workers/classifier.worker.ts` — ONNX pipeline singleton, `numThreads=1`, `onmessage` handler, fail-open `catch` returning `'error'` label
2. `src/lib/classifierWorker.ts` — module-level Worker getter (mirrors the existing `lib/pool.ts` singleton pattern exactly — StrictMode safe)
3. `src/lib/languageDetect.ts` — thin `franc-min` wrapper; strips code blocks before detection; returns `'english' | 'non-english' | 'undetermined'`
4. `src/hooks/useClassification.ts` — orchestrates franc gate + Worker dispatch; `useRef<Map<id, ClassificationLabel>>` + `useState` version counter

**Modified files (2):**
- `src/types/nostr.ts` — add `ClassificationLabel = 'pending' | 'ham' | 'spam' | 'non-english' | 'error'`
- `src/App.tsx` — wire `useClassification`; add `visibleArticles` memo; update three downstream memo inputs from `sortedArticles` to `visibleArticles`

**Facet sourcing (settled):** Facets derive from `visibleArticles`, not `sortedArticles`. A
facet count that includes hidden spam creates permanent divergence between counts and results
as ML results stream in. While classification is pending, articles are visible (fail-open),
so counts start at the full set and shrink as confirmed spam is hidden — no jarring jumps.

**Key patterns:**
- Module-level singleton for the Worker (same reason `pool.ts` is module-level: StrictMode safety, no double-instantiation)
- `useRef` Map + version counter pattern for streaming async results (avoids React diffing the Map on every update)
- `franc-min` as synchronous pre-filter on main thread — non-English articles never reach the ONNX queue
- Fail-open on all labels except explicit `'spam'` and `'non-english'`: `undefined`, `'pending'`, `'error'`, `'ham'` all show the article

### Critical Pitfalls

1. **SMS-trained model over-filters Bitcoin/Nostr corpus** — bert-tiny trained on 5,570 consumer SMS; domain shift drops accuracy to ~60%. Bitcoin vocabulary ("sats," "wallet," "pump," "free") scores as spam. Mitigation: `SPAM_THRESHOLD = 0.90` (not 0.50); minimum-length bypass for articles under 100 words; named constant with comment explaining domain shift; log scores to dev console. Consider skipping spam ML entirely and using language detection only.

2. **`wasmPaths` broken on `/soveng/` sub-path** — ONNX Runtime resolves WASM relative to origin root by default. Without explicit `wasmPaths`, ONNX fetches from `https://gsovereignty.github.io/ort-wasm-simd.wasm` (404). Error message says "WASM instantiation failed," not "wrong path." Mitigation: set `env.backends.onnx.wasm.wasmPaths` to a pinned CDN URL. Must be smoke-tested on deployed URL, not localhost.

3. **`onnxruntime-web` version mismatch** — CDN URL at different version than transformers.js's transitive `onnxruntime-web` breaks the WASM ABI with `TypeError: yn[s] is not a function`. Mitigation: inspect `node_modules/onnxruntime-web/package.json` for exact version; pin CDN URL to that exact version; re-verify on every transformers.js upgrade.

4. **`franc-min` mis-flags short titles and code-heavy articles** — Articles about Bitcoin development are 40%+ fenced code blocks, hex pubkeys, and JSON. franc interprets these as non-natural-language and returns `'und'` or a wrong language code. Treating `'und'` as non-English silently hides legitimate articles. Mitigation: strip triple-backtick blocks and hex-only lines before detection; treat `'und'` and confidence < 0.75 as English (fail-open); require 200+ chars of stripped text before running franc; classify on body, not title.

5. **No `numThreads=1` on GitHub Pages** — Without this line, ONNX Runtime attempts multi-threaded WASM, requires `SharedArrayBuffer` (unavailable without COOP/COEP), and may fail silently or log opaque warnings. Must be set before any `pipeline()` call in the worker. Verify on deployed URL: no `SharedArrayBuffer` warning in console.

## Implications for Roadmap

The implementation is small (4 new files, 2 modified, ~100 lines of new code) but
front-loaded with configuration and integration complexity. The natural phase split: get the
plumbing right and validate on the live URL first, then expose the filter controls to users,
then add false-positive recovery tools only if evidence shows they are needed.

### Phase 1: Core ML Pipeline Infrastructure

**Rationale:** Every downstream feature depends on the Worker, the WASM runtime, and the
classification Map existing and working correctly. The deployment constraints
(`numThreads=1`, `wasmPaths`, `optimizeDeps.exclude`) must be resolved on the actual GitHub
Pages URL before any user-visible features are built. The threshold and minimum-length
bypass belong here too — shipping without them risks breaking the existing reading
experience on day one.

**Delivers:**
- `franc-min` language detection with code-block stripping and `'und'`-as-English semantics
- ONNX Web Worker with `numThreads=1`, `wasmPaths` CDN pin, fail-open `catch`
- Module-level Worker singleton (`classifierWorker.ts`)
- `useClassification` hook (Map + version counter)
- `visibleArticles` memo in App.tsx with `SPAM_THRESHOLD = 0.90` and minimum-length bypass
- Facets and downstream memos switched to `visibleArticles`
- `vite.config.ts` updated (`optimizeDeps.exclude`, `worker.format: 'es'`)

**Addresses pitfalls:** All 5 critical pitfalls are Phase 1 issues

**Must verify on deployed URL (not localhost):**
- No `.wasm` 404s in network tab
- No `SharedArrayBuffer` warning in console
- ORT CDN version pin matches `node_modules/onnxruntime-web/package.json`
- Spam scores logged to dev console for 20+ real Nostr articles — confirm no false positives above threshold

**Research flag:** Requires resolution of the open product decision before implementation begins. Inspect real spam scores against live Nostr articles. If scores show widespread false positives even at 0.90, consider shipping language detection only in v1.1 and deferring spam ML.

### Phase 2: User-Visible Filter Controls

**Rationale:** Phase 1 produces working filtering with zero UI. Phase 2 makes the filter
visible and controllable, which is required for user trust and for detecting false positives
in production.

**Delivers:**
- Model download progress indicator (single ambient strip)
- "N articles filtered" count
- Filter toggle (on/off), defaulting to on
- Filter toggle state persisted to `localStorage` (`soveng:ml-filter-enabled`)
- "Content filter unavailable" non-blocking notice when model load fails

**Avoids:** UX pitfalls (silent filtering, no escape hatch, broken filter invisible to user)

**Research flag:** Standard shadcn/ui component patterns. Progress indicator uses transformers.js `progress_callback` from the worker — documented in official React tutorial.

### Phase 3: False-Positive Recovery Tools (conditional)

**Rationale:** The corpus mismatch risk is high enough that false positives in production are
probable. Phase 3 ships the tools users need to investigate and recover from them, triggered
by actual evidence rather than shipped speculatively.

**Delivers:**
- Per-article "why filtered" disclosure (on demand)
- Confidence threshold slider — default 0.90, range 0.50-0.99; re-evaluates at render time, no re-inference
- "Show filtered" peek toggle

**Trigger condition:** Ship Phase 3 if user reports indicate articles are incorrectly hidden,
or if Phase 1 smoke tests show the threshold needs to be user-tunable.

**Research flag:** Standard React + shadcn/ui patterns (Slider, collapsible disclosure). No new ML work.

### Phase Ordering Rationale

- Phase 1 before Phase 2: nothing to show or toggle until the Worker and classification Map exist
- Phase 2 before Phase 3: a filtered count and toggle are needed before users can identify that per-article disclosure would help
- Phase 3 is explicitly conditional — do not schedule until Phase 1 smoke tests have been reviewed and user feedback from Phase 2 is available
- All three phases are confined to the ML layer; the existing fetch, dedup, render, and facet pipeline is not touched in any phase

### Research Flags

Needs resolution during planning:
- **Phase 1:** Open product decision — spam ML vs. language-only. Inspect real Nostr article spam scores before writing the classifier integration. If scores show false positives at 0.90, scope changes significantly.
- **Phase 1:** `wasmPaths` CDN URL — derive the exact version pin from `node_modules/onnxruntime-web/package.json` at implementation time; the version cannot be pre-committed in research.
- **Phase 1:** Vite `?worker` import syntax vs `new URL()` — PITFALLS.md and ARCHITECTURE.md give slightly different recommendations. Use `?worker` syntax for full Vite dependency bundling.

Standard patterns (no additional research needed):
- **Phase 2:** Filter toggle + count + progress UI — standard shadcn Switch, Badge, Progress components; worker `progress_callback` is documented
- **Phase 3:** Threshold slider and peek toggle — shadcn Slider + collapsible patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages npm-verified; transformers.js API verified via Context7 + official docs; franc-min behavior verified from source |
| Features | MEDIUM-HIGH | Core P1 features well-defined; open product decision on spam ML vs. language-only is genuine uncertainty; P2/P3 conditional on false-positive evidence |
| Architecture | HIGH | Based on direct inspection of live v1.0 codebase; insertion point and singleton patterns are unambiguous |
| Pitfalls | HIGH | WASM mechanics from official docs + confirmed GitHub issue threads; false-positive risk from training data facts + domain-shift research; wasmPaths sub-path pattern confirmed |

**Overall confidence:** HIGH for the implementation path; MEDIUM for whether shipping the spam ML classifier is the correct product decision.

### Gaps to Address

- **Spam threshold calibration:** The 0.90 threshold is the research recommendation but has not been validated against real Nostr long-form articles. Validate by logging scores to dev console against live relays before shipping. If scores show false positives above 0.90 on legitimate articles, raise threshold further or skip spam ML entirely.

- **`wasmPaths` CDN version pin:** Cannot be determined until `npm install @huggingface/transformers` runs. Derive from `node_modules/onnxruntime-web/package.json` at implementation time.

- **Vite worker import syntax:** `?worker` suffix (PITFALLS.md recommendation) vs `new URL()` pattern (ARCHITECTURE.md examples). Use `?worker` — it provides full Vite dependency resolution and chunking for the worker's imports.

## Sources

### Primary (HIGH confidence)
- `/huggingface/transformers.js` (Context7) — pipeline API, Web Worker singleton, env config, WASM backend, `progress_callback`, Cache API
- https://huggingface.co/docs/transformers.js/tutorials/react — official React + Web Worker pattern
- https://huggingface.co/onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX — model card, ONNX variants, file sizes
- https://github.com/orgs/community/discussions/13309 — GitHub Pages COOP/COEP limitation (confirmed unresolved)
- https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html — `numThreads` flag
- https://github.com/wooorm/franc — franc-min documentation, ISO 639-3 codes, short-text limitations
- Real codebase inspection (soveng v1.0) — `App.tsx`, `nostrReducer.ts`, `lib/pool.ts`, `lib/facets.ts`, `hooks/useArticleFetch.ts`
- `/nbd-wtf/nostr-tools` (Context7) — SimplePool API, kind constants

### Secondary (MEDIUM confidence)
- https://github.com/huggingface/transformers.js/issues/1016 — `onnxruntime-web` version mismatch TypeError confirmed
- https://github.com/blakejakopovic/nostr-spam-detection — Nostr spam corpus patterns (13k spam vs 79k ham); dataset acknowledged as potentially biased
- https://arxiv.org/html/2501.04985v1 — domain shift accuracy drop (99% to ~60%) on SMS spam models
- https://vite.dev/guide/features — `?worker` suffix vs `new URL()` bundling behavior
- https://github.com/vitejs/vite/issues/5979 — `new URL()` worker dependency bundling limitation

### Tertiary (LOW-MEDIUM confidence)
- https://stacker.news/items/699837 — relay-level vs client-level spam strategy (community opinion)
- https://www.pkgpulse.com/blog/franc-vs-langdetect-vs-cld3-language-detection-javascript-2026 — bundle size comparisons, confidence score thresholds

---
*Research completed: 2026-06-07*
*Ready for roadmap: yes*
