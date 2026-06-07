# Requirements: Soveng — Nostr Long-Form Reader

**Defined:** 2026-06-05
**Core Value:** Discover and read recent Nostr long-form articles, filtered by hashtag — with zero backend, served as a static GitHub Pages site.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data (Nostr fetching)

- [x] **DATA-01**: App connects to a fixed default set of relays (relay.damus.io, nos.lol, relay.nostr.band, relay.primal.net) over WebSocket
- [x] **DATA-02**: App fetches kind:30023 events and presents the 21 most recent (newest first) — relaxed to first-21-to-arrive per D-02
- [x] **DATA-03**: App dedupes addressable events by `kind:pubkey:d` coordinate — first-arriving wins per D-03
- [x] **DATA-04**: App applies an EOSE/response timeout so an unresponsive relay never blocks rendering
- [x] **DATA-05**: App resolves author display data by batch-fetching kind:0 profiles for all article authors in a single subscription
- [x] **DATA-06**: App parses NIP-23 metadata with fallbacks for missing optional tags (`title`, `summary`, `image`, `published_at`)

### Article Display

- [ ] **DISP-01**: Each article shows its title (with a sensible fallback when absent)
- [ ] **DISP-02**: Each article shows the author's name (display_name → name → truncated npub fallback) and picture
- [ ] **DISP-03**: Each article shows a human-readable timestamp (`published_at` when present, else `created_at`)
- [ ] **DISP-04**: Clicking an article expands its full body rendered as sanitized Markdown inline in the list
- [ ] **DISP-05**: App shows distinct loading, empty-filter, and relay-error states (error ≠ "no matches")

### Hashtag Filtering

- [ ] **FILT-01**: App derives a hashtag facet list from the `t` tags of the fetched 21 articles, lowercased/normalized
- [ ] **FILT-02**: Each hashtag facet shows a count of how many of the fetched articles carry it
- [ ] **FILT-03**: User can select/deselect hashtags via checkboxes to filter the article list
- [ ] **FILT-04**: User can toggle between AND ("Match ALL") and OR ("Match ANY") combination of selected hashtags

### Presentation & Delivery

- [x] **UI-01**: UI is built with React + shadcn/ui components, themed to a terminal aesthetic (monospace type, terminal palette)
- [x] **DEPLOY-01**: App builds to static assets via Vite with a `base` path correct for GitHub Pages
- [x] **DEPLOY-02**: A GitHub Actions workflow builds and publishes the site to GitHub Pages, with SPA 404 fallback

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enrichment

- **ENRICH-01**: Article cards show `summary` and `image` when present
- **ENRICH-02**: Hashtag values rendered as clickable tag pills on each card
- **ENRICH-03**: Per-relay connection status indicator

### Configuration

- **CONF-01**: User-configurable relay set
- **CONF-02**: Adjustable feed length (beyond fixed 21)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Authoring / publishing articles | Read-only discovery client, not a writing tool |
| Login / signing / NIP-07 | No user identity needed to browse public content |
| Comments, likes, zaps, social interactions | Discovery only, not engagement |
| Pagination / infinite scroll beyond 21 | Fixed-size curated view |
| Server / backend / database | Static site only; all fetching client-side |
| External reader links (njump.me) | Reading happens inline, in-app |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 2 | Complete (02-01) |
| DATA-02 | Phase 2 | Complete (02-01) |
| DATA-03 | Phase 2 | Complete (02-01) |
| DATA-04 | Phase 2 | Complete (02-01) |
| DATA-05 | Phase 2 | Pending (02-02) |
| DATA-06 | Phase 2 | Complete (02-01) |
| DISP-01 | Phase 3 | Pending |
| DISP-02 | Phase 3 | Pending |
| DISP-03 | Phase 3 | Pending |
| DISP-04 | Phase 4 | Pending |
| DISP-05 | Phase 3 | Pending |
| FILT-01 | Phase 4 | Pending |
| FILT-02 | Phase 4 | Pending |
| FILT-03 | Phase 4 | Pending |
| FILT-04 | Phase 4 | Pending |
| UI-01 | Phase 1 | Complete |
| DEPLOY-01 | Phase 1 | Complete |
| DEPLOY-02 | Phase 1 | Complete |

**Coverage:**

- v1 requirements: 18 total
- Mapped to phases: 18 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-05*
*Last updated: 2026-06-06 after roadmap creation*
