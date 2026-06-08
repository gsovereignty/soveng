# Phase 4: Filtering & Inline Reader - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 4-Filtering & Inline Reader
**Areas discussed:** Sidebar layout & responsive, Inline reader experience, Facet panel content, Filter interactions

---

## Sidebar layout & responsive

### Position
| Option | Description | Selected |
|--------|-------------|----------|
| Left rail + list right | Classic faceted layout, facet rail left, list right | |
| Right rail + list left | Reading-first; list primary left, facets right | |
| Top filter bar | Horizontal wrapping bar above the list, no side rail; mobile-friendly | ✓ |

**User's choice:** Top filter bar
**Notes:** Reinterprets ROADMAP/FILT-01 "sidebar" wording as a top bar — a position/HOW choice that still satisfies FILT-01/02. Flagged for `/gsd-transition` as a presentation delta.

### Scroll behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Sticky / pinned | Bar pinned to top of viewport while list scrolls; persistent command-line feel | ✓ |
| Scrolls away | Bar scrolls off with content; max reading space | |
| Sticky + collapsible | Pinned but collapses to a one-line summary | |

**User's choice:** Sticky / pinned

---

## Inline reader experience

### Expand behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Accordion (one at a time) | Opening an article collapses any other open one | ✓ |
| Expand-in-place (multiple) | Each card toggles independently; several open at once | |
| Click-through to full view | Swap list for a single full-article view — deviates from DISP-04 inline | |

**User's choice:** Accordion (one at a time)

### CRT readability in body
| Option | Description | Selected |
|--------|-------------|----------|
| Dial back CRT in body | Drop flicker / ease scanlines+glow in body for readability | |
| Keep full CRT everywhere | Body gets same scanlines/glow/flicker as rest of UI | ✓ |
| Respect prefers-reduced-motion only | Full CRT default, kill flicker for reduced-motion users | |

**User's choice:** Keep full CRT everywhere
**Notes:** Decisively closes the long-form-body readability flag carried from Phases 1 & 3 — aesthetic chosen over reading comfort. `prefers-reduced-motion` accommodation was offered and declined for v1.

### Links / images in Markdown
| Option | Description | Selected |
|--------|-------------|----------|
| Links new-tab, images inline | Clickable links (new tab, rel=noopener noreferrer), inline images | ✓ |
| Links new-tab, images stripped | Clickable links, no remote images (privacy/leaner) | |
| Plain text, nothing clickable | Inert links/images, no remote fetches | |

**User's choice:** Links new-tab, images inline
**Notes:** rehype-sanitize still strips scripts/handlers; no rehype-raw.

---

## Facet panel content

### Tag ordering
| Option | Description | Selected |
|--------|-------------|----------|
| By count, descending | Most common tags first — surfaces dominant themes | ✓ |
| Alphabetical | Predictable a→z; buries popular tags | |
| Count desc, then alpha | Count primary, alpha tie-break | |

**User's choice:** By count, descending
**Notes:** Tie-break left to Claude's discretion (alpha recommended).

### Overflow handling
| Option | Description | Selected |
|--------|-------------|----------|
| Show all, wrap | Render every tag, wrap onto multiple lines | |
| Cap + 'show more' | Top N tags + a '> more (N)' toggle | ✓ |
| Show all, horizontal scroll | Single side-scrolling row | |

**User's choice:** Cap + 'show more'
**Notes:** Exact N left to Claude's discretion (~10–12 suggested).

### Count semantics under active filter
| Option | Description | Selected |
|--------|-------------|----------|
| Static (always of all 21) | Counts never change | |
| Dynamic (of current results) | Counts reflect currently-filtered list | ✓ |

**User's choice:** Dynamic (of current results)
**Notes:** Flagged that OR/Match-ANY mode makes "count of current results" ambiguous — planner must define exact semantics (standard "count if this tag were also toggled" recommended); never show misleading 0 for a selected tag.

---

## Filter interactions

### AND/OR toggle presentation
| Option | Description | Selected |
|--------|-------------|----------|
| Inline toggle in bar | Small two-state control next to tags | |
| Appears when 2+ selected | Toggle only shown once it matters | |
| Segmented Match ANY/ALL | Labeled segmented control, explicit wording | ✓ |

**User's choice:** Segmented Match ANY/ALL
**Notes:** Default = Match ANY (OR), locked by FILT-04 / success criterion 3.

### Expanded article filtered out
| Option | Description | Selected |
|--------|-------------|----------|
| It disappears with the rest | Open article filtered out like any other; accordion clears | ✓ |
| Stays pinned while open | Open article stays visible until collapsed | |

**User's choice:** It disappears with the rest
**Notes:** Filter is the source of truth — no orphaned open cards.

---

## Claude's Discretion

- Exact `N` for the facet cap and tie-break ordering for equal counts.
- Selected/checked-tag visual treatment within `terminal-*` tokens.
- Component choice for tag controls + AND/OR segmented control (shadcn Checkbox / ToggleGroup / styled buttons) within the shadcn-only rule.
- Markdown element/prose styling in the terminal theme.
- Exact copy for the empty-filter message and AND/OR labels.
- Filtering mechanism (`useMemo` over `articles`) and where selected-tags + match-mode state lives.

## Deferred Ideas

- Clickable tag pills on cards (v2 ENRICH-02).
- Summary + image on cards (v2 ENRICH-01).
- Per-relay connection status indicator (v2 ENRICH-03).
- User-configurable relays / adjustable feed length (v2 CONF-01/02).
- `prefers-reduced-motion` / CRT dial-back for body text — declined for v1.
- URL-encoded / shareable filter state — noted as future enhancement.
