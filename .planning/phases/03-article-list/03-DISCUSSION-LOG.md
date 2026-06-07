# Phase 3: Article List - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 3-Article List
**Areas discussed:** Streaming vs swap render, Author avatar treatment, Timestamp format

> Area offered but not selected: **Card anatomy & title fallback** — captured as
> sensible defaults under "Claude's Discretion" in CONTEXT.md.

---

## Streaming vs swap render

### How should articles appear as the relay stream comes in?

| Option | Description | Selected |
|--------|-------------|----------|
| Progressive (boot-then-stream) | Show BootSequence briefly, then swap to the list on the first article and append cards live (true to D-01). | ✓ |
| Wait-then-reveal all | Keep BootSequence through the whole streaming phase; reveal all cards at once on `done`. | |
| Progressive, no boot screen | Skip the full-screen boot; render list shell immediately with a slim inline indicator. | |

**User's choice:** Progressive (boot-then-stream)

### While streaming, what signals that more articles may still be arriving?

| Option | Description | Selected |
|--------|-------------|----------|
| Blinking cursor line at list bottom | Terminal-style blinking prompt row beneath the last card. | |
| Slim status line at top | One-line header `> streaming… N/21 received`, resolves to `ready` on done. | ✓ |
| No explicit indicator | Cards just appear; nothing marks streaming-vs-done. | |

**User's choice:** Slim status line at top

### Card ordering as they stream in and after freeze?

| Option | Description | Selected |
|--------|-------------|----------|
| Arrival order (as built) | Render in arrival order; matches Phase 2 hard-freeze-at-21 (D-02). No re-sort. | ✓ |
| Re-sort newest-first on done | Append in arrival order, then re-sort by publishedAt once frozen. Cards jump on done. | |

**User's choice:** Arrival order (as built)
**Notes:** Boot screen plays only while zero cards collected; yields to the live list on the first `ARTICLE_RECEIVED` (locked interpretation of the boot-then-stream choice).

---

## Author avatar treatment

### How should the author picture be rendered within the terminal aesthetic?

| Option | Description | Selected |
|--------|-------------|----------|
| Green-tinted monochrome | Real image through a grayscale + green-tint CSS filter; cohesive with CRT. | ✓ |
| Raw full-color image | Show picture as-is in a small frame; breaks the monochrome palette. | |
| No images, identicon only | Ignore picture; ASCII/block identicon or initials from pubkey. | |

**User's choice:** Green-tinted monochrome

### Fallback when picture is missing OR fails to load?

| Option | Description | Selected |
|--------|-------------|----------|
| Monogram from name/npub | Bordered box with first letter(s) of name, or npub glyph; upgrades to image. Uses shadcn Avatar fallback slot. | ✓ |
| ASCII/block identicon | Deterministic identicon seeded by pubkey. | |
| Generic glyph | Single static placeholder for all missing avatars. | |

**User's choice:** Monogram from name/npub

### Add shadcn Avatar, or build from existing Card primitives?

| Option | Description | Selected |
|--------|-------------|----------|
| Add shadcn Avatar | `npx shadcn add avatar` — natively handles image-then-fallback; matches D-09. | ✓ |
| Plain img + onError | Bare `<img>` with onError handler; reimplements Avatar behavior. | |

**User's choice:** Add shadcn Avatar

---

## Timestamp format

### What format best fits the terminal look?

| Option | Description | Selected |
|--------|-------------|----------|
| Terminal ISO (2026-06-01 14:32) | Absolute, fixed-width, syslog style. | ✓ |
| Relative ('3 days ago') | Human recency; softer, needs a relative formatter. | |
| Relative + absolute on hover | Relative text + full ISO in a tooltip. | |

**User's choice:** Terminal ISO (2026-06-01 14:32)

### How to compute the format (lean bundle)?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled helper | Small pure `formatTimestamp()` using `Intl.DateTimeFormat`; no dependency. | ✓ |
| Add date-fns | Robust, but a new dependency for a handful of lines. | |

**User's choice:** Hand-rolled helper
**Notes:** Source field is `Article.publishedAt`, which already encodes the `published_at` → `created_at` fallback (DISP-03 settled at the data layer).

---

## Claude's Discretion

- **Card anatomy / layout** — terminal log-line-style entries on the existing shadcn `Card`; exact arrangement of title/author/timestamp left to the planner.
- **Title fallback (DISP-01)** — `title` → first line of `summary` (truncated) → `(untitled)`; raw `d`-tag not used as primary fallback.
- **List container / scroll** — keep `max-w-2xl` centered column; vertical scroll for 21 cards, no virtualization.
- Exact green-tint CSS filter values for avatars.
- Exact wording of the slim streaming status line and its done resolution.

## Deferred Ideas

- Inline Markdown article expand (DISP-04) — Phase 4.
- Hashtag facet sidebar + AND/OR filter + empty-filter state (FILT-01…04) — Phase 4.
- Summary + image on cards (ENRICH-01), clickable tag pills (ENRICH-02) — v2.
- Relative-time display — declined for v1 in favor of absolute ISO.
- Per-relay connection status indicator (ENRICH-03) — carried from Phase 2.
- CRT dial-back / `prefers-reduced-motion` for body text — Phase 4 reader concern.
