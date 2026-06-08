# Pitfalls Research

**Domain:** In-browser ML content filtering added to a static Nostr long-form reader (Soveng v1.1)
**Researched:** 2026-06-07
**Confidence:** HIGH for WASM/worker mechanics (official docs + verified issue threads); HIGH for false-positive domain risk (training data facts confirmed); MEDIUM for GitHub Pages CDN/CSP specifics (community reports, no official HF/GH docs on this exact combination)

---

## Critical Pitfalls

### Pitfall 1: SMS-Trained Spam Model Over-Filters the Crypto/Bitcoin/Nostr Corpus

**What goes wrong:**
The most commonly recommended ONNX spam model for transformers.js (`onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX`, based on `mrm8488/bert-tiny-finetuned-sms-spam-detection`) was trained exclusively on the UCI SMS Spam Collection dataset — 5,570 short text messages, almost entirely English consumer SMS, with zero representation of technical writing, cryptocurrency, Bitcoin, or Nostr-protocol content. Domain-shift research on this exact model class shows accuracy dropping from 99% in-domain to 60% on out-of-domain text. The word "pump," "dump," "zap," "sats," "lightning," "key," "seed," "wallet," "free," and even "click here to verify" (standard Bitcoin wallet onboarding language) are statistically strong SMS spam signals. Nostr long-form articles are 200–2000 words of Bitcoin technical writing — nothing like 160-character consumer SMS. Running this model at default threshold (≥50% spam score = hide) will silently filter a significant fraction of legitimate articles on the first day.

**Why it happens:**
The model is the only small ONNX spam classifier with a pre-built HF ONNX variant that runs in transformers.js out of the box. It appears in every "browser spam detection" tutorial. Developers test on generic English text and see high accuracy, ship it, then discover domain-specific false positives in production.

**How to avoid:**
1. Set a conservative threshold — start at ≥0.90 spam score before hiding an article, not ≥0.50. The decision boundary at 0.50 is calibrated for SMS; long-form Bitcoin writing will cluster in the 0.55–0.80 range when triggering false positives.
2. Add a minimum-length bypass: articles under 100 words should not be classified at all — pass them through as not-spam. Short articles are where domain shift is worst because the model has almost no context to override the vocabulary signal.
3. Make the threshold a constant (e.g. `SPAM_THRESHOLD = 0.90`) defined in one place and documented with a comment explaining the domain-shift rationale. It will need tuning.
4. Log classification scores to browser console in development builds so you can inspect the score distribution against real Nostr content before shipping.
5. Consider whether a toxicity or hate-speech model would be more appropriate than a spam model — or skip ML spam classification entirely and rely on the language detection pass plus a denylist of obvious spam pubkeys.

**Warning signs:**
- During manual testing, legitimate Bitcoin/Lightning articles disappear from the list.
- The console shows spam scores of 0.60–0.85 for articles with titles like "Running your own Lightning node."
- After deploying, the article list becomes shorter than the unfiltered relay output without obvious spam present.

**Phase to address:**
Phase 1 (classifier integration). Must be resolved before any real-relay testing. The threshold constant and minimum-length bypass must be part of the initial implementation, not a post-ship tuning pass.

---

### Pitfall 2: wasmPaths Broken on the /soveng/ GitHub Pages Sub-Path

**What goes wrong:**
ONNX Runtime Web (used internally by transformers.js) must load `.wasm` binary files at runtime. By default, transformers.js resolves these relative to the origin root (`/`). The Soveng app is served at `https://gsovereignty.github.io/soveng/`, not at root. When the worker calls `pipeline(...)` without explicit `wasmPaths` configuration, the ONNX runtime tries to fetch `https://gsovereignty.github.io/ort-wasm-simd.wasm` (root-relative), gets a 404, and the pipeline fails with an opaque WASM instantiation error that does not mention the path mismatch.

**Why it happens:**
Most transformers.js tutorials and examples assume deployment at origin root. The `env.backends.onnx.wasm.wasmPaths` setting is documented but not prominent, and the error message when WASM loads the wrong path does not say "wrong path" — it says something like "failed to load WASM module" or gives a WebAssembly compile error, which developers diagnose as a version mismatch or COOP/COEP issue first.

