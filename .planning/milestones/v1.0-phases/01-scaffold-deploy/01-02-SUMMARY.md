---
phase: 01-scaffold-deploy
plan: "02"
subsystem: infra
tags: [vite, github-pages, github-actions, spa-fallback, base-path, deploy]

# Dependency graph
requires:
  - phase: 01-scaffold-deploy/01-01
    provides: Vite+React+shadcn scaffold with terminal theme and boot-sequence placeholder
provides:
  - Live GitHub Pages deployment at https://gsovereignty.github.io/soveng/
  - Vite base path set to /soveng/ (project-subpath Pages model)
  - SPA 404.html fallback via postbuild npm script
  - GitHub Actions workflow building and publishing to Pages on push to main
affects:
  - All future phases (live deployment URL is the verification target for every subsequent plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite project-subpath base: base set to /soveng/ for repos served at username.github.io/repo-name/"
    - "SPA 404 fallback: postbuild npm script copies build/index.html to build/404.html"
    - "GitHub Actions Pages deploy: upload-pages-artifact + deploy-pages (no gh-pages npm package)"
    - "Least-privilege permissions: contents read, pages write, id-token write only"

key-files:
  created:
    - .github/workflows/deploy.yml
  modified:
    - vite.config.ts
    - package.json

key-decisions:
  - "D-01/D-02 corrected: repo is gsovereignty/soveng (project subpath), NOT gsovereignty.github.io (root page) — Vite base is /soveng/ not /"
  - "D-03: GitHub Actions artifact deploy chosen over gh-pages npm package (no deploy token, no extra branch commit)"
  - "D-04: 404.html SPA fallback produced via postbuild npm script (cross-platform, no shell dependency)"
  - "Build outDir changed from Vite default dist to build (user request — keep repo clean, build/ gitignored)"

patterns-established:
  - "Postbuild SPA fallback: add a postbuild npm script using node -e copyFileSync to copy index.html to 404.html"
  - "Actions workflow: least-privilege permissions block + concurrency group pages with cancel-in-progress true"

requirements-completed: [DEPLOY-01, DEPLOY-02]

# Metrics
duration: ~60min (spread across session with human verify checkpoint)
completed: 2026-06-06
---

# Phase 01 Plan 02: Vite Base Path, SPA 404 Fallback, and GitHub Actions Pages Deploy Summary

**Vite base set to /soveng/ for project-subpath GitHub Pages, SPA 404.html fallback via postbuild script, and a least-privilege GitHub Actions workflow delivering the terminal boot-sequence live at https://gsovereignty.github.io/soveng/**

## Performance

- **Duration:** ~60 min (including human-verify checkpoint)
- **Started:** 2026-06-06
- **Completed:** 2026-06-06
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify — APPROVED)
- **Files modified:** 3 (vite.config.ts, package.json, .github/workflows/deploy.yml)

## Accomplishments

- Vite base corrected to `/soveng/` matching the actual GitHub Pages project-subpath URL — all asset references use `/soveng/assets/` with no 404s
- SPA 404 fallback produced automatically on every build via a `postbuild` npm script (node -e copyFileSync), making deep-link navigation work on GitHub Pages
- GitHub Actions workflow triggers on push to main, installs via `npm ci` (reproducible), builds, and deploys using `upload-pages-artifact` + `deploy-pages` with least-privilege permissions and a `pages` concurrency group
- Human verification confirmed: https://gsovereignty.github.io/soveng/ renders the terminal boot-sequence placeholder with no asset 404s, and deep-link 404 fallback is functional

## Task Commits

Each task was committed atomically:

1. **Task 1: Set Vite base and produce SPA 404 fallback** - `616743b` (chore) — initial base '/' + postbuild
2. **Task 1 deviation D-01/D-02 fix** - `019f223` (fix) — corrected base to /soveng/ for project-subpath repo
3. **Task 1 deviation build dir** - `72f3360` (chore) — changed outDir from dist to build (gitignored)
4. **Task 2: GitHub Actions deploy workflow** - `f2b6853` (feat) — .github/workflows/deploy.yml
5. **Task 3: Human verification** - APPROVED by user (live URL confirmed, no asset 404s, 404 fallback works)

## Files Created/Modified

- `vite.config.ts` — `base: "/soveng/"`, `build.outDir: "build"`; react + tailwindcss plugins and @ alias preserved
- `package.json` — `postbuild` script: `node -e "const fs=require('fs');fs.copyFileSync('build/index.html','build/404.html');"` for SPA 404 fallback
- `.github/workflows/deploy.yml` — triggers on push to main + workflow_dispatch; least-privilege permissions (contents: read, pages: write, id-token: write); concurrency group `pages` with cancel-in-progress; ubuntu-latest job with checkout@v4, setup-node@v4 (node 22, npm cache), npm ci, npm run build, upload-pages-artifact@v3 (path: build), deploy-pages@v4

