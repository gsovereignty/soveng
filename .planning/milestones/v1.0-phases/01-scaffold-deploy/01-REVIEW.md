---
phase: 01-scaffold-deploy
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - .github/workflows/deploy.yml
  - .gitignore
  - components.json
  - index.html
  - package.json
  - src/App.tsx
  - src/components/BootSequence.tsx
  - src/components/ui/card.tsx
  - src/index.css
  - src/lib/utils.ts
  - src/main.tsx
  - src/vite-env.d.ts
  - tsconfig.app.json
  - tsconfig.json
  - tsconfig.node.json
  - vite.config.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 01 delivers a clean Vite + React 19 + TypeScript + shadcn/ui scaffold with a terminal CRT theme and a GitHub Actions → GitHub Pages deployment pipeline. The TypeScript config is strict and well-structured, the Tailwind v4 theme is correctly implemented with `@theme inline`, and the shadcn boilerplate (`card.tsx`, `utils.ts`) is stock-generated and sound. The overall scaffold is buildable and deployable.

Two problem areas require attention:

1. **Supply-chain security** — All four GitHub Actions steps use mutable floating version tags (`@v4`, `@v3`) rather than SHA-pinned refs. A tag repoint by a compromised upstream account would execute arbitrary code inside the build job, which holds `id-token: write` (OIDC) permission.

2. **BootSequence stateful logic** — The `useEffect` dependency array omits `lines` (the array prop), meaning the animation does not restart if the `lines` prop changes. Combined with the `done` flag never resetting, the component silently breaks when the prop is updated from outside — relevant because the interface explicitly accepts `lines` as an optional prop.

---

## Critical Issues

### CR-01: GitHub Actions — Unpinned Action Version Tags (Supply-Chain)

**File:** `.github/workflows/deploy.yml:29,32,46,52`
**Issue:** All four third-party Actions are referenced by floating mutable version tags (`@v4`, `@v3`). The build job holds `id-token: write` (OIDC) and `pages: write`. If any of these tags is repointed to a malicious commit — whether by a compromised maintainer account or a typosquat — the injected code runs inside a job with the ability to publish arbitrary content to the GitHub Pages deployment and exfiltrate OIDC tokens. GitHub's own hardening guide explicitly recommends SHA-pinned refs for all third-party actions.

**Fix:** Pin every action to a full commit SHA. The current tags resolve to these commits (as of the time of this review — re-verify before applying):

```yaml
- name: Checkout
  uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

- name: Setup Node.js
  uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0
  with:
    node-version: "22"
    cache: "npm"

- name: Upload Pages artifact
  uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa  # v3.0.1
  with:
    path: build

- name: Deploy to GitHub Pages
  id: deploy
  uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e  # v4.0.5
```

Alternatively, adopt a tool such as `pinact` or Dependabot's `github-actions` ecosystem to keep SHAs current automatically.

---

## Warnings

### WR-01: BootSequence — `lines` Prop Omitted from `useEffect` Dependency Array

**File:** `src/components/BootSequence.tsx:43`
**Issue:** The `useEffect` lists `[visibleCount, lines.length, lineDelay]` as dependencies but omits the `lines` reference itself. If the parent passes a new `lines` array with the same length as the previous one (e.g., replacing placeholder lines with real relay data), the effect never re-runs, `visibleCount` is not reset, and the new lines render instantly without any animation. The `done` state also never resets, so the cursor blink fires immediately regardless of whether the sequence replayed. This is a real defect because the component's public interface (`BootSequenceProps`) explicitly advertises `lines` as a customisable prop.

**Fix:** Reset `visibleCount` and `done` whenever `lines` changes identity. The cleanest approach is a separate `useEffect` keyed on `lines`:

```tsx
// Reset sequence whenever the lines array changes
useEffect(() => {
  setVisibleCount(0)
  setDone(false)
}, [lines])

// Drive the reveal timer (no lines.length — depends on current visibleCount only)
useEffect(() => {
  if (visibleCount < lines.length) {
    const timer = setTimeout(() => setVisibleCount((n) => n + 1), lineDelay)
    return () => clearTimeout(timer)
  } else {
    const timer = setTimeout(() => setDone(true), 400)
    return () => clearTimeout(timer)
  }
}, [visibleCount, lines, lineDelay])
```

### WR-02: BootSequence — Array-Index Keys on Dynamic List

**File:** `src/components/BootSequence.tsx:55`
**Issue:** `key={i}` (array index) is used for the rendered lines. When `lines` changes and the component resets `visibleCount` to 0 (once WR-01 is fixed), React will see the same keys 0…N and may reuse existing DOM nodes instead of re-mounting them, causing the `line-reveal` CSS animation to not replay on elements that previously existed at those index positions. Index keys are only safe for static, append-only lists.

**Fix:** Use a stable, content-derived key. Since line content should be unique within a boot sequence, combining the index with the line string is sufficient:

```tsx
{lines.slice(0, visibleCount).map((line, i) => (
  <div
    key={`${i}-${line}`}
    className="line-reveal crt-glow text-terminal-green whitespace-pre"
    style={{ animationDelay: "0ms" }}
  >
```

If lines could repeat, a more robust approach is to keep a sequence counter in state and prepend it to the key.

### WR-03: `index.html` — Favicon Points to Vite Default Placeholder

**File:** `index.html:5`
**Issue:** `<link rel="icon" href="/vite.svg">` references the Vite project scaffold's placeholder SVG. Vite rewrites this to `/soveng/vite.svg` at build time (matching the configured `base`), and the file is emitted correctly from `public/`. However, the icon is the Vite logo — visually wrong for any deployed app. More concretely, if the `public/vite.svg` file is ever cleaned up (a natural step when replacing branding), production deployments will silently serve a broken favicon with a 404. This is a latent breakage waiting to be introduced.

**Fix:** Replace the placeholder before any public release. Add a `public/favicon.svg` (or `.ico`) with project-appropriate branding and update the `href`:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

---

## Info

### IN-01: `postbuild` Script Uses CJS `require()` in an ESM Package

**File:** `package.json:9`
**Issue:** `"type": "module"` declares the package as ESM, but the `postbuild` inline script uses `require('fs')` — a CommonJS API. This works today because `node -e` runs in CJS context regardless of `"type": "module"`, but the behaviour is non-obvious and will surprise a developer who tries to convert the inline script to a `.mjs` file or runs it via `--input-type=module`. The pattern is fragile as a long-term maintenance concern.

**Fix:** Either make the `require()` usage explicit by annotating the comment, or convert to the ESM equivalent which works in all contexts including future refactors:

```json
"postbuild": "node --input-type=commonjs -e \"const fs=require('fs');fs.copyFileSync('build/index.html','build/404.html');console.log('404.html written');\""
```

Or, more readably, extract to a small `scripts/copy-404.mjs` file using `import { copyFileSync } from 'fs'`.

### IN-02: `ubuntu-latest` Runner Is a Floating Label

**File:** `.github/workflows/deploy.yml:22`
**Issue:** `runs-on: ubuntu-latest` resolves to whatever Ubuntu version GitHub designates as "latest" at job queue time. GitHub has broken builds in the past when bumping this label (e.g., Ubuntu 20 → 22 toolchain differences). For a deploy workflow, stability is more important than receiving runner upgrades automatically.

**Fix:** Pin to a specific runner image:

```yaml
runs-on: ubuntu-24.04
```

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