**How to avoid:**
Set `wasmPaths` explicitly in the worker before initializing the pipeline:

```typescript
import { env } from "@huggingface/transformers";

// Use import.meta.url within the worker to derive the correct base
// The ONNX WASM files must be copied into the Vite public/ directory or
// pointed at a stable CDN URL that does not have cross-origin restrictions.
env.backends.onnx.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@<locked-version>/dist/";
```

Alternatively, copy the ONNX Runtime WASM binaries into `public/` and set `wasmPaths` to `import.meta.env.BASE_URL + "ort-wasm/"` — but this requires keeping the copied files in sync with the `onnxruntime-web` version that transformers.js bundles internally (see Pitfall 3).

Lock to the CDN URL at a specific pinned version. Using a CDN URL avoids the sub-path problem entirely and works for a static site with no server configuration.

**Warning signs:**
- `WebAssembly.instantiateStreaming` or `fetch` fails for a `.wasm` URL at the origin root rather than at `/soveng/`.
- Browser network tab shows 404 for `ort-wasm-simd.wasm` or similar at `https://gsovereignty.github.io/*.wasm`.
- Works on `localhost:5173` (served from `/`), breaks only on the deployed GitHub Pages URL.

**Phase to address:**
Phase 1 (worker + ONNX runtime setup). Must be explicitly verified in the GitHub Pages deployment smoke test, not just localhost. Add a CI step or manual checklist that loads the deployed URL and confirms no 404s in the network tab for `.wasm` files.

---

### Pitfall 3: onnxruntime-web Version Mismatch Causes Silent Runtime Failure

**What goes wrong:**
transformers.js v3.x bundles or expects a specific version of `onnxruntime-web`. If you manually install `onnxruntime-web` (to copy WASM files or configure `wasmPaths`), or if you pin the CDN URL to a different version, the ONNX runtime can fail with cryptic errors like `"yn[s] is not a function"` or `"Uncaught TypeError: ... is not a function"` in the WASM module. This was confirmed in transformers.js issue #1016: specifying a custom `wasmPaths` pointing to `onnxruntime-web@1.20.0` while transformers.js 3.0.2 bundles a different version caused exactly this failure. The default (unset) `wasmPaths` worked; the custom CDN URL broke it.

**Why it happens:**
The ONNX Runtime WASM binary and the JS glue code are tightly version-coupled. The JS glue in transformers.js was compiled against a specific WASM ABI. Pointing to a different WASM binary — even a patch version away — can break the function table.

**How to avoid:**
1. Do not independently install `onnxruntime-web`. Let transformers.js manage it as a transitive dependency.
2. If you need to set `wasmPaths` to a CDN URL, first inspect `node_modules/onnxruntime-web/package.json` to find the exact version transformers.js pulled in, then pin the CDN URL to that exact version: `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/`.
3. When upgrading transformers.js, re-check the `onnxruntime-web` transitive version and update the pinned CDN URL.
4. Add the `onnxruntime-web` version check as a line in `package.json` scripts: `"check:ort-version": "node -e \"console.log(require('onnxruntime-web/package.json').version)\""` so the pinned CDN version is verifiable in CI.

**Warning signs:**
- `yn[s] is not a function` or similar `TypeError` thrown from within a `.wasm` module.
- Works with no `wasmPaths` set; breaks when `wasmPaths` is set to a CDN URL.
- `onnxruntime-web` was recently upgraded (via `npm update` or lockfile regeneration).

**Phase to address:**
Phase 1 (worker setup). Lock the CDN URL to the exact pinned version before any testing. Document the pinned version with a code comment referencing this pitfall.

---

### Pitfall 4: Language Detection Mis-Flags Short Titles, Code-Heavy Text, and Mixed-Language Articles as Non-English

**What goes wrong:**
`franc-min` uses trigram frequency analysis calibrated for natural language. Three failure modes specific to Nostr long-form articles:

