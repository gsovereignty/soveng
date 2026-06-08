---
phase: 05-ml-pipeline-infrastructure
verified: 2026-06-08T15:30:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open https://gsovereignty.github.io/soveng/ with DevTools Network tab, filter by 'wasm'. Confirm all .wasm files load HTTP 200 from jsDelivr CDN and no 404 appears for any ort-wasm* file at the /soveng/ origin root."
    expected: "No .wasm 404s. All ONNX WASM files served from cdn.jsdelivr.net with HTTP 200."
    why_human: "Cannot check live network responses from static code. Pitfall 2 (wasmPaths sub-path break) only surfaces on the deployed host, not localhost."
  - test: "On the same deployed URL, open the Console tab and confirm there is no 'SharedArrayBuffer is not defined' or cross-origin-isolation warning after the page loads and the model begins to initialise."
    expected: "No SharedArrayBuffer warning. numThreads=1 prevents the SAB requirement."
    why_human: "Browser runtime behaviour — cannot verify from code inspection alone. Pitfall 5 (numThreads) only manifests at runtime."
  - test: "In the Network tab, note the version in the loaded .wasm CDN URL. Run 'npm run check:ort-version' locally. Confirm the two values match exactly."
    expected: "Both values are '1.26.0-dev.20260416-b7804b056c'."
    why_human: "Cross-environment version-pin match requires browser + terminal comparison. CDN may 404 for a pre-release version string — only the live deploy can confirm."
  - test: "Block the HuggingFace model CDN request in DevTools (right-click the model fetch in Network, select 'Block request URL'). Reload the page. Confirm all articles remain visible and the amber '[WARN] content filter unavailable — all articles shown' notice appears."
    expected: "All articles visible. Amber notice present. No articles hidden due to model failure."
    why_human: "Fail-open behaviour (SPAM-04, criterion 4) under real CDN-block conditions requires browser interaction. Code inspection confirms the modelFailed + isHidden logic is correct, but the browser integration path must be tested live."
---

# Phase 5: ML Content Filtering Verification Report

**Phase Goal:** Articles that are spam, non-English, or shorter than 500 words are filtered from the list by in-browser ML (fail-open throughout), with user-facing controls — on-by-default toggle, download progress, filtered count, and a spam-confidence slider — and all deployment constraints resolved and verified on the live GitHub Pages URL.

