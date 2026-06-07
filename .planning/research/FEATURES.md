# Feature Research

**Domain:** In-browser ML content filtering (spam + non-English) for a Nostr long-form reader
**Researched:** 2026-06-07
**Confidence:** MEDIUM-HIGH (transformers.js / franc documented via official sources; Nostr spam corpus characteristics from community evidence and ML experiments; UX patterns from analogous feed products)

---

## Scope Note

This is v1.1 research only. The existing v1.0 pipeline (fetch → dedup → sort → facet → render) is the dependency baseline. Features below are the NEW ML filtering layer that wraps it. Do not re-implement anything from v1.0.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Dependency on Existing Pipeline |
|---------|--------------|------------|--------------------------------|
| Filter ON by default, zero configuration | Auto-filtering on first visit is the stated goal; a reader that shows obvious spam with no recourse feels broken | LOW | None — state initializes to `filterEnabled: true`; existing ArticleList is unaware |
| Model download progress indicator | Downloading 20-80MB ONNX on first visit with zero feedback looks like a hang; users will close the tab | LOW | None — additive UI element alongside existing FilterBar or status strip |
| Articles display unfiltered immediately, then disappear as classified | Fail-open behavior; users see content loading and working before filtering completes; blocking on classification would add 10-30s delay before any content appears | MEDIUM | ArticleList must accept per-article `classificationStatus` — not currently tracked; requires new Map fed from Web Worker results |
| Filter toggle (on/off) | Every automatic filter ever shipped has needed an escape hatch; without it, power users who lose legitimate articles have no recourse | LOW | Additive state toggle in or near FilterBar; when OFF, classification still runs (cache benefits) but results are not applied |
| "N articles filtered" count | Users need to know why the list is shorter than expected; "21 fetched, 8 showing" with no explanation looks like a bug | LOW | Additive — reads filtered count from classification results Map |
| Classification runs after fetch, does not block display | EOSE fires, articles render, classification starts in Web Worker background | MEDIUM | Classification must be decoupled from the existing `useArticles` hook; dispatched from a separate effect after fetch completes |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Dependency on Existing Pipeline |
|---------|-------------------|------------|--------------------------------|
| Per-article "why filtered" disclosure (on demand) | Builds trust; "FILTERED: non-English (lang=zh, score=0.96)" or "FILTERED: spam (score=0.91)" lets the reader verify the system is working rather than silently eating articles | MEDIUM | Classification result must store `reason`, `lang`, and `score` fields per event id; requires a way to reveal/peek at hidden articles |
| Confidence threshold configurable via UI slider | Lets users tune aggressiveness; critical for the Bitcoin/crypto corpus where false-positive rate is elevated (see Spam Definition section) | MEDIUM | New state; threshold applied at render time against the stored probability float — no re-inference needed |
| Session-persistent classification cache (event id → result) | Avoids re-running inference on re-render, React StrictMode double-invoke, hashtag filter changes; 50-200ms per article × 21 articles = perceptible cost if repeated | MEDIUM | `Map<eventId, ClassificationResult>` in module scope outside React component tree; checked before each worker dispatch |
| "Show filtered" peek toggle | Reveals hidden articles without disabling filtering globally — same pattern as Gmail spam folder; lets users audit the filter | MEDIUM | Second predicate layer; does not touch existing `filterArticles` helper from v1.0 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Block model download behind a consent gate / opt-in modal | Privacy-conscious users might want to approve a network request | Contradicts "on by default" goal; friction on every first visit defeats the feature; the model downloads from Hugging Face CDN, not the app origin, so there is no data collection to consent to | Add a small disclosure in the footer or a settings tooltip: "Spam filter uses a local ML model (~20MB, cached on device, no data leaves your browser)" |
| Re-classify articles on every render / hashtag filter change | Seems thorough | React re-renders on every state change; re-running 50-200ms inference per article per render causes visible jank and drains battery; classification result is stable for a given event id — the text does not change | Cache by event id; skip if already classified |
| Train or fine-tune the model in the browser | Maximum freshness for Nostr-specific spam | transformers.js WASM backend supports inference only, not training; fine-tuning requires Python/GPU server-side tooling | Use a pre-trained distilbert/toxicity model; accept documented false-positive tradeoffs; re-evaluate model choice if corpus mismatch becomes a user complaint |
| Spam score badge on every visible article | "99% ham" badges feel informative | Paranoia aesthetics; labels on non-filtered articles undermine trust in content the classifier already approved; adds visual noise | Show scores only in the "why filtered" on-demand disclosure for hidden articles |
| Server-side relay spam blocklist | Centralized lists can be very accurate | Breaks the zero-backend constraint; introduces a dependency that must be maintained and raises censorship questions on a censorship-resistant protocol | Client-side ML; accept the higher false-positive rate as the cost of zero-backend |
| Language allow-list UI (show French, Spanish, German…) | Multilingual users exist on Nostr | Significant UI and state complexity for v1.1; the default relay set is dominated by English content; most users are English-reading Bitcoin/Nostr developers | Defer to v2; v1.1 is binary: English-only or all languages |
| Real-time re-fetch + re-classify loop | Stay current on new articles | Out of scope for a static reader that fetches on page load; complicates relay connection management | Reload to re-fetch; session classification cache makes re-fetch cheap for articles already seen |

