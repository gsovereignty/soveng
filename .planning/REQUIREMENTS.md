# Requirements: Soveng — Nostr Long-Form Reader

**Defined:** 2026-06-08
**Milestone:** v1.1 Local ML Content Filtering
**Core Value:** Discover and read recent Nostr long-form articles, filtered by hashtag — with zero backend, served entirely as a static GitHub Pages site.

> v1.0 requirements (DATA, DISP, FILT, UI, DEPLOY) are validated and archived at
> `.planning/milestones/v1.0-REQUIREMENTS.md`. This file scopes the v1.1 milestone:
> in-browser ML content filtering (spam + non-English), keeping the zero-backend,
> works-for-every-visitor property.

## v1.1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Language Filtering

- [ ] **LANG-01**: Non-English articles are detected in-browser via a lightweight language library (franc-min) and hidden from the article list
- [ ] **LANG-02**: Language detection strips Markdown/code blocks and requires a minimum text length before classifying; undetermined or too-short articles fail open (treated as English, shown)

### Spam Filtering

- [ ] **SPAM-01**: Articles are classified spam/ham by an in-browser ML model (transformers.js ONNX) and spam is hidden from the article list
- [ ] **SPAM-02**: Classification uses a conservative default confidence threshold (~0.90) so legitimate crypto/Nostr articles are not over-filtered
- [ ] **SPAM-03**: Articles below a minimum text length bypass spam classification and are always shown
- [ ] **SPAM-04**: Classification fails open — model-load failure, worker crash, or inference error leaves the article visible

### Length Filtering

- [ ] **LEN-01**: Articles shorter than 500 words are hidden from the list as an editorial long-form threshold. This gate is **always on**, independent of the content-filter toggle (added 2026-06-08 during Phase 5 discussion; word-count boundary may be tuned during validation)

### ML Infrastructure

- [ ] **MLINF-01**: The ML model runs off the main thread in a Web Worker so the UI never blocks or janks during classification
- [ ] **MLINF-02**: The model loads correctly under the GitHub Pages `/soveng/` base path (wasmPaths pinned, single-thread WASM / numThreads=1) and the model artifact is cached across sessions
- [ ] **MLINF-03**: Articles render immediately on fetch and are hidden progressively as classification results arrive; classification result is cached per event id (not re-run on every render)

### Filter Controls & Transparency

- [ ] **CTRL-01**: Content filtering is ON by default
- [ ] **CTRL-02**: A progress indicator is shown while the model downloads on first visit
- [ ] **CTRL-03**: The reader displays a count of how many articles were filtered (hidden)
- [ ] **CTRL-04**: User can toggle content filtering on/off
- [ ] **CTRL-05**: User can adjust the spam confidence threshold via a slider
- [ ] **CTRL-06**: ~~User can reveal ("peek at") hidden articles to recover false positives~~ — **reinterpreted 2026-06-08**: no separate "show hidden" control. The spam-confidence slider (CTRL-05) at its maximum effectively disables spam filtering, surfacing false positives — this is the recovery mechanism. Satisfied by CTRL-05.

## Future Requirements

Deferred beyond v1.1. Tracked but not in this milestone's roadmap.

### Spam Quality

- **SPAM-05**: Replace the SMS-trained spam model with a Nostr/long-form-trained classifier (custom model hosted on the project's HF account) if false-positive rates remain high after launch feedback
- **SPAM-06**: Per-article "why filtered" disclosure (which signal — spam vs language — and confidence)

### Filtering Beyond Content

- **MUTE-01**: Pubkey denylist / mute list to hide known-spam authors without ML

### Carried from v1.0 Active (unrelated to ML filtering)

- **CONF-01**: User-configurable relay set
- **CONF-02**: Adjustable feed length
- **ENRICH-01**: Article summary/image on cards
- **ENRICH-02**: Clickable hashtag pills
- **ENRICH-03**: Per-relay connection status

## Out of Scope

Explicitly excluded from v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Server-side / build-time classification | Violates zero-backend, works-for-every-visitor constraint — all ML runs in the visitor's browser |
| Local Ollama / external LLM endpoint | Would only filter on machines running a model server; deployed site must filter for all visitors in-browser |
| Multi-language support (filter to languages other than English) | v1.1 scope is English-only; the language gate is a binary is-English test |
| Per-article spam-score badges on visible articles | Anti-feature — clutters the reading view; hidden-count + peek covers transparency |
| Re-classifying on every render / no result cache | Performance anti-pattern — classification is cached per event id |
| Consent gate before model download | Filtering is on by default; an ambient progress indicator is sufficient disclosure |
| Training/fine-tuning a custom spam model in this milestone | Deferred (SPAM-05) — ship with the best available browser-sized model + high threshold first |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LANG-01 | Phase 5 | Pending |
| LANG-02 | Phase 5 | Pending |
| SPAM-01 | Phase 5 | Pending |
| SPAM-02 | Phase 5 | Pending |
| SPAM-03 | Phase 5 | Pending |
| SPAM-04 | Phase 5 | Pending |
| LEN-01 | Phase 5 | Pending |
| MLINF-01 | Phase 5 | Pending |
| MLINF-02 | Phase 5 | Pending |
| MLINF-03 | Phase 5 | Pending |
| CTRL-01 | Phase 5 | Pending |
| CTRL-02 | Phase 5 | Pending |
| CTRL-03 | Phase 5 | Pending |
| CTRL-04 | Phase 5 | Pending |
| CTRL-05 | Phase 5 | Pending |
| CTRL-06 | Phase 5 (folded into CTRL-05) | Pending |
