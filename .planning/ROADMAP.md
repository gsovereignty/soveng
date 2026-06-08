# Roadmap: Soveng — Nostr Long-Form Reader

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-06-07) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Local ML Content Filtering** — Phase 5 (shipped 2026-06-08) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 📋 **v1.2 / next** — planned (TBD via `/gsd-new-milestone`)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-06-07</summary>

- [x] Phase 1: Scaffold & Deploy (2/2 plans) — completed 2026-06-06
- [x] Phase 2: Nostr Data Layer (3/3 plans) — completed 2026-06-07
- [x] Phase 3: Article List (2/2 plans) — completed 2026-06-07
- [x] Phase 4: Filtering & Inline Reader (2/2 plans) — completed 2026-06-07

Full phase details archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

</details>

<details>
<summary>✅ v1.1 Local ML Content Filtering (Phase 5) — SHIPPED 2026-06-08</summary>

- [x] Phase 5: ML Content Filtering (6/6 plans) — completed 2026-06-08

In-browser spam (transformers.js ONNX) + language (franc-min) + 500-word length filter,
running off the main thread in a Web Worker, fail-open throughout, with user-facing controls
(on-by-default toggle, download progress, hidden count, spam-confidence slider). Validated and
deployed on the live /soveng/ URL with a GO verdict pinning SPAM_THRESHOLD = 0.90. Absorbs the
former Phases 6 (Filter Controls) & 7 (False-Positive Recovery).

Full phase details archived in [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

### 📋 v1.2 / next (Planned)

Next milestone not yet defined. Run `/gsd-new-milestone` to scope it. Candidate work:
domain-tuned spam model (SPAM-05), per-article "why filtered" disclosure (SPAM-06), pubkey
mute list (MUTE-01), and carried v2 enrichment/config items (ENRICH-01/02/03, CONF-01/02).

## Progress

| Phase                      | Milestone | Plans Complete | Status   | Completed  |
| -------------------------- | --------- | -------------- | -------- | ---------- |
| 1. Scaffold & Deploy       | v1.0      | 2/2            | Complete | 2026-06-06 |
| 2. Nostr Data Layer        | v1.0      | 3/3            | Complete | 2026-06-07 |
| 3. Article List            | v1.0      | 2/2            | Complete | 2026-06-07 |
| 4. Filtering & Inline Reader | v1.0    | 2/2            | Complete | 2026-06-07 |
| 5. ML Content Filtering    | v1.1      | 6/6            | Complete | 2026-06-08 |
