---
phase: 05-ml-pipeline-infrastructure
plan: 06
subsystem: ml-pipeline
tags: [validation, deployment, go-no-go, spam-threshold]
key-files:
  created: []
  modified:
    - src/hooks/useClassification.ts
requirements: [SPAM-02, SPAM-04, MLINF-02]
metrics:
  tasks: 3
  commits: 2
---

# Plan 05-06 Summary — Validation go/no-go + live deployment smoke test

## What was built

Closed the phase with the mandated evidence-based validation of the spam filter against
real, deployed conditions:

- **Task 1 — dev-only score logging (D-04):** Added an `import.meta.env.DEV`-guarded
  spam-score log to the worker-result handler in `useClassification.ts`. One line per
  article — `id` (short prefix), raw ONNX score, resolved label, current threshold, and
  whether it hides — never the article body (T-05-DEVLOG / Security). Confirmed
  tree-shaken from the production bundle.
- **Task 2 — live-URL smoke test (human-verified):** App deployed to
  https://gsovereignty.github.io/soveng/ via GitHub Actions and smoke-tested in-browser.
- **Task 3 — go/no-go applied (D-01):** Verdict recorded and pinned in code.

## Validation verdict (D-01)

**GO — spam ML trusted at `SPAM_THRESHOLD = 0.90`** (the default; no value change needed).

Live smoke test confirmed legitimate Bitcoin/Lightning/Nostr long-form articles are NOT
over-filtered at 0.90. The franc language gate (D-03) and 500-word length gate
(LEN-01/D-06) remain fully active and unchanged. A validation-date comment recording the
GO decision was added at the `DEFAULT_SPAM_THRESHOLD` declaration.

## Deployment note

The first CI deploy failed on the Linux runner with
`Cannot find module '@rolldown/binding-linux-x64-gnu'`. Root cause: regenerating
`package-lock.json` from scratch on macOS during the Wave 1 merge pruned the full
cross-platform native-binding package entries (npm/cli#4828), so `npm ci` had no
`resolved`/`integrity` to fetch the Linux binding. Fixed by restoring the complete
lockfile (15 rolldown + 12 oxide platform entries) and re-adding the new deps without
deleting it (commit `3c5b62d`). Redeploy succeeded.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `f352e1e` | feat(05-06): add dev-only spam-score logging (D-04) |
| — | `3c5b62d` | fix(05): restore cross-platform native bindings in package-lock.json |
| 3 | _(this commit)_ | docs(05-06): record GO verdict — pin SPAM_THRESHOLD at 0.90 |

## Deviations

- The deploy step (push) was performed by the user rather than the executor, since
  publishing to the public GitHub Pages site is an outward-facing action. The CI lockfile
  regression (above) surfaced on the first deploy and was fixed before redeploy.

## Self-Check: PASSED

- Dev-only score log guarded by `import.meta.env.DEV`, excluded from prod bundle ✓
- Live deployment constraints verified on the real /soveng/ URL (human-verified) ✓
- Go/no-go decided from real scores: GO at 0.90 (human-verified) ✓
- franc language + 500-word length gates unchanged ✓
- `npm run build` exits 0; `npm test` 101/101 passing ✓