1. **Article title only**: If classification runs against the article's `title` tag (short, 3–15 words) rather than the article body, `franc` returns `"und"` (undetermined) for inputs under ~80 characters — which is treated as "unknown language" and, if configured to fail-closed, hides the article.
2. **Code-heavy bodies**: Articles about Bitcoin programming, Nostr protocol implementation, or Lightning Network routing contain multi-line code blocks, hex strings, hex pubkeys, JSON, and base64. These look nothing like natural language trigrams. An article that is 40% code and 60% English prose can register as `"und"` or an incorrect language.
3. **Mixed-language content**: An English article with a Spanish or Portuguese introduction paragraph (common in Bitcoin global community) can score higher for the non-English language if the first 200 characters are scraped for detection.

The system is configured fail-open on error (classification error → show article), but `franc` does not throw errors for short or ambiguous input — it returns `"und"`. If the application logic treats `"und"` as non-English and hides the article, this is a silent filter failure that looks like working filtering.

**Why it happens:**
Developers test language detection with clean English sentences of 50+ words. Nostr article titles are 5–10 words. Nostr articles about Bitcoin development are dense with code. The `minLength` default of 10 characters is too short for reliable detection — it will attempt detection on very short inputs and return low-confidence results rather than `"und"`.

**How to avoid:**
1. Always classify against the **article body**, not the title. Strip code blocks (triple-backtick content) before passing to `franc`. Remove URLs and hex strings.
2. Set a minimum body character threshold: if the body text (after stripping code) is under 200 characters, treat language as `"und"` (undetermined) and **pass through as English** (fail-open).
3. Treat `"und"` as English (show the article), not as non-English (hide it). Only hide when `franc` returns a non-English language code with high confidence.
4. Use `francAll()` and check the confidence score of the top result. If the top language score is below 0.7, treat as undetermined and show the article.
5. Strip common code indicators before language detection: lines starting with `    ` (4-space indent), triple-backtick blocks, lines containing only hex characters (64-char pubkeys are pervasive in Nostr content).

**Warning signs:**
- Articles by known English-language Nostr authors disappear from the filtered list.
- Inspection shows `franc` returning `"und"` or a non-English code for articles with significant code content.
- Articles with short titles (e.g. "LN Routing") get filtered even when the body is clearly English.

