---
phase: "05-ml-pipeline-infrastructure"
plan: "02"
subsystem: "ml-worker-infrastructure"
tags: ["onnx", "web-worker", "transformers.js", "spam-classification", "wasm", "github-pages"]
dependency_graph:
  requires: []
  provides:
    - "getClassifierWorker() module-level singleton getter (src/lib/classifierWorker.ts)"
    - "ONNX spam classifier worker with numThreads=1 and pinned wasmPaths (src/workers/classifier.worker.ts)"
    - "Vite optimizeDeps.exclude + worker.format:es config for ONNX/WASM support"
    - "check:ort-version npm script for CI-verifiable ORT version pin"
  affects:
    - "src/App.tsx (Plan 04 wires useClassification, which consumes getClassifierWorker)"
    - "vite.config.ts (new optimizeDeps and worker keys)"
tech_stack:
  added:
    - "@huggingface/transformers@4.2.0"
    - "franc-min@6.2.0 (already in deps, confirmed)"
  patterns:
    - "Module-level Worker singleton (mirrors pool.ts)"
    - "ONNX pipeline singleton in Web Worker (SpamPipeline class)"
    - "Fail-open catch: label:'error' keeps article visible"
    - "Message shape validation before inference"
key_files:
  created:
    - "src/workers/classifier.worker.ts"
    - "src/lib/classifierWorker.ts"
  modified:
    - "vite.config.ts"
    - "package.json"
decisions:
  - "ORT version pin: 1.26.0-dev.20260416-b7804b056c (transitive dep of @huggingface/transformers@4.2.0)"
  - "wasmPaths CDN: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/"
  - "SpamPipeline uses private static instance Promise<TextClassificationPipeline> (avoids double-init)"
  - "check:ort-version uses fs.readFileSync instead of require() — onnxruntime-web@1.26+ restricts package.json export"
  - "worker.ts uses const onnxBackend = (env.backends.onnx as any).wasm to avoid ASI/type issues"
metrics:
  duration: "10 minutes"
  completed: "2026-06-08T06:26:51Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase 05 Plan 02: ONNX Classifier Worker Infrastructure Summary

Off-main-thread ONNX spam-classification infrastructure: Web Worker with singleton BERT-tiny SMS-spam pipeline, numThreads=1, version-pinned wasmPaths CDN URL, fail-open catch, and module-level getClassifierWorker() singleton getter.

## What Was Built

### Task 1: Install transformers, configure Vite, add ORT version-check script

Installed `@huggingface/transformers@4.2.0` (and confirmed `franc-min@6.2.0` already present). Derived the exact transitive `onnxruntime-web` version from `node_modules/onnxruntime-web/package.json`:

**Derived ORT version: `1.26.0-dev.20260416-b7804b056c`**

This version is pinned in `classifier.worker.ts` wasmPaths CDN URL and is CI-verifiable via:
```
npm run check:ort-version  → 1.26.0-dev.20260416-b7804b056c
```

`vite.config.ts` additions (additive, preserving all existing config):
- `optimizeDeps.exclude: ['@huggingface/transformers']` — prevents Vite esbuild pre-bundler from parsing ONNX/WASM imports
- `worker.format: 'es'` — workers must be ES modules for dynamic import() inside them

### Task 2: Implement the ONNX classifier worker

`src/workers/classifier.worker.ts` implements the BERT-tiny SMS-spam ONNX pipeline as a module-level singleton:

**Critical GitHub Pages constraints baked in:**
- `env.backends.onnx.wasm.numThreads = 1` — set BEFORE any pipeline() call; GitHub Pages has no COOP/COEP headers, SharedArrayBuffer unavailable (Pitfall 5)
- `env.allowLocalModels = false` — always fetch from HF CDN
- `env.backends.onnx.wasm.wasmPaths` pinned to `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/` (Pitfall 2/3)

**Model:** `onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX`, dtype `q8` (~4.49 MB)

**Label mapping:** Model returns `SPAM`/`NOT_SPAM` → mapped to `'spam'`/`'ham'` respectively

**Security (T-05-KEYLOG):** `console.debug` logs only `id` and `score` — never article `text` body

**Message validation (T-05-MSG):** Inbound messages without `string id` and `string text` are silently discarded before any pipeline() call

**Fail-open (SPAM-04):** Any `try/catch` error posts `{ type: 'result', id, label: 'error', score: 0 }` — articles with `'error'` label remain visible

### Task 3: Implement getClassifierWorker() module-level singleton getter