---

## Feature Dependencies

```
[Model download + progress indicator]
    └──required-by──> [Spam classification via transformers.js Web Worker]
                          └──required-by──> [Per-article classificationStatus Map]
                                                ├──required-by──> [Progressive hiding]
                                                ├──required-by──> [N articles filtered count]
                                                ├──required-by──> [Why filtered disclosure]
                                                └──required-by──> [Confidence threshold slider]

[franc language detection] (synchronous, no model download)
    └──required-by──> [Per-article classificationStatus Map]
    (runs in same post-fetch processing step as worker dispatch)

[Session classification cache]
    └──enhances──> [Spam classification + lang detection]
    └──foundation-for──> [Cross-session cache (v2)]

[Filter toggle ON/OFF] ──does not conflict with──> [Filter ON by default]
    (default state = ON; toggle overrides but does not reset default)

[Show filtered peek] ──requires──> [N articles filtered count]
    (only useful when count > 0)

[Confidence threshold slider] ──requires──> [Per-article classificationStatus with float score]
    (threshold applied at render time, no re-inference)
```

### Dependency Notes

- **Spam classification requires model download first**: `pipeline()` in the Web Worker triggers a ~20-80MB ONNX model download on first visit (cached in Cache API after that; free on repeat visits). Progress must be surfaced before articles begin disappearing.
- **Per-article status requires new state shape**: ArticleList currently renders `Article[]`. Classification adds a `Map<eventId, ClassificationResult>` alongside it. The list component needs to read this Map to decide visibility and render pending/classified states.
- **Progressive hiding requires async classification in a Web Worker**: ONNX WASM runs on the main thread by default and will block React reconciliation for 50-200ms per article. Worker posts results back one at a time; React state updates; article disappears. The official transformers.js React tutorial shows this pattern exactly.
- **Confidence threshold requires float storage**: The classification result must store the raw probability float, not a binary label, so the threshold can be adjusted at render time without re-running inference.
- **franc is independent of the ML worker**: franc is synchronous, pure-JS, runs on the main thread in microseconds. It can run in the same post-fetch effect that dispatches articles to the spam worker — no separate thread needed.
- **Session cache must be module-scoped (not component-scoped)**: If the cache lives in React state or a component ref, StrictMode double-mount re-creates it. Module-level `Map` outside the component tree survives double-mount safely.

---

## MVP Definition for v1.1

### Launch With (v1.1)

- [x] Filter ON by default — state initializes to `filterEnabled: true`
- [x] Model download progress indicator — single ambient status strip, not per-article spinners
- [x] Fail-open: articles render immediately, disappear progressively as classification results arrive
- [x] Filter toggle (on/off) — single switch in or near FilterBar
- [x] "N articles filtered" count — passive disclosure below article list or in filter controls
- [x] franc-min language detection (English-only mode) — synchronous, no model, runs post-fetch
- [x] Session-scoped classification cache keyed by event id — module-level Map

### Add After Validation (v1.1.x)

