# Phase 5: ML Pipeline Infrastructure - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

> ⚠ **SCOPE EXPANDED DURING DISCUSSION — roadmap reconciliation required.**
> The user re-scoped this phase from "invisible ML pipeline, no UI" to the **complete
> content-filtering feature**: the ML pipeline **plus** all user-facing controls. This
> **merges Phases 6 and 7 into Phase 5** (user-directed, see D-08). Two follow-ups are
> **mandatory before/around planning**:
> 1. Run `/gsd-phase` to remove or absorb **Phase 6** (Filter Controls) and **Phase 7**
>    (False-Positive Recovery) into Phase 5, and update the ROADMAP success criteria for
>    Phase 5 (it is no longer "invisible to user").
> 2. Update `.planning/REQUIREMENTS.md`: add the new **length-filter requirement** (D-05,
>    "hide articles < 500 words"), and note that **CTRL-06 (peek)** is satisfied by the
>    slider extreme rather than a separate "show hidden" control (D-07). CTRL-01..05 now
>    land in Phase 5.

<domain>
## Phase Boundary

Deliver the **complete in-browser content-filtering feature** for the Nostr long-form reader,
as a single phase. Three filter dimensions hide noise from the article list, with a small set
of user-facing controls and full fail-open behavior, all client-side (zero backend), verified
on the live `https://gsovereignty.github.io/soveng/` URL.

**Filter dimensions (applied to the article list):**
1. **Spam** — ONNX classifier (`bert-tiny-finetuned-sms-spam-detection-ONNX`, q8) running in a
   Web Worker via `@huggingface/transformers`; hides articles whose spam confidence ≥ the
   current threshold. Fail-open on every error.
2. **Language** — synchronous `franc-min` English-only gate on the main thread; hides confident
   non-English articles. Fail-open hard.
3. **Length** — a synchronous editorial rule that hides articles shorter than **500 words**
   (D-05). Always on, independent of the toggle (D-06).

**User-facing controls (merged in from former Phases 6 & 7):**
- Content filtering **ON by default** (CTRL-01).
- Model-download **progress indicator** on first visit (CTRL-02).
- **Filtered count** visible while filtering is active (CTRL-03).
- **On/off toggle**, persisted to localStorage, governing the spam + language ML filters
  (CTRL-04). The length gate is NOT governed by this toggle (D-06).
- **Spam-confidence slider** (CTRL-05): default ~0.90, range 0.50–0.99, re-evaluates the
  visible list instantly against stored scores (no re-inference). At its extreme the spam ML
  is effectively disabled — this **is** the false-positive recovery mechanism (D-07).
- **Fail-state notice** when the model fails to load (non-blocking; all articles stay visible).

**What this phase delivers vs. defers:**
- Ships the spam ML, **gated by validation** (D-01): a dev-console score-logging pass against
  20+ real articles confirms the default threshold and that legitimate Bitcoin/Nostr articles
  are not over-filtered, before trusting the filter. If real scores show widespread false
  positives even near 0.90, fall back to language-only + length (re-evaluate during planning).
- **No per-article spam/not-spam flagging** — explicitly dropped as a mistake (D-09).
- **No separate "show hidden"/peek UI** — replaced by the slider extreme (D-07).

</domain>

<decisions>
## Implementation Decisions

### Spam ML — ship it, but validation-gated (SPAM-01..04)
- **D-01:** **Ship the ONNX spam classifier, gated by a validation pass.** Build the full
  Worker + classifier, but the go/no-go is conditional on real-article scores looking sane.
  If the dev-console logging pass (D-04) shows legitimate crypto/Nostr articles scoring as
  spam even near the default threshold, fall back to **language-only + length filtering** for
  this milestone and defer spam ML (SPAM-05). Resolve this against live relays during
  planning/early implementation — do not write the integration assuming the scores are fine.