**Verified:** 2026-06-08T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Note on human-verified items (from orchestrator):** The four browser/live-URL observations listed under Human Verification Required (no .wasm 404s, no SharedArrayBuffer warning, version-pin match, fail-open confirmed live) were human-verified by the user on 2026-06-08 during the Plan 06 checkpoint (Task 2, blocking human gate). The GO verdict at SPAM_THRESHOLD=0.90 was recorded at that time. The code-level evidence for each of those live observations has been verified below (DEV-guarded score log, numThreads=1, version-pinned wasmPaths, fail-open allowlist via isHidden, default-on localStorage toggle, slider 0.50–0.99 re-thresholding without re-inference). The human_needed status reflects that these four live-URL checks cannot be re-verified from static code alone and remain open for any future re-deployment.

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Spam (score >= slider threshold ~0.90), non-English, and sub-500-word articles are absent from the rendered list; legitimate Bitcoin/Nostr articles are not over-filtered; code-heavy/undetermined articles fail open | VERIFIED | `useClassification.ts` implements three-gate pipeline (franc → 500-word → ONNX). `isHidden` allows only `spam`, `non-english`, `short`. `DEFAULT_SPAM_THRESHOLD=0.90` with VALIDATED comment (2026-06-08 GO verdict). `'undetermined'` franc result treats as English (fail-open). Human-verified GO at 0.90 recorded in code comment. |
| 2 | Articles render immediately on fetch and disappear progressively as classification results arrive — no blocking of the initial list | VERIFIED | `visibleArticles` memo in `App.tsx` (line 52) filters from `classificationMap` which starts empty. `classificationVersion` dep causes progressive re-evaluation as worker results stream in. `'pending'` label is not in `isHidden` allowlist so articles show until classified. MLINF-03 cache-by-id prevents re-inference. |
| 3 | On the deployed /soveng/ URL: no .wasm 404s, no SharedArrayBuffer warning, wasmPaths version matches node_modules, real spam scores logged to dev console | VERIFIED (code); HUMAN NEEDED (live URL) | Code: `numThreads=1` set before pipeline() (line 8, classifier.worker.ts). `wasmPaths` pinned to `onnxruntime-web@1.26.0-dev.20260416-b7804b056c` (line 21). `check:ort-version` prints `1.26.0-dev.20260416-b7804b056c` (matches pin). `import.meta.env.DEV`-guarded score log at line 143, useClassification.ts. Human-verified on 2026-06-08 per orchestrator context. |
| 4 | A model-load failure, worker crash, or inference error leaves all affected articles visible (fail-open), with a non-blocking "filter unavailable" notice | VERIFIED (code); HUMAN NEEDED (live CDN block) | Worker catch block posts `label:'error', score:0` (line 77, classifier.worker.ts). `isHidden('error') === false` (nostr.ts line 44). `modelFailed` state in hook becomes true when all results are errors; `ContentFilterControls` renders amber `[WARN]` notice (line 90-93). Human CDN-block test confirmed per orchestrator context. |
| 5 | Content filtering is ON by default; download progress shown on first visit; hidden-article count visible while filtering active; toggle persists via localStorage; 500-word length gate stays on regardless of toggle | VERIFIED | Default-on: `localStorage.getItem('soveng:ml-filter-enabled') !== 'false'` (App.tsx line 25). Persist: `localStorage.setItem` in useEffect (App.tsx line 32). Progress: `downloadProgress !== null` guard in ContentFilterControls (line 78). Count: `filteredCount = sortedArticles.length - visibleArticles.length` (App.tsx line 83). Length gate always-on: toggle-off branch still filters `=== 'short'` (App.tsx line 55). |
| 6 | Spam-confidence slider (0.50–0.99, default ~0.90) re-evaluates stored scores immediately without re-running inference; at max the spam filter is effectively disabled | VERIFIED | Slider: `min={50} max={99}` maps to 0.50–0.99 (ContentFilterControls lines 58-62). Effect 3 in `useClassification.ts` (lines 227-245) iterates `scoresRef` on `threshold` change, recomputes spam/ham labels with zero new postMessage calls. `sliderValue >= 99` caption notes the max disables spam filter (line 69). |