- [ ] Per-article "why filtered" disclosure — trigger: user feedback that content is disappearing unexpectedly
- [ ] Confidence threshold slider — trigger: false-positive complaints on legitimate Bitcoin/crypto articles (high probability of occurring given corpus)
- [ ] "Show filtered" peek toggle — trigger: users want to verify what was hidden

### Future Consideration (v2+)

- [ ] Cross-session classification cache (localStorage) — deferred; sessionStorage pattern is sufficient; localStorage adds invalidation complexity (NIP-23 articles are versioned and editable)
- [ ] Non-English allow-list (show specific non-English languages) — deferred; binary English-only is sufficient for v1.1 corpus
- [ ] Custom model fine-tuned on kind:30023 corpus — deferred; requires curated Nostr training dataset and server-side tooling

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Filter ON by default | HIGH | LOW | P1 |
| Model download progress indicator | HIGH | LOW | P1 |
| Fail-open progressive hiding | HIGH | MEDIUM | P1 |
| Filter toggle (on/off) | HIGH | LOW | P1 |
| N articles filtered count | HIGH | LOW | P1 |
| franc English detection | HIGH | LOW | P1 |
| Session classification cache | MEDIUM | MEDIUM | P1 |
| Per-article why-filtered disclosure | MEDIUM | MEDIUM | P2 |
| Confidence threshold slider | MEDIUM | MEDIUM | P2 |
| Show filtered peek | LOW | MEDIUM | P3 |
| Cross-session cache (localStorage) | LOW | MEDIUM-HIGH | P3 |

**Priority key:** P1 = must have for v1.1 launch; P2 = add after user feedback; P3 = future milestone

---

## Classification Lifecycle UX (Detailed)

### On First Visit (Model Not Cached)

1. Page loads. WebSocket fetch begins as normal.
2. `pipeline()` dispatched to Web Worker on mount — model download begins in background.
3. EOSE fires (or maxWait timeout). Articles render in ArticleList unfiltered, with no per-article indicator.
4. A single ambient status element shows: "Loading spam filter… (first visit, ~20MB)" or a small progress bar tied to `progress_callback`.
5. Model finishes loading (~5–30s depending on connection and whether it is a distilbert-tiny or distilbert-base variant). Worker signals "ready".
6. Worker processes articles sequentially (50–200ms per article on WASM). Results posted back one at a time.
7. As each result arrives, the article stays visible (ham/English) or disappears (spam/non-English). Filtered count increments.
8. Model cached in Cache API. All subsequent visits: steps 2-4 collapse to <1 second from cache.

### On Subsequent Visits (Model Cached)

Steps 2–4 collapse to under one second. Classification starts nearly immediately after fetch. Users may not notice any delay.

### What NOT to Show While Classifying

- Do NOT show a spinner or "Analyzing…" text on each article card — creates visual noise across the full list.
- Do NOT block display of articles until the model is ready — violates fail-open requirement and breaks the first-visit experience.
- Do NOT show per-article dim/pending states if they cannot be resolved within ~2s — transient states that linger confuse users.
- DO show a single ambient indicator near the filter controls that disappears when classification is complete.

---

## Spam Definition for Nostr Long-Form (Kind:30023)

### What Actually Constitutes Spam Here

Evidence from the blakejakopovic/nostr-spam-detection ML experiment and community discussions identifies these patterns:

1. **Asian-language mass posts**: The single largest spam category in the blakejakopovic dataset (13,000 spam examples vs 79,000 ham examples). Non-English detection handles this entirely — the spam classifier does not need to cover it.
2. **Repetitive commercial messages**: Crypto exchange promotions, airdrop announcements, referral link farms. Signals: high URL density, call-to-action language ("claim your airdrop"), repeated token patterns across events from the same pubkey.
3. **Low-effort AI-generated filler**: Extremely generic structure — "In the world of Bitcoin, many people wonder…" followed by generic statements. Signals: no author profile, no hashtags, very short body, low perplexity, generic vocabulary, zero engagement.
4. **Link-only posts**: Article body is almost entirely URLs with minimal original text. Signal: token count < 50, URL proportion > 30% of tokens.
5. **Gibberish or test posts**: Random characters, developer test content. Signal: very low language detection confidence from franc.