- **D-02:** **Conservative spam threshold, exposed as a live slider.** The earlier "hardcoded
  threshold" intent is superseded by D-08's live control. The slider's **default is ~0.90**
  (range 0.50–0.99). The exact default is **Claude's discretion**, to be pinned by the
  validation run (D-04). Bias hard toward never hiding a legitimate article.
- **D-03:** **Language gate fails open hard (research default).** Strip code blocks + hex/JSON
  lines before detection; require ~200+ chars of remaining text; treat `'und'` and franc
  confidence < 0.75 as English (shown). Classify on body, not title. Only a *confident*
  non-English detection hides an article. (LANG-01, LANG-02.)

### Validation approach (success criterion #4)
- **D-04:** **Build dev-console spam-score logging.** Every article's spam score + label is
  logged to the dev console (dev-only, not in the production bundle) so the live-URL smoke
  test can eyeball real scores, confirm no false positives at the default threshold, and pin
  the slider's default value. This is part of the phase, not post-ship tuning.

### Length filter — new dimension (NEW requirement, flag for REQUIREMENTS update)
- **D-05:** **Hide articles shorter than 500 words outright.** A third filter dimension: very
  short kind:30023 notes are treated as noise and hidden (this is a *long-form* reader).
  Replaces research's "<100-word bypass (show short notes)" with a hard hide. ⚠ The exact word
  count (500) may catch some legitimate shorter posts — acceptable per the user's explicit
  call. Not covered by current LANG/SPAM/MLINF requirements → **add a requirement (e.g.
  `LEN-01`) during the REQUIREMENTS reconciliation.**
- **D-06:** **The 500-word length gate is ALWAYS ON, independent of the filter toggle.**
  Turning the content-filter toggle OFF reveals spam + non-English articles, but **not**
  sub-500-word notes — those stay hidden as an editorial rule. The toggle governs only the
  spam + language ML filters.

### Recovery model — slider, not peek (reinterprets CTRL-06)
- **D-07:** **No "show hidden"/peek control. The confidence slider IS the recovery
  mechanism.** Dragging the slider to its high extreme effectively disables spam ML, surfacing
  any spam-hidden (false-positive) articles. There is no separate peek UI. Note: the slider
  affects **spam only** — non-English and sub-500-word articles remain hidden at any slider
  setting (the slider does not control the binary language gate or the length gate).

### Controls & roadmap shape
- **D-08:** **Ship the live filter controls in production now — merge Phases 6 & 7 into
  Phase 5.** Phase 5 is no longer invisible. It ships: on-by-default toggle (localStorage,
  CTRL-04), progress indicator (CTRL-02), filtered count (CTRL-03), fail-state notice, and the
  spam-confidence slider (CTRL-05). Flag for `/gsd-phase` to remove/absorb Phases 6 & 7 and
  update Phase 5's ROADMAP success criteria.
- **D-09:** **No per-article spam/not-spam flagging.** Considered and explicitly **dropped by
  the user as a mistake.** Do not build any flagging UI or feedback-weighting mechanism. The
  slider is the only spam-tuning control.

### Claude's Discretion
- Exact default value for the spam slider (start ~0.90; pin via the D-04 validation run).
- Exact minimum-stripped-text length for the franc gate (~200 chars) and the franc-confidence
  cutoff (~0.75) — within the fail-open-hard intent of D-03.
- The exact 500-word boundary's implementation (word-count method, what counts as a "word"
  after stripping Markdown/code) — keep it cheap and synchronous (D-05).
- Vite worker import mechanism — research recommends `?worker` suffix over `new URL()`; final
  call is the planner's within that guidance.
- Whether the length + language synchronous gates run before the async spam dispatch in the
  `visibleArticles` pipeline (recommended — cheap gates first; non-English/short articles never
  reach the ONNX queue).
- All shadcn component choices for the controls (Switch/Toggle for on-off, Slider for the
  threshold, Badge/Progress for count + download) — per the shadcn-only rule.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — product definition; zero-backend / works-for-every-visitor
  constraint, terminal aesthetic, lean-bundle bias, hashtag/facet semantics.