## Decisions Made

- **D-01/D-02 corrected during execution:** The plan originally specified `base: "/"` (root-page model, username.github.io repo). During Task 1 execution it became clear the actual repo is `gsovereignty/soveng` hosted at `gsovereignty.github.io/soveng/` — a project-subpath Pages model. Base was corrected to `"/soveng/"` and `01-CONTEXT.md` was updated to reflect this. This was the critical correctness fix (PITFALLS #5 mitigation depends on the right base value).
- **Build outDir `build` (not `dist`):** User preference to avoid `dist/` polluting the repo; `build/` is gitignored. The Actions workflow uploads `path: build` accordingly.
- **GitHub Actions artifact deploy (D-03):** `upload-pages-artifact` + `deploy-pages` chosen over the `gh-pages` npm package — no deploy token required, no extra branch commit, cleaner CI story.
- **Postbuild 404 fallback (D-04):** Implemented as a `postbuild` npm script using inline Node.js (`node -e copyFileSync`) so it runs automatically with every `npm run build` — no shell dependency, cross-platform, no separate step needed in the workflow.

## Deviations from Plan

### Auto-fixed Issues

**1. [D-01/D-02 Correction] Vite base changed from / to /soveng/ (project-subpath vs root-page model)**
- **Found during:** Task 1
- **Issue:** The plan specified `base: "/"` assuming `gsovereignty` was a username.github.io root-page repository. The actual repo is `gsovereignty/soveng`, served at `gsovereignty.github.io/soveng/` — a project-subpath. Setting base to `/` would cause all asset references to resolve at the domain root, producing 404s for all JS/CSS on the deployed site (PITFALLS #5).
- **Fix:** Set `base: "/soveng/"` in vite.config.ts. Updated `01-CONTEXT.md` to record the corrected D-01 and D-02 decisions.
- **Files modified:** vite.config.ts, .planning/phases/01-scaffold-deploy/01-CONTEXT.md
- **Verification:** Build produces `/soveng/assets/` URLs in build/index.html; human verification confirmed no asset 404s on the live URL.
- **Committed in:** `019f223` (fix(01-02): set Vite base to /soveng/)

**2. [Rule 2 - User Request] Build output directory changed from dist to build**
- **Found during:** Task 1 (user request applied during execution)
- **Issue:** Vite's default `dist/` output directory would appear in the repo root; user requested it stay out of the tracked repo.
- **Fix:** Set `build.outDir: "build"` in vite.config.ts; added `build/` to `.gitignore`; updated postbuild script and workflow `path:` to reference `build`.
- **Files modified:** vite.config.ts, package.json, .github/workflows/deploy.yml, .gitignore
- **Verification:** `npm run build` exits 0 and produces `build/index.html` + `build/404.html`; `build/` does not appear in git status.
- **Committed in:** `72f3360` (chore(01-02): output build to /build dir)

---

**Total deviations:** 2 (1 correctness correction, 1 user-requested config change)
**Impact on plan:** Both deviations necessary — the base-path correction is the core PITFALLS #5 mitigation, and the outDir change is a clean repository hygiene preference. No scope creep.

## Issues Encountered

- Initial plan assumption about the root-page repo model (username.github.io) was incorrect for this project. Caught during Task 1 by checking the actual GitHub URL and repository name. Corrected immediately before the first push, preventing a broken deployment.

## User Setup Required

The following one-time repository settings were required (and performed by the user prior to the human-verify checkpoint):

1. **GitHub Pages source:** In repo Settings > Pages, set Source to "GitHub Actions" (the workflow cannot configure this itself).
2. **Push to main** to trigger the first deployment.

These steps cannot be automated by the workflow — they are repo-settings actions requiring the repository owner's GitHub session.

## Next Phase Readiness

- Live GitHub Pages URL is established: https://gsovereignty.github.io/soveng/
- Every future phase can verify deployed work by pushing to main and visiting the live URL
- Phase 1 objective fully met: terminal boot-sequence placeholder is live with correct base path and SPA deep-link fallback
- Phase 2 (Nostr Data Layer) can begin immediately — no blockers

---

## Self-Check: PASSED

- `build/index.html`: FOUND (verified via build run above)
- `build/404.html`: FOUND (produced by postbuild script)
- Asset URLs in build/index.html: `/soveng/assets/` prefix confirmed
- Commits verified:
  - `616743b` — FOUND (git log)
  - `f2b6853` — FOUND (git log)
  - `019f223` — FOUND (git log)
  - `72f3360` — FOUND (git log)
- Human verification: APPROVED — live URL https://gsovereignty.github.io/soveng/ renders with no asset 404s and 404 fallback works

---
*Phase: 01-scaffold-deploy*
*Completed: 2026-06-06*
