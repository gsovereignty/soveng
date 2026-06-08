# Phase 5: ML Pipeline Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 5-ML Pipeline Infrastructure
**Areas discussed:** Spam ML scope, Spam tuning, Language gate, Validation gate, Calibration UI placement, Short-note rule, Production control type, Feedback model, Roadmap reconciliation, Length-gate/toggle interaction, Peek scope

---

## Spam ML scope

| Option | Description | Selected |
|--------|-------------|----------|
| Ship spam ML, gated by validation | Build the full ONNX classifier at 0.90, go/no-go conditional on real-article scores; drop to language-only if bad | ✓ |
| Ship spam ML unconditionally | Build at 0.90 + min-length bypass, trust mitigations regardless of observed scores | |
| Language-only for v1.1, defer spam ML | Ship just the franc English gate; defer ONNX until a Nostr-trained model exists | |

**User's choice:** Ship spam ML, gated by validation
**Notes:** Validation pass (dev-console logging) must confirm scores before trusting the filter; fall back to language-only + length if the SMS model over-filters the crypto corpus.

---

## Spam tuning

| Option | Description | Selected |
|--------|-------------|----------|
| Research default (0.90 + <100 words bypass) | Hide spam ≥0.90; <100-word articles bypass spam | |
| Extra-conservative (0.95) | Raise hide threshold to 0.95 | |
| Let validation set the number | Start at 0.90, pin via dev-console run | ✓ (modified) |

**User's choice:** Start at 0.90, exact value Claude's discretion, pinned by the score-logging run
**Notes:** User added (later refined): a UI to flag spam/not-spam to adjust confidence weighting AND "do not show long-form notes shorter than 500 words." The flagging idea was subsequently **dropped** by the user (see Production control / Feedback model). The 500-word rule was confirmed (see Short-note rule). The "hardcoded threshold" intent was superseded by a live slider (see Roadmap reconciliation).

---

## Language gate

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-open hard (research default) | Strip code/hex, require 200+ chars, treat 'und'/<0.75 as English; only confident non-English hides | ✓ |
| Stricter English gate | Hide 'und'/low-confidence too | |

**User's choice:** Fail-open hard (research default)
**Notes:** —

---

## Validation gate

| Option | Description | Selected |
|--------|-------------|----------|
| Build in dev-console score logging | Log every article's spam score + label (dev-only) for the live-URL smoke test | ✓ (modified) |
| Ship mitigations, skip the logging harness | Trust 0.90 + bypass without a logging step | |

**User's choice:** Initially described a spam-flagging feedback UI OR a slider to adjust + eyeball, "end state = a hardcoded confidence level shipped to production."
**Notes:** Resolved across follow-ups into: dev-console logging stays (D-04); a **production confidence slider** replaces the "hardcoded threshold" (D-08); per-article flagging is **dropped** (D-09).

---

## Calibration UI placement (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-only harness (slider + flagging) | Local dev-only tuning tool, production ships only the number | |
| Dev-only harness (slider + eyeball only) | Lighter dev-only slider + console log | |
| Ship a live control in production now | Promote a user-facing control into Phase 5; re-scope | ✓ |

**User's choice:** Ship a live control in production now
**Notes:** Triggered the roadmap re-scope (merge Phases 6 & 7 into Phase 5).

---

## Short-note rule (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Hide articles under 500 words outright | New third filter dimension (length); hides short notes as noise | ✓ |
| Show short notes, skip spam ML under 500 words | Raise research's bypass from 100→500, keep short notes visible | |
| Hide under a smaller threshold (200-300) | Hide short notes at a lower count | |

**User's choice:** Hide articles under 500 words outright
**Notes:** New requirement (LEN-01) to add during REQUIREMENTS reconciliation. Confirmed always-on (see Length-gate/toggle interaction).

---

## Production control type (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold slider + per-article spam/not-spam flags | Live slider plus per-article flag buttons | |
| Threshold slider only | Just the live confidence slider (Phase 7's slider pulled forward) | ✓ |
| Per-article spam/not-spam flags only | No slider; flags drive effective confidence | |

**User's choice:** Threshold slider only
**Notes:** —

---

## Feedback model (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Local override + nudge threshold, persisted to localStorage | Flag shows/hides article + shifts threshold per-browser | |
| Per-article override only (no threshold change) | Flagging force-shows/hides one article | |
| Calibration signal only (dev/tuning) | Flags used to compute cutoff during tuning | |

**User's choice:** "Don't offer any flagging, this was a mistake."
**Notes:** All per-article flagging dropped (D-09). Slider is the only spam-tuning control.

---

## Roadmap reconciliation (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Merge 6 & 7 into Phase 5, flag for /gsd-phase | Phase 5 becomes the full filtering feature | ✓ |
| Keep phases, note overlap | Leave 6 & 7, trim later | |
| Keep Phase 5 invisible after all | Revert to dev-only harness + hardcoded threshold | |

**User's choice:** Merge 6 & 7 into Phase 5, flag for /gsd-phase
**Notes:** Phase 5 is no longer invisible. Mandatory follow-up: `/gsd-phase` to remove/absorb Phases 6 & 7 and update Phase 5 ROADMAP success criteria; update REQUIREMENTS.

---

## Length-gate / toggle interaction (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Part of the toggle (off = short notes reappear) | Toggle is one master switch for all filtering | |
| Always on, independent of the toggle | Sub-500-word notes always hidden; toggle governs only spam + language | ✓ |

**User's choice:** Always on, independent of the toggle
**Notes:** —

---

## Peek scope (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Everything hidden (spam + non-English + short) | Peek reveals all filtered articles | |
| Only spam/ML-hidden articles | Peek reveals spam (+ non-English) only | |

**User's choice:** "Don't 'show hidden'. Only offer the confidence slider in the UI. The extreme setting is the same effect as 'show hidden' because the ML spam detection is effectively disabled."
**Notes:** No separate peek control (CTRL-06 reinterpreted, D-07). The slider doubles as the false-positive recovery mechanism. Note the slider affects spam only — language + length hides persist at any slider value.

---

## Claude's Discretion

- Exact default value for the spam slider (start ~0.90; pin via the validation run).
- Exact franc min-stripped-text length (~200 chars) and confidence cutoff (~0.75).
- Exact 500-word boundary implementation (word-count method after stripping Markdown/code).
- Vite worker import mechanism (`?worker` recommended over `new URL()`).
- Whether synchronous length + language gates run before the async spam dispatch.
- shadcn component choices for the controls (Switch, Slider, Progress, Badge).

## Deferred Ideas

- Custom Nostr/long-form-trained spam model (SPAM-05).
- Per-article "why filtered" disclosure (SPAM-06) — considered via the dropped flagging UI.
- Multi-language allow-list (binary English-only for v1.1).
- Cross-session classification-result cache (session-scoped Map sufficient; model artifact still Cache-API cached).
- Pubkey denylist / mute list (MUTE-01).
