# Walking Skeleton — Soveng (Nostr Long-Form Reader)

**Phase:** 1
**Generated:** 2026-06-06

## Capability Proven End-to-End

A visitor can open the live GitHub Pages URL and see the terminal-themed boot-sequence placeholder (green-phosphor CRT, monospace, blinking cursor) rendered by the deployed Vite + React + shadcn/ui app — proving the full scaffold → build → deploy stack works before any Nostr data is wired in.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | React 19 + Vite 8.0.16 + TypeScript 5.x (SPA) | Static SPA, fastest HMR, native ESM, first-class static asset output for GitHub Pages (STACK.md) |
| UI / components | shadcn/ui (new-york style) on Tailwind v4 + @tailwindcss/vite | Decided in CLAUDE.md; use existing shadcn primitives only — no bespoke UI components (D-09) |
| Styling / theming | Tailwind v4 @theme inline OKLCH tokens in src/index.css | v4 drops tailwind.config.js; green-phosphor palette + monospace-everywhere (font-sans aliased to font-mono) defined as tokens (D-05) |
| Aesthetic | Full CRT: scanlines + text glow/bloom + faint flicker, green-on-black | Committed look (D-06); applied as CSS layered over shadcn primitives, scoped to app chrome |
| Typography | JetBrains Mono, self-hosted via @fontsource/jetbrains-mono | Zero external font network request, preserves zero-backend/self-contained ethos (D-08) |
| Data layer | None in Phase 1 (deferred to Phase 2: nostr-tools SimplePool) | Walking skeleton proves deploy first; relay risks contained to Phase 2 |
| Hosting / base path | GitHub Pages user/org root page (username.github.io), Vite base '/' | Root-page model means no /repo/ subpath rewriting; base '/' mitigates the asset-404 pitfall (D-01, D-02, PITFALLS #5) |
| Deployment target | GitHub Actions → Pages artifact deploy (upload-pages-artifact + deploy-pages) | No deploy token, no extra branch commit; least-privilege permissions (D-03) |
| SPA fallback | dist/index.html copied to dist/404.html during build | GitHub Pages has no server-side routing; serves 404.html for unmatched paths (D-04) |
| Directory layout | src/components (incl. ui/ for shadcn + BootSequence), src/hooks, src/store, src/lib, src/types | Established per ARCHITECTURE.md; later phases add hooks/store/lib/types for Nostr data |

## Stack Touched in Phase 1

- [x] Project scaffold (Vite + React + TS + shadcn/ui init, Tailwind v4, lint via shadcn defaults, build)
- [x] Routing — single-view SPA (no router); 404.html fallback handles deep links
- [ ] Database — N/A (zero-backend static site; no DB exists or is planned)
- [x] UI — interactive boot-sequence placeholder (animated reveal to blinking cursor) rendered by the deployed app
- [x] Deployment — live on GitHub Pages via GitHub Actions on push to main

> Note: "Database read AND write" from the generic skeleton template does not apply — Soveng is a read-only, zero-backend static site by project constraint. The end-to-end proof is instead: scaffold → static build with correct base → live deployed UI interaction. Phase 2 introduces the only data path (read-only relay fetch over WebSocket).

## Out of Scope (Deferred to Later Slices)

- Any Nostr relay connection, fetching, dedup, or timeout logic (Phase 2)
- Article rendering: titles, authors, timestamps, profile resolution (Phase 3)
- Hashtag facet sidebar, AND/OR filtering, inline Markdown reader (Phase 4)
- CRT-effect toggle / `prefers-reduced-motion` handling for body readability (deferred; revisit in Phase 4)
- Light/alternate theme toggle (green phosphor is the single v1 theme)
- Custom domain (root-page model chosen instead)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Nostr Data Layer:** Connect to the 4 default relays, fetch + dedup kind:30023 articles with an EOSE/response timeout, batch-resolve kind:0 author profiles, expose a normalized article model with safe fallbacks. Reuses BootSequence as the loading state.
- **Phase 3 — Article List:** Render real articles end-to-end on the deployed URL (title, author identity, timestamp) with distinct loading / empty / relay-error states.
- **Phase 4 — Filtering & Inline Reader:** Hashtag facet sidebar with per-tag counts and an AND/OR toggle; inline sanitized Markdown expand/collapse. Reconsider dialing back CRT effects on long-form body text for readability.