`src/lib/classifierWorker.ts` exactly mirrors `src/lib/pool.ts`'s singleton pattern:
- Module-level `let _worker: Worker | null = null`
- `getClassifierWorker()` lazily creates the Worker on first call, returns cached instance thereafter
- Uses `new URL('../workers/classifier.worker.ts', import.meta.url)` with `{ type: 'module' }` — the one sanctioned relative-path exception from the @/ alias rule
- No `terminate()` call: worker is long-lived to avoid re-downloading the ONNX model

## Derived Value: onnxruntime-web Version Pin

**RECORD:** The `wasmPaths` CDN URL in `src/workers/classifier.worker.ts` is pinned to:
```
onnxruntime-web@1.26.0-dev.20260416-b7804b056c
```

This is a dev pre-release version. It was the transitive dependency installed by `@huggingface/transformers@4.2.0`. The dev version suffix indicates it was published to npm but may not be the same binary available on a stable semver CDN path.

**Known risk:** `1.26.0-dev.20260416-b7804b056c` is a dev/pre-release version of onnxruntime-web. If jsDelivr CDN does not serve this exact pre-release version, the wasmPaths CDN URL will 404 at runtime on the deployed GitHub Pages site. This should be smoke-tested on the deployed URL (Plan 06 checkpoint). If the CDN 404s, options are: (a) upgrade `@huggingface/transformers` to a version with a stable ORT transitive dep, or (b) copy the WASM files to `public/` and use a relative `wasmPaths`.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed ASI/type issue with env.backends.onnx property access**
- **Found during:** Task 2 compilation (tsc -b)
- **Issue:** Using `(env.backends.onnx as any).wasm.numThreads = 1` at the start of a line after an import caused ASI ambiguity — TypeScript parsed it as a call expression. Also the `??=` operator with a `null` typed field caused a union-type callability error.
- **Fix:** Extracted `const onnxBackend = (env.backends.onnx as any).wasm` to avoid leading-parenthesis ASI issue. Used explicit `if (!SpamPipeline.instance)` instead of `??=` for the singleton to avoid the union type callability error with the Promise return.
- **Files modified:** `src/workers/classifier.worker.ts`
- **Commit:** e93cab2

**2. [Rule 3 - Blocking] check:ort-version script uses fs.readFileSync instead of require()**
- **Found during:** Task 1 — `node -e "require('onnxruntime-web/package.json').version"` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` because onnxruntime-web@1.26 restricts package.json in its exports map
- **Fix:** Script uses `fs.readFileSync('./node_modules/onnxruntime-web/package.json')` with `JSON.parse` — equivalent output, reads version correctly
- **Files modified:** `package.json`
- **Commit:** 9de30c0

**3. [Rule 3 - Blocking] Worktree node_modules required separate npm install**
- **Found during:** Task 1 — The git worktree at `/.claude/worktrees/agent-ab3d345fe9b24749b/` has its own package.json (without the new deps) and no node_modules. The main repo install doesn't propagate to the worktree automatically.
- **Fix:** Updated worktree `package.json` to include `@huggingface/transformers@^4.2.0` and `franc-min@^6.2.0`, then ran `npm install --ignore-scripts` in the worktree.
- **Note:** The `--ignore-scripts` flag was used because the `sharp` module has a broken install script on this system (unrelated pre-existing issue). This is safe — sharp is not a dependency of this project.

## Known Stubs

None. All files are infrastructure-only; no UI rendering is wired yet. The worker returns real inference results. `getClassifierWorker()` returns a real Worker instance.

## Threat Flags

No new unplanned threat surfaces. All surfaces are documented in the plan's `<threat_model>`:
- jsDelivr CDN fetch for ORT WASM → T-05-WASM (mitigated: version-pinned + fail-open)
- postMessage boundary → T-05-MSG (mitigated: shape validation) + T-05-KEYLOG (mitigated: no body logging)

## Self-Check

---

## Self-Check: PASSED

Files exist:
- src/workers/classifier.worker.ts ✓
- src/lib/classifierWorker.ts ✓
- vite.config.ts (modified) ✓
- package.json (modified) ✓

Commits exist:
- 9de30c0 (Task 1: install transformers, configure Vite)
- e93cab2 (Task 2: ONNX classifier worker)
- 042e712 (Task 3: getClassifierWorker singleton)

Verifications passed:
- npm run check:ort-version → 1.26.0-dev.20260416-b7804b056c ✓
- npm run build → exit 0 ✓
- npx tsc --noEmit → no errors ✓
- numThreads = 1 in worker ✓
- wasmPaths CDN pinned ✓
- fail-open catch → label:'error' ✓
- no console.log of text body ✓
- no terminate() in classifierWorker.ts ✓