- `.planning/REQUIREMENTS.md` §"Language Filtering" (LANG-01/02), §"Spam Filtering"
  (SPAM-01..04), §"ML Infrastructure" (MLINF-01..03), §"Filter Controls & Transparency"
  (CTRL-01..06) — locked requirement text. ⚠ Needs reconciliation: add a length requirement
  (D-05) and note CTRL-01..05 now land in Phase 5, CTRL-06 reinterpreted (D-07).
- `.planning/ROADMAP.md` §"Phase 5/6/7" — goals + success criteria. ⚠ Phase 5 criteria still
  say "invisible to user"; this is superseded by D-08 (run `/gsd-phase`).

### Research (read closely — this is the highest-risk surface in the project)
- `.planning/research/SUMMARY.md` — executive summary; the open product decision (spam ML vs
  language-only, D-01), the 5 critical pitfalls, the 4-new-file / 2-modified-file plan, the
  `visibleArticles` insertion point, and the deployment constraints.
- `.planning/research/PITFALLS.md` — the 5 critical pitfalls in detail: SMS-model over-filter,
  `wasmPaths` on `/soveng/` sub-path, `onnxruntime-web` version mismatch, franc mis-flagging
  code-heavy articles, missing `numThreads=1`. **All are Phase 5 issues.**
- `.planning/research/STACK.md` — `@huggingface/transformers@4.2.0`, `franc-min@6.2.0`, model
  selection (q8, 4.49MB), Vite config additions (`optimizeDeps.exclude`, `worker.format: 'es'`),
  what NOT to use (coi-serviceworker, @xenova, tinyld/eld).
- `.planning/research/ARCHITECTURE.md` — the `visibleArticles` memo insertion point, the
  module-level Worker singleton pattern, the `useRef` Map + version-counter streaming pattern,
  fail-open label semantics, facet sourcing from `visibleArticles`.
- `.planning/research/FEATURES.md` — P1/P2/P3 feature split (now largely all-in for this
  merged phase).

### Deployment-constraint primary sources (cited in research; verify at implementation time)
- `node_modules/onnxruntime-web/package.json` — the EXACT ORT version that transformers.js
  installs; the `wasmPaths` CDN pin MUST match it (derive at implementation time — cannot be
  pre-committed). Success criterion #4 checks this on the live URL.

### Prior phase context (decisions Phase 5 inherits)
- `.planning/phases/04-filtering-inline-reader/04-CONTEXT.md` — the existing facet/filter
  pipeline (`buildFacets`/`computeDynamicCounts`/`filterArticles`), terminal aesthetic, the
  `isFilterEmpty` derived-state pattern, shadcn-only rule, no-Zustand pattern.
- `.planning/phases/02-nostr-data-layer/02-CONTEXT.md` — `NostrStatus`
  (`streaming|done|empty|error`), the `lib/pool.ts` module-level singleton pattern (the model
  for the Worker singleton), `Article` model fields.