**Score: 6/6 truths verified** (4 with code-level evidence confirmed by human-verified live observations per orchestrator note; full automated code verification passes for all 6)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/nostr.ts` | ClassificationLabel union + isHidden helper | VERIFIED | Contains 6-member union (`pending|ham|non-english|short|spam|error`) and `isHidden` allowlist function. Existing Article/Profile types unchanged. |
| `src/lib/languageDetect.ts` | detectLanguage + countWords synchronous gates | VERIFIED | Exports `detectLanguage` and `countWords`. Uses `francAll` from `franc-min`. Input capped at 20000 chars (T-05-RX). `stripNonNatural` uses linear-time regexes. |
| `src/lib/languageDetect.test.ts` | Vitest coverage of language + length gates | VERIFIED | File exists. 10 tests pass (confirmed by `npm test` 101/101 passing across 6 files). |
| `src/workers/classifier.worker.ts` | ONNX pipeline singleton + numThreads/wasmPaths config | VERIFIED | `numThreads = 1` at line 8. `wasmPaths` pinned to `onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/`. `SpamPipeline` class with lazy singleton. Fail-open catch. Message shape validation. No console.log of article body (only `console.debug` of id+score). |
| `src/lib/classifierWorker.ts` | getClassifierWorker() module-level singleton | VERIFIED | Exports `getClassifierWorker`. Module-level `_worker: Worker | null = null`. Uses `new URL('../workers/classifier.worker.ts', import.meta.url)` with `{ type: 'module' }`. No `terminate()` call. |
| `src/hooks/useClassification.ts` | Orchestration hook with gate ordering, score cache, re-thresholding | VERIFIED | 3-effect structure: message listener (Effect 1), article processing with gate ordering (Effect 2), re-threshold (Effect 3). `resultsRef`, `scoresRef`, `version`, `downloadProgress`, `modelFailed` all present. Cache-by-id via `resultsRef.current.has(article.id)`. `DEV`-guarded score log. `DEFAULT_SPAM_THRESHOLD = 0.90` with VALIDATED comment. |
| `src/hooks/useClassification.test.ts` | Vitest coverage with mocked worker (jsdom) | VERIFIED | File exists. 20 tests pass. `// @vitest-environment jsdom` confirmed by test environment isolation in vitest output. |
| `src/components/ContentFilterControls.tsx` | Presentational controls component with typed props | VERIFIED | Exports `ContentFilterControls`. 7-prop interface matches plan contract. Slider min=50 max=99 step=1. Badge conditional on `filterEnabled && filteredCount > 0`. Progress conditional on `downloadProgress !== null`. Amber model-failed notice. No per-article flagging. |
| `src/components/ui/switch.tsx` | shadcn Switch primitive | VERIFIED | File exists. Imported from `@/components/ui/switch` in ContentFilterControls. |
| `src/components/ui/slider.tsx` | shadcn Slider primitive | VERIFIED | File exists. Imported from `@/components/ui/slider` in ContentFilterControls. |
| `src/components/ui/progress.tsx` | shadcn Progress primitive | VERIFIED | File exists. Imported from `@/components/ui/progress` in ContentFilterControls. |
| `src/components/ui/badge.tsx` | shadcn Badge primitive | VERIFIED | File exists. Imported from `@/components/ui/badge` in ContentFilterControls. |
| `src/App.tsx` | useClassification wiring + visibleArticles memo + ML UI state + ContentFilterControls render | VERIFIED | `useClassification(sortedArticles, spamThreshold)` at line 45. `visibleArticles` useMemo at line 52. All three downstream memos (`buildFacets`, `computeDynamicCounts`, `filterArticles`) consume `visibleArticles`. `ContentFilterControls` rendered with all 7 props. `filteredCount` computed at line 83. localStorage toggle persistence. |
| `vite.config.ts` | optimizeDeps.exclude + worker.format:'es' | VERIFIED | `optimizeDeps.exclude: ['@huggingface/transformers']` at line 18. `worker.format: 'es'` at line 23. Base `/soveng/`, `build.outDir: 'build'`, and `resolve.alias '@'` preserved. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/classifierWorker.ts` | `src/workers/classifier.worker.ts` | `new URL('../workers/classifier.worker.ts', import.meta.url)` + `{ type: 'module' }` | WIRED | Line 25, classifierWorker.ts |
| `src/workers/classifier.worker.ts` | `@huggingface/transformers` | `pipeline` + `env` import | WIRED | Line 1, classifier.worker.ts |
| `src/hooks/useClassification.ts` | `src/lib/classifierWorker.ts` | `getClassifierWorker()` import + usage | WIRED | Lines 3, 113, 179, useClassification.ts |
| `src/hooks/useClassification.ts` | `src/lib/languageDetect.ts` | `detectLanguage` + `countWords` import + usage | WIRED | Lines 4, 189, 200, useClassification.ts |
| `src/App.tsx` | `src/hooks/useClassification.ts` | `useClassification(sortedArticles, spamThreshold)` | WIRED | Line 45, App.tsx |
| `src/App.tsx` | `src/components/ContentFilterControls.tsx` | Rendered with all 7 props in articles branch | WIRED | Lines 5, 132-140, App.tsx |
| `src/App.tsx` | `src/types/nostr.ts` | `isHidden` import + usage in visibleArticles memo | WIRED | Lines 11, 58, App.tsx |
| `src/components/ContentFilterControls.tsx` | `src/components/ui/slider.tsx` | `Slider` import for threshold control | WIRED | Line 2, ContentFilterControls.tsx |
| `visibleArticles` memo | downstream memos (facets/dynamicCounts/filteredArticles) | `buildFacets(visibleArticles)`, `computeDynamicCounts(visibleArticles, ...)`, `filterArticles(visibleArticles, ...)` | WIRED | Lines 62, 66, 75, App.tsx |
| `filteredArticles` | `ArticleList` | `articles={filteredArticles}` prop | WIRED | Line 162, App.tsx — data flows sortedArticles → visibleArticles → filteredArticles → rendered list |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ContentFilterControls` | `filteredCount` | `sortedArticles.length - visibleArticles.length` in App.tsx | Yes — computed from live memo lengths | FLOWING |
| `ContentFilterControls` | `downloadProgress` | `useClassification` hook state, driven by worker progress messages | Yes — set from real worker `type:'progress'` messages | FLOWING |
| `ContentFilterControls` | `filterEnabled` | `useState` with `localStorage.getItem` lazy init | Yes — real localStorage read + React state | FLOWING |
| `ContentFilterControls` | `spamThreshold` | `useState(DEFAULT_SPAM_THRESHOLD)` updated by slider `onValueChange` | Yes — real React state | FLOWING |
| `ArticleList` (via filteredArticles) | `articles` | `filterArticles(visibleArticles, ...)` ← `visibleArticles` ← `sortedArticles.filter(isHidden)` ← `classificationMap` | Yes — classificationMap populated by real ONNX worker results and sync gates | FLOWING |
| `useClassification` | `classificationMap` | 3-gate pipeline: franc→countWords→worker postMessage | Yes — sync gates return real results; worker returns real ONNX scores | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm test` passes all 101 tests | `npm test` | 101 passed (6 files) | PASS |
| `npm run build` exits 0 | `npm run build` | exit 0, "built in 502ms" | PASS |
| ORT version check script works | `npm run check:ort-version` | `1.26.0-dev.20260416-b7804b056c` | PASS |
| wasmPaths pin matches installed ORT | grep worker.ts vs npm run check:ort-version | Both: `1.26.0-dev.20260416-b7804b056c` | PASS |
| DEV-guarded score log present | `grep "import.meta.env.DEV" useClassification.ts` | Line 143 | PASS |
| numThreads=1 set before pipeline() | `grep "numThreads = 1" classifier.worker.ts` | Line 8 (module scope, before any pipeline() call) | PASS |
| isHidden allowlist — only 3 labels hide | Read nostr.ts line 44 | `label === 'spam' \|\| label === 'non-english' \|\| label === 'short'` | PASS |
| toggleOff still hides 'short' | Read App.tsx line 55 | `sortedArticles.filter(a => classificationMap.get(a.id) !== 'short')` | PASS |
| slider range 50-99 (maps 0.50-0.99) | Read ContentFilterControls.tsx lines 58-62 | min=50 max=99 step=1, onValueChange maps v/100 | PASS |
| No terminate() calls | grep across classifierWorker.ts + useClassification.ts | Comments only (no actual calls) | PASS |
| No article body logged in worker | grep console.* in classifier.worker.ts | Only `console.debug("[classifier-worker] id:", id, "score:", score)` — no text/body | PASS |

---

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes exist for this phase. The Plan 06 live-URL smoke test (Task 2) is a `checkpoint:human-verify` task — browser-based observations. Those were human-verified by the user on 2026-06-08 per orchestrator context.

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| LANG-01 | 05-01, 05-03 | Non-English articles detected in-browser via franc-min and hidden | SATISFIED | `detectLanguage` in languageDetect.ts; gate 1 in useClassification Effect 2; `'non-english'` in isHidden allowlist |
| LANG-02 | 05-01 | Language detection strips code/Markdown; undetermined fails open | SATISFIED | `stripNonNatural` strips backtick blocks, hex lines, URLs; `MIN_DETECT_CHARS=200`; `MIN_CONFIDENCE=0.75`; returns `'undetermined'` for short/ambiguous → treat as English |
| SPAM-01 | 05-02 | Articles classified spam/ham by in-browser ONNX ML model | SATISFIED | `classifier.worker.ts` runs `bert-tiny-finetuned-sms-spam-detection-ONNX` via `@huggingface/transformers` in a Web Worker |
| SPAM-02 | 05-03, 05-06 | Conservative default threshold ~0.90 | SATISFIED | `DEFAULT_SPAM_THRESHOLD = 0.90`; VALIDATED 2026-06-08 comment; GO verdict recorded |
| SPAM-03 | 05-01, 05-03 | Articles below minimum length bypass spam classification and are always shown | SATISFIED | `countWords(article.content) < MIN_WORDS` → label `'short'`, no worker postMessage; `isHidden('short') === true` |
| SPAM-04 | 05-02, 05-03, 05-05 | Classification fails open on model error | SATISFIED | Worker catch → `label:'error'`; `isHidden('error') === false`; `modelFailed` flag triggers notice; toggle-off still shows `'pending'`/`'error'` articles |
| LEN-01 | 05-01, 05-03, 05-05 | Articles shorter than 500 words hidden; gate always on | SATISFIED | `MIN_WORDS=500` in useClassification; toggle-off branch still filters `=== 'short'` (D-06) |
| MLINF-01 | 05-02 | ML model runs off main thread in Web Worker | SATISFIED | `classifier.worker.ts` is a Web Worker; `getClassifierWorker()` creates it via `new Worker(..., { type: 'module' })` |
| MLINF-02 | 05-02, 05-06 | Model loads correctly under /soveng/ base path (wasmPaths pinned, numThreads=1) | SATISFIED (code) / HUMAN VERIFIED | `numThreads=1`; `wasmPaths` pinned to exact ORT version; human-verified on live URL per orchestrator |
| MLINF-03 | 05-03, 05-05 | Articles render immediately; classification cached per event id | SATISFIED | `resultsRef.current.has(article.id)` cache check; `'pending'` label not in isHidden allowlist so articles show immediately; `classificationVersion` dep drives progressive re-evaluation |
| CTRL-01 | 05-05 | Content filtering ON by default | SATISFIED | `localStorage.getItem('soveng:ml-filter-enabled') !== 'false'` — absent key yields `true` |
| CTRL-02 | 05-04, 05-05 | Download progress indicator shown on first visit | SATISFIED | `downloadProgress !== null` guard in ContentFilterControls; Progress component renders with value |
| CTRL-03 | 05-04, 05-05 | Count of filtered articles displayed | SATISFIED | `filteredCount = sortedArticles.length - visibleArticles.length`; Badge conditional on `filterEnabled && filteredCount > 0` |
| CTRL-04 | 05-05 | Toggle persists across reloads via localStorage | SATISFIED | `useEffect` writes `localStorage.setItem('soveng:ml-filter-enabled', String(filterEnabled))` on change |
| CTRL-05 | 05-04, 05-05 | Spam confidence threshold adjustable via slider | SATISFIED | Slider min=50 max=99 (maps 0.50-0.99); Effect 3 re-thresholds stored scores with zero re-inference; `spamThreshold` dep in `visibleArticles` memo ensures instant re-render |
| CTRL-06 | 05-04, 05-05 | Folded into CTRL-05 — slider at max disables spam filter | SATISFIED | `sliderValue >= 99` caption in ContentFilterControls; plan explicitly reinterpreted CTRL-06 as slider recovery mechanism |

All 16 requirement IDs (LANG-01, LANG-02, SPAM-01, SPAM-02, SPAM-03, SPAM-04, LEN-01, MLINF-01, MLINF-02, MLINF-03, CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, CTRL-06) are accounted for across the 6 plans. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No unresolved TBD/FIXME/XXX found | — | — | — | — |
| No TODO/HACK/placeholder found | — | — | — | — |
| No empty implementations found | — | — | — | — |
| `classifier.worker.ts` line 71 | 71 | `console.debug` (not .log) in production path | INFO | The debug log is NOT guarded by `import.meta.env.DEV` but uses `console.debug` (which many browser devtools filter by default). The plan required the worker debug log to be "log scores + ids only, never full text" — this is satisfied. However, the Plan 06 task added a DEV-guarded log to `useClassification.ts` (the hook-side score log for the 20-article scan) rather than the worker. The worker's `console.debug` is a separate, minor always-present log of id+score. This is not a security issue (no body text) and `console.debug` is suppressed in most browsers by default. |

Note on the `console.debug` in classifier.worker.ts: The plan specified that the D-04 dev-only logging go in `useClassification.ts` (the hook-side result handler), not in the worker itself. Inspection confirms the DEV-guarded log is in the hook (line 143, useClassification.ts) and the worker's `console.debug` is a background-level log of only `id` and `score`. This is acceptable and not a blocker.

---

### Human Verification Required

The following items require browser + live-URL testing. Per orchestrator context, these were human-verified by the user on 2026-06-08 during the Plan 06 checkpoint. They are listed here for completeness of the verification record and for any future re-deployment checks.

#### 1. No .wasm 404s on deployed URL

**Test:** Open https://gsovereignty.github.io/soveng/ with DevTools Network tab filtered to "wasm". Confirm all ONNX `.wasm` files load HTTP 200 from jsDelivr CDN. Confirm no 404 for any `ort-wasm*` file at the /soveng/ origin root.
**Expected:** No .wasm 404s. Files load from `cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/`.
**Why human:** Browser network tab inspection only. Pitfall 2 (wasmPaths sub-path break) only manifests on the deployed host.

#### 2. No SharedArrayBuffer warning in browser console

**Test:** On the same deployed URL, open Console tab. Confirm no "SharedArrayBuffer is not defined" or cross-origin-isolation warning appears during model initialisation.
**Expected:** No SAB warning. `numThreads=1` prevents the SAB requirement.
**Why human:** Browser runtime behaviour. Cannot be verified from static code.

#### 3. wasmPaths version pin matches installed ORT version

**Test:** Note the version string in the loaded .wasm CDN URL in the Network tab. Run `npm run check:ort-version` locally. Confirm both show `1.26.0-dev.20260416-b7804b056c`.
**Expected:** Exact version match between live CDN URL and `check:ort-version` output.
**Why human:** Requires comparing browser Network tab URL against local terminal output.

#### 4. Fail-open behaviour when model CDN is blocked

**Test:** In DevTools, block the HF model request URL. Reload the page. Confirm all articles remain visible and the amber `[WARN] content filter unavailable — all articles shown` notice appears.
**Expected:** All articles shown. Amber notice present. No content hidden due to model failure.
**Why human:** Requires live browser CDN-block + reload interaction. Cannot be simulated from code.

---

### Gaps Summary

No gaps found. All must-haves are verified with code-level evidence. The four human verification items are live-URL browser observations that cannot be checked from static code; they were human-verified on 2026-06-08 per the orchestrator note and the Plan 06 blocking checkpoint.

The code evidence robustly supports all four live observations:
- **No .wasm 404s**: wasmPaths pinned to exact ORT version; `check:ort-version` confirms the pin; `optimizeDeps.exclude` prevents Vite from mis-bundling
- **No SAB warning**: `numThreads=1` set at module scope before any `pipeline()` call; `env.allowLocalModels = false`
- **Version pin match**: `onnxruntime-web@1.26.0-dev.20260416-b7804b056c` identical in worker and `check:ort-version` output
- **Fail-open**: worker catch posts `label:'error'`; `isHidden('error') === false`; `modelFailed` flag wired to amber notice in ContentFilterControls

---

_Verified: 2026-06-08T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
