// Mirrors src/lib/pool.ts singleton pattern exactly.
//
// Created ONCE per page load — module-level guard is StrictMode-safe.
// React StrictMode double-mount calls getClassifierWorker() twice; the null-check
// ensures the second call returns the same instance as the first.
//
// The Worker is intentionally long-lived: terminating it would force re-downloading
// the ONNX model (~4.5 MB) from the HF CDN (or browser Cache API on repeat visits).
// Never call worker.terminate() anywhere in the application.
//
// NOTE: This file uses a relative '../workers/classifier.worker.ts' path rather than
// the @/ alias. Vite's worker URL resolution requires a relative path in the new URL()
// constructor — the @/ alias is NOT resolved inside new URL() arguments.

let _worker: Worker | null = null

/**
 * Returns the module-level classifier Worker singleton.
 * Creates the Worker on first call; returns the cached instance on all subsequent calls.
 * Safe to call multiple times (StrictMode double-mount, re-renders, etc.).
 */
export function getClassifierWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL("../workers/classifier.worker.ts", import.meta.url),
      { type: 'module' }
    )
  }
  return _worker
}