**Phase to address:**
Phase 1 (language detection integration). The text preprocessing function (strip code → measure length → run franc → evaluate confidence) must be unit-tested with representative Nostr content: a title-only string, a code-heavy body, a mixed-language opening, and a long clean English body.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use default spam threshold (0.50) | No threshold tuning work | Silently filters 20–40% of legitimate Bitcoin/Nostr articles | Never — domain shift is verified |
| Skip minimum-length bypass for spam classifier | Simpler code | Short technical articles falsely classified as spam at high rate | Never |
| Set `wasmPaths` to latest CDN URL (unversioned, e.g. `@latest`) | No need to track ORT version | Breaks when CDN content updates, version mismatch causes cryptic failures | Never for WASM paths |
| Classify on article title only | Faster (less text to process) | High false-negative rate for language detection on short titles | Never |
| Treat `"und"` franc result as non-English | Simpler filter logic | Silently hides code-heavy articles and short-title articles | Never |
| Inline the pipeline call in a React component (no worker) | Easier to wire up | Blocks main thread, causes 2–10 second UI freeze during model load and inference | Acceptable only in a throwaway prototype |
| Skip `dispose()` on pipeline in worker | No cleanup code needed | GPU/WASM memory leak; observable after 30+ tab-open cycles or repeated SPA navigations | Acceptable only if the worker lives for the full page lifetime (single-page SPA with no re-mount) — document this explicitly |
| Initialize pipeline inside `useEffect` without module-level guard | Simpler code | React StrictMode double-mounts cause two concurrent pipeline initializations, race to a shared singleton, or double model download | Never — use module-level singleton ref |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vite + transformers.js | Not adding `@huggingface/transformers` to `optimizeDeps.exclude` | Add to `optimizeDeps.exclude` in `vite.config.ts`; also add `assetsInclude: ['**/*.onnx']`. Without this, Vite's esbuild pre-bundler tries to parse WASM imports and fails with a cryptic error. |
| Vite + Web Worker | Using `new URL('./classifier.worker.ts', import.meta.url)` without `{ type: 'module' }` | Use `new Worker(new URL('./classifier.worker.ts', import.meta.url), { type: 'module' })`. Without `type: 'module'`, the worker cannot use ES module imports, and the transformers.js import inside the worker will fail. |
| Vite + Web Worker dependency bundling | Using `new URL()` pattern and expecting dependencies to be bundled | `new URL()`-spawned workers ship source as-is with no dependency bundling. Use Vite's `?worker` import syntax (`import ClassifierWorker from './classifier.worker?worker'`) to get full dependency resolution and chunking. |
| transformers.js + GitHub Pages sub-path | Not setting `env.backends.onnx.wasm.wasmPaths` | Must point to a CDN URL pinned to the exact `onnxruntime-web` version that transformers.js installs as a transitive dependency. |
| transformers.js + numThreads | Expecting multi-threaded WASM on GitHub Pages | GitHub Pages cannot set `COOP: same-origin` / `COEP: require-corp` headers, so `SharedArrayBuffer` is unavailable. ONNX Runtime Web falls back to single-threaded WASM automatically, but this must be set explicitly to suppress the "SharedArrayBuffer not available" warning and avoid the runtime attempting threaded mode: `env.backends.onnx.wasm.numThreads = 1`. |
| Hugging Face CDN + GitHub Pages | No CSP consideration | GitHub Pages does not set `connect-src` restrictions by default, but if you add a `<meta http-equiv="Content-Security-Policy">` tag (for XSS hardening), you must explicitly allow `https://huggingface.co`, `https://cdn-lfs.huggingface.co`, and `https://cdn-lfs-us-1.huggingface.co` in `connect-src`. |
| franc-min + transformers.js worker | Running franc inside the Web Worker | franc is synchronous and fast (< 1ms for 500 words). Run it on the main thread after receiving the article list, not inside the inference worker. This keeps language detection from adding latency to the worker message queue and simplifies the architecture. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-running inference on every React render | CPU spike every time the component re-renders (hashtag filter toggle, etc.); `performance.now()` shows 200–800ms per article batch | Cache classification results by `event.id` in a `Map` stored in a `useRef` (or module-level state); only classify new event IDs that aren't in the cache | From article 1 — inference is expensive every time |
| Classifying all articles on each relay event (streaming) | Worker is bombarded with messages during relay streaming phase; messages queue up | Gate classification: collect articles until EOSE, then classify the batch once | Immediately if relay streaming overlaps with classification |
| Blocking main thread with pipeline call | UI freezes 2–10 seconds during model load; users see unresponsive scroll and interaction | All `pipeline()` and `pipe(text)` calls must be in a Web Worker. Main thread only sends messages and receives results. | From first page load |
| Large postMessage payload | Transferring full article bodies (potentially 10–50KB per article × 21 articles) across the worker boundary causes GC pressure | Send only the necessary text for classification (title + first 500 chars of body is sufficient for spam/lang detection); do not send full Markdown body | Visible at ~20+ articles with long bodies |
| First-visit 4.5MB model download blocking classification | Articles render immediately but "show all" because filtering waits; then articles disappear as classifier loads; layout shift | Show a subtle "Filtering..." indicator during model download; use the browser Cache API / IndexedDB for second-visit persistence; consider showing unfiltered list with a "ML filter loading" badge | On every first visit with cold cache — this is the default experience |
| No model download progress feedback | Users see a spinner for 10–30 seconds on slow connections with no indication of why | Emit progress events from the worker (`onprogress` in transformers.js pipeline) and show a download progress bar or percentage in the UI | On slow connections / first visit |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using `rehype-raw` alongside ML-classified content | Even "not spam" articles may contain malicious HTML in their Markdown bodies — ML classification does not replace XSS sanitization | The existing `rehype-sanitize` pipeline must remain unchanged. ML filtering is an additional layer on top of, not instead of, sanitization. |
| Logging article content in worker console during development | Article bodies may contain private keys embedded in tutorial content; console logs persist in browser memory | Limit worker debug logging to scores and event IDs only, not full text content |
| Trusting ML output as a security control | A motivated adversary can craft content that scores below the spam threshold | ML filtering is a UX quality feature, not a security boundary. It does not replace the sanitization pipeline. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Articles disappearing from list after initial render | Jarring layout shift; users reading an article title see it vanish | Classify articles before rendering them to the list (classify during the existing EOSE wait), OR use a CSS `min-height` reservation on the list to prevent reflow; at minimum, animate removal |
| No way to see filtered articles | User cannot verify the filter is working correctly or recover from a false positive | Add a "Show filtered" toggle or a count badge ("3 articles hidden") that lets users inspect and override the filter |
| Filtering ON by default with no user consent or awareness | Users do not know ML classification is running; may file bug reports for "missing" articles | Show a subtle status line: "ML filter active — 3 hidden" with a toggle. The filter-on-by-default requirement is correct but must be visible. |
| Filter toggle resets on page reload | Users who disable the filter must re-disable it every visit | Persist filter state to `localStorage`. Key: `soveng:ml-filter-enabled`. |
| No classification error surfacing | When the model fails to load (CDN down, WASM error), articles are shown unfiltered (correct fail-open behavior) but the user sees no indication | Show a non-blocking toast or status indicator: "Content filter unavailable" so users understand the filter is not active |

