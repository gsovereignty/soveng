---
phase: 01-scaffold-deploy
fixed_at: 2026-06-06T00:00:00Z
review_path: .planning/phases/01-scaffold-deploy/01-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-06
**Source review:** .planning/phases/01-scaffold-deploy/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: GitHub Actions — Unpinned Action Version Tags (Supply-Chain)

**Files modified:** `.github/workflows/deploy.yml`
**Commit:** b3be06c
**Applied fix:** Pinned all four Actions steps to full commit SHAs with trailing `# vX.Y.Z` comments. SHAs sourced from the fix guidance in REVIEW.md (verified against stated versions): `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2), `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af` (v4.1.0), `actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa` (v3.0.1), `actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` (v4.0.5). SHA source: REVIEW.md fix guidance (as-of-review pinning).

### WR-01: BootSequence — `lines` Prop Omitted from `useEffect` Dependency Array

**Files modified:** `src/components/BootSequence.tsx`
**Commit:** a123104
**Applied fix:** Added a dedicated reset `useEffect` keyed on `[lines]` that sets `visibleCount` to 0 and `done` to false whenever the `lines` array reference changes. The existing reveal timer effect was updated to depend on `[visibleCount, lines, lineDelay]` (replacing `lines.length` with `lines` to capture reference changes). This is classified as a logic fix and requires human verification that the double-effect pattern behaves correctly across all prop-change scenarios.
**Note:** requires human verification (logic fix)

### WR-02: BootSequence — Array-Index Keys on Dynamic List

**Files modified:** `src/components/BootSequence.tsx`
**Commit:** a123104
**Applied fix:** Changed `key={i}` to `key={\`${i}-${line}\`}` so each rendered line element has a composite key. After a reset (WR-01 fix), React sees new keys for previously-seen index positions and re-mounts the DOM elements, allowing the `line-reveal` CSS animation to replay.

### WR-03: `index.html` — Favicon Points to Vite Default Placeholder

**Files modified:** `index.html`, `public/favicon.svg`
**Commit:** b4c9a1e
**Applied fix:** Created `public/favicon.svg` with a minimal terminal-themed icon (black background, green `❯` chevron matching the app's CRT palette) and updated `index.html` from `href="/vite.svg"` to `href="/favicon.svg"`. Vite copies `public/` assets to the build root and rewrites the path to `/soveng/favicon.svg` with the configured base. The build output confirms `build/favicon.svg` is present and the HTML references `/soveng/favicon.svg`. Note: the SVG is a placeholder icon rather than final brand identity — replacing it with an official asset is deferred to a future branding phase.

### IN-01: `postbuild` Script Uses CJS `require()` in an ESM Package

**Files modified:** `package.json`
**Commit:** 05d856a
**Applied fix:** Added `--input-type=commonjs` to the `node -e` invocation in the `postbuild` script. This makes the CJS context explicit and unambiguous regardless of `"type": "module"` in the package, removing the fragility when the script is ever refactored.

### IN-02: `ubuntu-latest` Runner Is a Floating Label

**Files modified:** `.github/workflows/deploy.yml`
**Commit:** b3be06c
**Applied fix:** Changed `runs-on: ubuntu-latest` to `runs-on: ubuntu-24.04`. Committed atomically with CR-01 (same file, same change set).

## Build Verification

`npm run build` completed successfully (exit 0) after all fixes were applied.

Output confirmed:
- `build/index.html` present with `/soveng/assets/` URLs for JS and CSS
- `build/404.html` present (postbuild copy via `--input-type=commonjs` worked correctly)
- `build/favicon.svg` present (Vite copied from `public/`)
- `build/index.html` favicon href is `/soveng/favicon.svg` (base prefix applied)
- TypeScript check (`npx tsc --noEmit`) passed with zero errors

---

_Fixed: 2026-06-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
