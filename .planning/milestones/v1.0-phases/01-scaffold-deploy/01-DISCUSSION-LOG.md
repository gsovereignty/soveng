# Phase 1: Scaffold & Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 1-Scaffold & Deploy
**Areas discussed:** Pages URL & base path, Terminal aesthetic, Placeholder content, Monospace font

---

## Pages URL & base path

| Option | Description | Selected |
|--------|-------------|----------|
| Project page (subpath) | username.github.io/<repo>/ → base: '/<repo>/'. Most common for a project repo. | |
| User/org root page | username.github.io/ (repo named username.github.io) → base: '/'. Cleaner URL, root-level. | ✓ |
| Custom domain | e.g. soveng.dev via CNAME → base: '/'. Needs owned domain + DNS. | |

**User's choice:** User/org root page
**Notes:** Resolves to `base: '/'` regardless of username — no subpath asset juggling. Repo must be created as `<username>.github.io`. No git remote exists yet.

---

## Terminal aesthetic — Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Green phosphor | Classic green-on-black, hacker/cypherpunk vibe. | ✓ |
| Amber phosphor | Warm amber-on-black, retro DEC/IBM, softer for reading. | |
| Modern dark | Muted accent on near-black, lower contrast, contemporary. | |

**User's choice:** Green phosphor
**Notes:** Implement via Tailwind v4 `@theme inline` OKLCH tokens; force monospace everywhere.

## Terminal aesthetic — CRT FX

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle | Monospace + palette + blinking cursor accent, no distracting motion. | |
| Full CRT | Scanlines, text glow/bloom, faint flicker — maximum retro immersion. | ✓ |
| None | Pure flat monospace + palette, most readable. | |

**User's choice:** Full CRT
**Notes:** Committed look for app chrome + placeholder. Flag raised: full CRT can hurt long-form readability — Phase 4 inline reader should consider toning effects down on article body text.

---

## Placeholder content

| Option | Description | Selected |
|--------|-------------|----------|
| Boot sequence | Fake terminal boot/log ending on a blinking prompt; doubles as later loading aesthetic. | ✓ |
| Title card + prompt | ASCII/figlet app banner + tagline + blinking cursor. | |
| List skeleton | Greyed-out article-list skeleton; previews layout but commits to structure early. | |

**User's choice:** Boot sequence
**Notes:** Build as a reusable component so Phases 2–3 can repurpose it as the relay-fetch loading state.

---

## Monospace font

| Option | Description | Selected |
|--------|-------------|----------|
| JetBrains Mono (self-host) | @fontsource/jetbrains-mono — offline, no Google Fonts request, fits static ethos. | ✓ |
| IBM Plex Mono (self-host) | Self-hosted via @fontsource; more typewriter character. | |
| System mono stack | ui-monospace, SFMono, Menlo… zero bytes but OS-variable. | |

**User's choice:** JetBrains Mono (self-host)
**Notes:** Aligns with research recommendation and zero-backend/static delivery model.

---

## Claude's Discretion

- Exact OKLCH hue/lightness values for the green phosphor palette (starting point per research; needs visual iteration).
- Boot-sequence log lines, animation timing/cadence.
- Project structure, Vite/TS config, shadcn init flags, Actions workflow YAML, initial shadcn components scaffolded.

## Deferred Ideas

- CRT-effect toggle / `prefers-reduced-motion` handling — revisit for article body in Phase 4.
- Light/alternate theme toggle — not requested; green phosphor is the single v1 theme.
- Custom domain — not chosen (root-page model selected); possible future.