---

## "Looks Done But Isn't" Checklist

- [ ] **WASM path configuration:** Smoke-test on `https://gsovereignty.github.io/soveng/` (not localhost) — verify no 404s for `.wasm` files in the browser network tab.
- [ ] **numThreads=1:** Verify no `SharedArrayBuffer` warning in console on GitHub Pages deploy (COOP/COEP headers are absent).
- [ ] **ORT version pin:** Confirm the CDN URL version in `wasmPaths` matches the exact `onnxruntime-web` version in `node_modules/onnxruntime-web/package.json`.
- [ ] **Spam threshold documented:** `SPAM_THRESHOLD` constant exists, is set to ≥0.90, and has a comment explaining the domain-shift rationale.
- [ ] **Minimum-length bypass:** Articles under 100 words bypass spam classification (pass-through as not-spam).
- [ ] **franc treats `"und"` as English:** Confirm the code path for `franc` returning `"und"` shows the article, not hides it.
- [ ] **Code-stripped language detection:** Preprocessing strips triple-backtick code blocks before passing text to franc.
- [ ] **Worker StrictMode safety:** Worker is instantiated at module level (not inside `useEffect`) or behind a `useRef` guard so React's dev-mode double-mount does not create two workers.
- [ ] **Worker termination on unmount:** If the worker is owned by a component (rather than module-level), the `useEffect` cleanup calls `worker.terminate()`.
- [ ] **Result cache by event.id:** Classification results are stored in a `Map<eventId, ClassificationResult>` and re-used on re-renders.
- [ ] **Vite optimizeDeps:** `@huggingface/transformers` and `onnxruntime-web` are in `optimizeDeps.exclude` in `vite.config.ts`.
- [ ] **Worker uses `?worker` import:** The worker file is imported via Vite's `?worker` syntax to ensure dependency bundling, not bare `new URL()`.
- [ ] **Filter state persisted:** `localStorage` key `soveng:ml-filter-enabled` persists the filter toggle across reloads.
- [ ] **Filtered count visible:** A count or indicator of hidden articles is visible in the UI.
- [ ] **Filter unavailable state:** When classification fails (model load error, CDN down), the UI shows a non-blocking "Content filter unavailable" notice.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Over-filtering due to wrong threshold | LOW | Bump `SPAM_THRESHOLD` constant from 0.50 → 0.90, redeploy. No model change needed. |
| WASM path broken on deployed URL | LOW–MEDIUM | Set `wasmPaths` to stable CDN URL, update Vite config, redeploy. Verify on live URL. |
| ORT version mismatch crashes pipeline | MEDIUM | Check `node_modules/onnxruntime-web/package.json` for exact version. Update CDN URL pin. Bump transformers.js if version is too old. |
| franc filtering code-heavy articles | LOW | Add code-block stripping to preprocessing function. Unit test with code-heavy fixture. Redeploy. |
| Main thread blocked (no worker) | HIGH | Refactoring pipeline call into a worker requires architectural change. Do not ship classification on main thread — this cannot be shimmed later. |
| Worker double-instantiation under StrictMode | MEDIUM | Refactor to module-level singleton ref. Requires changing how worker is created and referenced in components. |
| Model download not cached between sessions | LOW | transformers.js already caches via browser Cache API automatically. If not working, verify the origin is served over HTTPS (required for Cache API). GitHub Pages is HTTPS. |
| CDN down at HF, model cannot load | LOW (UX) | fail-open means articles are shown unfiltered. Show "filter unavailable" notice. No code change needed if fail-open is implemented correctly. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SMS model over-filters crypto corpus (threshold, min-length) | Phase 1: Classifier integration | Manual test: run against 20 real Nostr articles from default relays, inspect spam scores in console, verify no false positives above threshold |
| wasmPaths broken on /soveng/ sub-path | Phase 1: Worker + ONNX setup | Deployed URL smoke test: network tab shows no `.wasm` 404s |
| onnxruntime-web version mismatch | Phase 1: Worker + ONNX setup | `npm ls onnxruntime-web` output matches CDN URL version pin |
| franc mis-flags short/code-heavy text | Phase 1: Language detection | Unit tests: title-only string → pass-through; code-heavy body → pass-through; clean English body → detected; mixed-lang body → evaluated against confidence threshold |
| React StrictMode double worker instantiation | Phase 1: Worker lifecycle | Run dev build with StrictMode; verify only one worker is created (worker console.log on init) |
| Re-running inference on re-render | Phase 1: Caching | Verify `Map<eventId, result>` cache is populated after first classification pass; toggle hashtag filter and confirm no new worker messages are sent for already-classified articles |
| Layout shift as articles disappear | Phase 2: UX polish | Visual regression: load app, observe article list before and after classification completes; articles should either pre-filter or animate out |
| No filter status visibility | Phase 2: UX polish | Verify filtered count badge and filter toggle are visible in the deployed UI |
| Missing optimizeDeps.exclude | Phase 1: Vite config | `npm run dev` shows no "failed to pre-bundle" warnings; dev server starts cleanly |
| CDN fetch blocked by CSP | Phase 1: Vite config | If a CSP meta tag is present in index.html, verify `connect-src` includes HF CDN domains |
| numThreads not set to 1 | Phase 1: Worker setup | Browser console on GitHub Pages deploy shows no `SharedArrayBuffer` warning |

