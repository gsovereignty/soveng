# Roadmap: Soveng — Nostr Long-Form Reader

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-06-07) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🔄 **v1.1 Local ML Content Filtering** — Phase 5 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-06-07</summary>

- [x] Phase 1: Scaffold & Deploy (2/2 plans) — completed 2026-06-06
- [x] Phase 2: Nostr Data Layer (3/3 plans) — completed 2026-06-07
- [x] Phase 3: Article List (2/2 plans) — completed 2026-06-07
- [x] Phase 4: Filtering & Inline Reader (2/2 plans) — completed 2026-06-07

Full phase details archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

</details>

### v1.1 Local ML Content Filtering

- [ ] **Phase 5: ML Content Filtering** — In-browser spam + language + length filter with user-facing controls (toggle, progress, count, confidence slider), deployed and verified on the live /soveng/ URL

## Phase Details

### Phase 5: ML Content Filtering

> **Scope note (2026-06-08):** This phase absorbs the former Phases 6 (Filter Controls) and 7
> (False-Positive Recovery) — merged during phase discussion per user decision. It is no longer
> "invisible to user": it ships the full content-filtering feature including UI controls. See
> `phases/05-ml-pipeline-infrastructure/05-CONTEXT.md` for the decisions behind this merge.

**Goal**: Articles that are spam, non-English, or shorter than 500 words are filtered from the list by in-browser ML (fail-open throughout), with user-facing controls — on-by-default toggle, download progress, filtered count, and a spam-confidence slider — and all deployment constraints resolved and verified on the live GitHub Pages URL
**Depends on**: Phase 4 (v1.0 complete — the visibleArticles memo inserts between sortedArticles and existing downstream memos)
**Requirements**: LANG-01, LANG-02, SPAM-01, SPAM-02, SPAM-03, SPAM-04, MLINF-01, MLINF-02, MLINF-03, CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, LEN-01 (CTRL-06 reinterpreted — folded into the slider, see criterion 6)
**Success Criteria** (what must be TRUE):

  1. Spam (confidence >= the current slider threshold, default ~0.90), non-English, and sub-500-word articles are absent from the rendered list; legitimate Bitcoin/Nostr articles with crypto vocabulary are not over-filtered at the default threshold; code-heavy or undetermined articles fail open (treated as English, shown)
  2. Articles render immediately on fetch and disappear progressively as classification results arrive — no blocking of the initial list
  3. On the deployed https://gsovereignty.github.io/soveng/ URL: no .wasm 404s in the network tab, no SharedArrayBuffer warning in the console, the ONNX CDN version pin matches node_modules/onnxruntime-web/package.json, and real spam scores are logged to the dev console for validation against 20+ live articles
  4. A model-load failure, worker crash, or inference error leaves all affected articles visible (fail-open throughout), with a non-blocking "filter unavailable" notice
  5. Content filtering is ON by default; a download progress indicator is shown on first visit and clears when classification completes; a count of hidden articles is always visible while filtering is active; a toggle turns spam + language filtering on/off and persists across reloads via localStorage (the 500-word length gate stays on regardless of the toggle)
  6. A spam-confidence slider (range 0.50–0.99, default ~0.90) re-evaluates the stored scores immediately without re-running inference; at its maximum the spam filter is effectively disabled, surfacing any false positives — this replaces a separate "show hidden" control

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — ClassificationLabel type + franc-min language gate + 500-word length gate (pure, tested)
- [x] 05-02-PLAN.md — ONNX Web Worker infra: transformers install, Vite config, numThreads=1 + version-pinned wasmPaths, singleton getter

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-03-PLAN.md — useClassification hook: gates-first orchestration, per-id score cache, instant re-thresholding, fail-open
- [x] 05-04-PLAN.md — Filter controls UI: shadcn Switch/Slider/Progress/Badge + ContentFilterControls component

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 05-05-PLAN.md — App.tsx integration: visibleArticles memo, downstream memos switched, on-by-default persisted toggle + slider

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 05-06-PLAN.md — D-04 dev-console score validation + live /soveng/ deployment smoke test + spam go/no-go (checkpoint)

**UI hint**: yes
