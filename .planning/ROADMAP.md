# Roadmap: Soveng — Nostr Long-Form Reader

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-06-07) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🔄 **v1.1 Local ML Content Filtering** — Phases 5-7 (in progress)

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

- [ ] **Phase 5: ML Pipeline Infrastructure** — Working in-browser spam + language filter, invisible to user, deployed and verified on the live /soveng/ URL
- [ ] **Phase 6: Filter Controls** — User-visible filter UI: progress indicator, filtered count, on/off toggle, fail state notice
- [ ] **Phase 7: False-Positive Recovery** — Threshold slider and hidden-article peek so users can tune and inspect the filter

## Phase Details

### Phase 5: ML Pipeline Infrastructure
**Goal**: Articles containing spam or non-English content are silently filtered from the list by in-browser ML, with all deployment constraints resolved and verified on the live GitHub Pages URL
**Depends on**: Phase 4 (v1.0 complete — the visibleArticles memo inserts between sortedArticles and existing downstream memos)
**Requirements**: LANG-01, LANG-02, SPAM-01, SPAM-02, SPAM-03, SPAM-04, MLINF-01, MLINF-02, MLINF-03
**Success Criteria** (what must be TRUE):
  1. Non-English articles are absent from the rendered list; short, code-heavy, or undetermined articles remain visible (fail-open)
  2. Spam articles with confidence >= 0.90 are hidden; legitimate Bitcoin/Nostr articles with crypto vocabulary are not over-filtered at this threshold
  3. Articles render immediately on fetch and disappear progressively as classification results arrive — no blocking of the initial list
  4. On the deployed https://gsovereignty.github.io/soveng/ URL: no .wasm 404s in the network tab, no SharedArrayBuffer warning in the console, and the ONNX CDN version pin matches node_modules/onnxruntime-web/package.json
  5. A model-load failure, worker crash, or inference error leaves all affected articles visible (fail-open throughout)
**Plans**: TBD
**UI hint**: yes

### Phase 6: Filter Controls
**Goal**: The user can see that ML filtering is active, knows how many articles were filtered, and can turn the filter off
**Depends on**: Phase 5
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04
**Success Criteria** (what must be TRUE):
  1. Content filtering is ON when the app first loads — no manual action required to activate it
  2. On a first visit (cold cache), a progress indicator is visible while the model downloads; it disappears when classification is complete
  3. A count of hidden articles is visible in the UI at all times while filtering is active (e.g. "3 filtered")
  4. A toggle exists that turns content filtering on and off; the toggle state persists across page reloads via localStorage
**Plans**: TBD
**UI hint**: yes

### Phase 7: False-Positive Recovery
**Goal**: A user who suspects an article was incorrectly filtered can inspect hidden articles and adjust the spam threshold without disabling filtering entirely
**Depends on**: Phase 6
**Requirements**: CTRL-05, CTRL-06
**Success Criteria** (what must be TRUE):
  1. A slider control lets the user adjust the spam confidence threshold (range 0.50–0.99, default 0.90); moving the slider re-evaluates the stored scores immediately without re-running inference
  2. A "show hidden" action reveals the filtered articles inline so the user can read them and verify whether the filter was correct
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold & Deploy | v1.0 | 2/2 | Complete | 2026-06-06 |
| 2. Nostr Data Layer | v1.0 | 3/3 | Complete | 2026-06-07 |
| 3. Article List | v1.0 | 2/2 | Complete | 2026-06-07 |
| 4. Filtering & Inline Reader | v1.0 | 2/2 | Complete | 2026-06-07 |
| 5. ML Pipeline Infrastructure | v1.1 | 0/? | Not started | - |
| 6. Filter Controls | v1.1 | 0/? | Not started | - |
| 7. False-Positive Recovery | v1.1 | 0/? | Not started | - |