---

## Sources

- [transformers.js GitHub](https://github.com/huggingface/transformers.js) — WASM configuration, pipeline API, env.backends
- [transformers.js issue #1016: 3.0.2 not compatible with onnxruntime-web 1.20.0](https://github.com/huggingface/transformers.js/issues/1016) — version mismatch confirmed
- [transformers.js issue #860: Severe memory leak under WebGPU Whisper](https://github.com/huggingface/transformers.js/issues/860) — tensor dispose requirement
- [transformers.js dtypes guide](https://huggingface.co/docs/transformers.js/en/guides/dtypes) — quantization tradeoffs
- [mrm8488/bert-tiny-finetuned-sms-spam-detection (HF)](https://huggingface.co/mrm8488/bert-tiny-finetuned-sms-spam-detection) — UCI SMS training data, 5,570 samples
- [onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX (HF)](https://huggingface.co/onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX) — ONNX variant for transformers.js
- [Domain shift in SMS spam detection (arxiv 2501.04985)](https://arxiv.org/html/2501.04985v1) — accuracy drop from 99% → 60% under domain shift
- [franc GitHub](https://github.com/wooorm/franc) — minimum length, short text limitations
- [Vite issue #5979: worker code not bundled with new URL() pattern](https://github.com/vitejs/vite/issues/5979) — ?worker vs new URL() bundling behavior
- [Vite features: Web Workers](https://vite.dev/guide/features) — ?worker suffix, type:module requirement
- [Vite static asset handling](https://vite.dev/guide/assets) — new URL() + import.meta.url behavior
- [React StrictMode double-mount (dev.to)](https://dev.to/pockit_tools/why-is-useeffect-running-twice-the-complete-guide-to-react-19-strict-mode-and-effect-cleanup-1n60) — useEffect runs twice in dev
- [COOP/COEP and SharedArrayBuffer requirements](https://maddevs.io/writeups/running-ai-models-locally-in-the-browser/) — GitHub Pages cannot set these headers
- [GitHub community: CSP on GitHub Pages](https://github.com/orgs/community/discussions/49832) — no custom HTTP headers available

---
*Pitfalls research for: in-browser ML content filtering, static React/Vite GitHub Pages app (Soveng v1.1)*
*Researched: 2026-06-07*