### Critical Risk: False Positives in the Bitcoin/Nostr Corpus

The default relay set (damus, nos.lol, nostr.band, primal) serves primarily English-speaking Bitcoin and Nostr developers. Legitimate articles in this corpus share vocabulary with spam:

| Legitimate Content | Overlap with Spam Signal |
|--------------------|-------------------------|
| Bitcoin price discussion ("$100k", "moon", "ATH") | Overlaps with pump-and-dump language |
| Project promotion ("You should try this", "This is great") | Overlaps with shill/call-to-action signals |
| Crypto terminology ("UTXO", "sats", "hodl", "ngmi", "zaps") | Overlaps with crypto exchange spam vocabulary |
| Short opinion pieces (< 200 words) | Below the corpus length where most classifiers are calibrated |
| Code blocks and technical content | Confuses language detectors and may reduce spam model confidence in odd directions |

**Recommended mitigations**:
- Classify on the article body (`content` field), not the title alone.
- If body text is < 100 tokens after stripping Markdown, return "undetermined" (do not filter).
- Default spam confidence threshold should be **≥ 0.85**, not 0.5. The 0.5 default for binary classifiers will produce an unacceptable false-positive rate on this corpus.
- The confidence threshold slider (P2) should default to 0.85 with a range of 0.5–0.99.

---

## Language Detection Behavior (Detailed)

### franc-min Characteristics

- Package: `franc-min` — ~540KB bundle, 82 languages, covers all with 8M+ speakers including English
- Returns ISO 639-3 codes: English = `"eng"`, Chinese = `"cmn"`, Spanish = `"spa"`, etc.
- Reliable minimum text length: 50+ characters. Below 20 characters: treat as undetermined.
- Returns a ranked list of `[langCode, score]` tuples. Use the top result's score as confidence.
- Confidence < 0.75 should be treated as undetermined (fail-open).
- Pure JavaScript, synchronous, no WASM — runs in microseconds on the main thread.

### Problem Cases for Language Detection

| Input Type | Problem | Mitigation |
|------------|---------|------------|
| Title only (< 40 chars) | High misclassification rate; "Bitcoin: A Peer-to-Peer…" is ambiguous at title length | Classify on `content` (article body), not `title`; fall back to title only if body is empty |
| Fenced code blocks in Markdown | franc interprets code as natural language text; JavaScript/Rust code reads as undetermined or wrong language | Strip fenced code blocks (`` ``` ... ``` ``) and inline code before passing to franc |
| Mixed-language articles | franc returns whichever language has more tokens | Treat `score < 0.75` as "English enough" — pass through rather than hide |
| Very short article body (< 50 chars after stripping) | Return value is meaningless | Classify as undetermined, do not filter |
| Nostr-specific jargon (`npub`, `zap`, `sats`, `nsec`) | These tokens are not in franc's training corpus | Benign — franc ignores low-frequency tokens and decides on remaining text |

### The "Is English" Test

The correct predicate is not `detectedLang === "eng"` but:

```
detectedLang === "eng" && confidenceScore >= 0.75
  || bodyLength < 50   // undetermined — do not filter
  || confidenceScore < 0.75  // uncertain — fail open
```

Articles where franc is uncertain should always pass through. The cost of hiding a legitimate English article (false positive) is higher than the cost of showing a legitimate non-English article to an English reader.

---

## Caching and Persistence (Detailed)

### Model Cache (transformers.js — automatic via Cache API)

- transformers.js uses the Cache API by default (`env.useBrowserCache = true`).
- Model files download once and persist across browser sessions until storage is evicted.
- No configuration needed; no code required beyond the default pipeline() call.
- Browser quotas: Chrome/Edge ~60% disk; Firefox ~50% disk; Safari ~1GB per origin.
- Model size for a quantized distilbert-tiny: ~20-40MB. A full distilbert-base: ~80-110MB. Use the smallest model that meets accuracy requirements.

### Classification Result Cache (Session Scope — Recommended for v1.1)