### Project guidance
- `CLAUDE.md` — tech stack, "use existing shadcn components" rule, subpath imports, lean-bundle
  ethos, zero-backend constraint.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/App.tsx` (lines 20–44) — the **integration seam**. Current memo pipeline:
  `articles → sortedArticles (sortArticlesByReplies) → buildFacets / computeDynamicCounts /
  filterArticles`. The new **`visibleArticles` memo inserts between `sortedArticles` and those
  three downstream memos** — they switch their input from `sortedArticles` to `visibleArticles`.
  This is the only structural change to App.tsx (plus wiring the controls + `useClassification`).
- `src/lib/pool.ts` — the **module-level singleton pattern** (`export const pool = new
  SimplePool()`, created once at module eval, never in a component). The classifier Worker
  getter (`src/lib/classifierWorker.ts`) mirrors this exactly — StrictMode-safe, no
  double-instantiation.
- `src/components/FilterBar.tsx` + `src/lib/facets.ts` — existing top filter-bar UI and the
  shared OR/AND filter helpers; the new content-filter controls (toggle, count, slider,
  progress) live alongside / within this bar's terminal-styled chrome.
- `src/types/nostr.ts` — `Article` model; add `ClassificationLabel = 'pending' | 'ham' |
  'spam' | 'non-english' | 'error'` (and the length gate can be derived, not stored on the
  model).
- `src/index.css` — `terminal-*` tokens + CRT helpers for styling the new controls on-aesthetic.

### Established Patterns
- Plain React hooks + context, **no Zustand** (Phase 2 D-11). The classification state is a
  `useRef<Map<eventId, label>>` + a `useState` version counter (avoids React diffing the Map);
  filter UI state (toggle, slider value) is local `useState` + localStorage persistence for the
  toggle (CTRL-04) — mirrors Phase 4's local-UI-state approach.
- shadcn components added via `npx shadcn add <name>` into `src/components/ui/`. Present today:
  `card, accordion, toggle-group, avatar, toggle, checkbox`. Likely additions: `switch`,
  `slider`, `progress`, `badge`.
- Fail-open ethos throughout (existing empty/error handling in App.tsx): only explicit `'spam'`
  (≥ threshold) and confident `'non-english'` hide an article; `undefined`/`pending`/`error`/
  `ham` all show. The length gate is the one deterministic *hide* that is always applied.
- `nostr-tools` subpath imports; lean-bundle bias. `@huggingface/transformers` is excluded from
  `optimizeDeps` and loaded only inside the Worker chunk — zero main-bundle impact.

### Integration Points
- New files (per research): `src/workers/classifier.worker.ts`, `src/lib/classifierWorker.ts`,
  `src/lib/languageDetect.ts`, `src/hooks/useClassification.ts`. Modified: `src/types/nostr.ts`,
  `src/App.tsx`, `vite.config.ts`. Plus the new control components/UI for this merged phase.
- Facets + downstream memos source from `visibleArticles` (not `sortedArticles`) so counts and
  results never diverge as ML results stream in.
- Must be smoke-tested on the **deployed** `/soveng/` URL, not just localhost: no `.wasm` 404s,
  no `SharedArrayBuffer` warning, ORT CDN pin matches installed version, real spam scores logged.

</code_context>

<specifics>
## Specific Ideas

- The filter is **noise removal for a long-form reader**: spam, non-English, and **too-short**
  notes all get hidden. The 500-word rule is an editorial stance — sub-500-word notes "aren't
  long-form" — and is always on regardless of the toggle.
- The user prefers **one tuning knob**: a confidence slider, not per-article flagging. The
  slider doubles as the false-positive escape hatch (max ≈ spam off). Keep the control surface
  minimal and on-aesthetic.
- **Trust is earned by validation, not assumed**: ship spam ML only after eyeballing real
  scores via dev-console logging on the live URL; be ready to drop to language-only + length if
  the SMS-trained model over-filters the Bitcoin/Nostr corpus.

</specifics>

<deferred>
## Deferred Ideas

- **Custom Nostr/long-form-trained spam model** (SPAM-05) — replace the SMS-trained model if
  false-positive rates stay high after launch. Out of this milestone.
- **Per-article "why filtered" disclosure** (SPAM-06) — which signal + confidence. Considered
  via the dropped flagging UI (D-09); not shipping.
- **Multi-language allow-list** (show French/Spanish/German) — v1.1 is binary English-only.
- **Cross-session classification-result cache (localStorage)** — session-scoped Map is
  sufficient for v1.1; the *model artifact* is still cached cross-session via the Cache API
  (MLINF-02). Adds invalidation complexity; deferred.
- **Pubkey denylist / mute list** (MUTE-01) — non-ML author filtering. Future.

None of the above expand Phase 5 scope.

</deferred>

---

*Phase: 5-ML Pipeline Infrastructure*
*Context gathered: 2026-06-08*