- `Map<eventId, ClassificationResult>` stored at module scope (outside any React component).
- Module-scope survives React StrictMode double-mount (component-scoped refs do not).
- Survives hashtag filter changes — article event IDs don't change when the hashtag filter changes.
- Does not survive page reload — acceptable because the article set changes on each relay fetch.
- Check cache before dispatching to Web Worker: if `cache.has(eventId)`, apply cached result immediately.

### Classification Result Cache (Cross-Session — v2 Consideration)

- `localStorage` keyed by `${eventId}:${sha256(content).slice(0,8)}` — hash detects NIP-23 article edits.
- Requires cache size management (~5MB localStorage quota; ~1,000 entries at ~5KB each).
- Worth implementing only if startup classification delay becomes a user complaint after v1.1 ships.

### What Must NOT Be Cached

- Model weights in React state — causes double-download on StrictMode; use module-scope singleton (as per official transformers.js React tutorial).
- Classification results in component-local state — reset on every unmount/remount cycle.

---

## Competitor Feature Analysis

| Feature | Habla/Highlighter | Yakihonne | Primal | Soveng v1.1 Approach |
|---------|-------------------|-----------|--------|----------------------|
| Spam filtering | Relay-curated (relay-dependent) | Relay-curated | Server-side ML (Primal backend) | Client-side ONNX in Web Worker — zero backend |
| Language filtering | None observed | None observed | None observed | franc-min, English-only by default |
| Filter transparency | None | None | None | N filtered count + optional why-filtered |
| Works offline / zero backend | No (requires relay) | No (requires relay) | No (requires Primal API) | Yes — model cached; relay is only data source |
| Configurable spam threshold | No | No | No | Planned as P2 after user feedback |
| False-positive recourse | None | None | None | Filter toggle + show filtered peek |

---

## Sources

- [GitHub — wooorm/franc](https://github.com/wooorm/franc) — package variants, minimum text length, accuracy characteristics; HIGH confidence
- [PkgPulse — franc vs langdetect vs cld3 (2026)](https://www.pkgpulse.com/blog/franc-vs-langdetect-vs-cld3-language-detection-javascript-2026) — bundle sizes (franc-min ~540KB), browser recommendation, short-text reliability thresholds (< 50 chars unreliable, score < 0.8 unreliable); MEDIUM confidence
- [Transformers.js — React tutorial (Hugging Face official)](https://huggingface.co/docs/transformers.js/tutorials/react) — Web Worker pattern, singleton pipeline, progress_callback, StrictMode safety; HIGH confidence
- [Transformers.js — Hugging Face docs](https://huggingface.co/docs/transformers.js/en/index) — Cache API caching, quantization options (q4/q8/fp16), pipeline API; HIGH confidence
- [Transformers.js v4 release notes](https://github.com/huggingface/transformers.js/releases/tag/4.0.0) — progress_total event, ModelRegistry API, IndexedDB caching; HIGH confidence
- [KDnuggets — Practical NLP in the Browser with Transformers.js](https://www.kdnuggets.com/practical-nlp-in-the-browser-with-transformers-js) — WASM inference latency 50-200ms, model size ~111MB for sentiment pipeline; MEDIUM confidence
- [GitHub — blakejakopovic/nostr-spam-detection](https://github.com/blakejakopovic/nostr-spam-detection) — Nostr spam corpus patterns (Asian-language dominance, 13k spam vs 79k ham), 98% accuracy with 22MB Naive Bayes model; MEDIUM confidence (dataset acknowledged as potentially biased)
- [Nostr content moderation — Stacker News](https://stacker.news/items/699837) — relay-level vs client-level spam strategy; LOW-MEDIUM confidence (community opinion)
- [Xenova/toxic-bert on Hugging Face Hub](https://huggingface.co/Xenova/toxic-bert) — quantized ONNX variant available, 21k downloads; MEDIUM confidence
- [Baymard — How to Design Applied Filters](https://baymard.com/blog/how-to-design-applied-filters) — filter transparency UX (result counts, applied filter overview); HIGH confidence

---

*Feature research for: In-browser ML content filtering (spam + non-English), Soveng v1.1*
*Researched: 2026-06-07*
