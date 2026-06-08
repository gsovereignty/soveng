import { useEffect, useRef, useState } from "react"
import type { Article, ClassificationLabel } from "@/types/nostr"
import { getClassifierWorker } from "@/lib/classifierWorker"
import { detectLanguage, countWords } from "@/lib/languageDetect"

// Conservative spam threshold — the SMS-trained model (UCI SMS Spam Collection, 5,570
// samples) domain-shifts heavily on Nostr/Bitcoin long-form content. Domain-shift
// research shows accuracy drops from 99% (in-domain SMS) to ~60% (out-of-domain).
// Words like "pump", "sats", "wallet", "zap" are strong SMS spam signals but are
// normal vocabulary in Bitcoin/Nostr articles. Starting at 0.90 minimises false positives.
// Pin this constant to the value validated during the D-04 calibration run against
// 20+ live relay articles. (PITFALLS.md Pitfall 1, D-02)
//
// VALIDATED 2026-06-08 (05-06 go/no-go, D-01): GO — pinned at 0.90. Live smoke test on
// https://gsovereignty.github.io/soveng/ confirmed legitimate Bitcoin/Lightning/Nostr
// articles are NOT over-filtered at this threshold; spam ML is trusted at 0.90.
export const DEFAULT_SPAM_THRESHOLD = 0.90

// Articles shorter than this word count bypass ONNX inference entirely.
// Short texts are where domain shift is worst — the model has too little context
// to overcome vocabulary signals. Always-on hide, no ML needed. (LEN-01, D-05)
export const MIN_WORDS = 500

// Maximum chars to send in each postMessage to the worker.
// BERT-family models have a 512-token hard cap; the tokenizer silently truncates
// beyond that. 512 chars is a conservative proxy. (ARCHITECTURE anti-pattern 3)
const MAX_PAYLOAD_CHARS = 512

// ---------------------------------------------------------------------------
// Worker message types
// ---------------------------------------------------------------------------

type WorkerResult = {
  type: "result"
  id: string
  label: "ham" | "spam" | "error"
  score: number
}

type WorkerProgress = {
  type: "progress"
  progress: number
}

type WorkerMessage = WorkerResult | WorkerProgress | { type: string }

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface ClassificationState {
  /** Per-event-id classification label. Mutated in place; check `version` for changes. */
  map: Map<string, ClassificationLabel>
  /** Increments on every map mutation — use as useMemo dependency, not the Map reference. */
  version: number
  /** Per-event-id raw ONNX score (0–1). Stored for re-thresholding without re-inference. */
  scores: Map<string, number>
  /** Model download progress 0–100, or null when not downloading. */
  downloadProgress: number | null
  /** True when every completed result from the worker was an error (fail-open: show all). */
  modelFailed: boolean
}

// ---------------------------------------------------------------------------
// useClassification
// ---------------------------------------------------------------------------

/**
 * Orchestrates the cheap-gates-first classification pipeline:
 * 1. franc-min language gate (sync, main thread): non-English → label 'non-english', skip worker
 * 2. 500-word length gate (sync): short → label 'short', skip worker
 * 3. English >=500-word articles → postMessage to ONNX worker with text[0:512]
 *
 * Results are cached by event id (MLINF-03: never re-infer on re-render).
 * Re-thresholding (changing the `threshold` argument) recomputes spam/ham labels from
 * stored raw scores with zero new postMessage calls (D-02 instant re-eval).
 * Fail-open: 'error', 'pending', 'ham', undefined → article shown (SPAM-04).
 *
 * @param articles - Article array from the sorted Nostr fetch
 * @param threshold - Spam threshold (0–1). Score >= threshold → 'spam'. Default 0.90.
 */
export function useClassification(
  articles: Article[],
  threshold: number = DEFAULT_SPAM_THRESHOLD
): ClassificationState {
  // Mutable Map: keyed by event id, value is ClassificationLabel.
  // useRef so mutations don't trigger renders — version counter does that instead.
  const resultsRef = useRef<Map<string, ClassificationLabel>>(new Map())
  // Raw ONNX scores stored separately for threshold re-eval without re-inference.
  const scoresRef = useRef<Map<string, number>>(new Map())
  // Version counter: increment on every map mutation to notify dependent useMemos.
  const [version, setVersion] = useState(0)
  // Model download progress: 0-100 during download, null otherwise.
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  // True when every completed inference result from the worker was 'error'.
  const [modelFailed, setModelFailed] = useState(false)

  // Track successful vs error results for modelFailed computation.
  const successCountRef = useRef(0)
  const errorCountRef = useRef(0)

  // Keep threshold in a ref so the message handler can read the current value
  // without the message effect needing to re-register (mirrors useArticleFetch countRef pattern).
  const thresholdRef = useRef(threshold)
  thresholdRef.current = threshold

  // ---------------------------------------------------------------------------
  // Effect 1: Register message listener once (worker singleton lives for page lifetime)
  // Mirrors useArticleFetch's "never close the pool" rule: removeEventListener only,
  // NEVER call worker.terminate() (would force re-downloading the ONNX model).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const worker = getClassifierWorker()

    const handleMessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data

      if (data.type === "result") {
        const result = data as WorkerResult
        const { id, label, score } = result

        // Ignore messages for unknown ids (T-05-RDR: only act on known ids)
        // We accept any id — the worker only sends results for ids we dispatched.

        if (label === "error") {
          // fail-open: 'error' means show the article (SPAM-04)
          resultsRef.current.set(id, "error")
          scoresRef.current.set(id, 0)
          errorCountRef.current += 1
        } else {
          // Store raw score for re-thresholding
          scoresRef.current.set(id, score)
          // Apply current threshold to determine spam vs ham
          const computedLabel: ClassificationLabel =
            score >= thresholdRef.current ? "spam" : "ham"
          resultsRef.current.set(id, computedLabel)
          successCountRef.current += 1

          // D-04: dev-only spam-score logging — tree-shaken out of the production bundle.
          // Logs id + score + resolved label only. NEVER logs article body/content text
          // (bodies may embed private keys — see PITFALLS.md Security row).
          // Format: one row per article so 20+ scores are easy to scan at a glance.
          if (import.meta.env.DEV) {
            const hides = score >= thresholdRef.current
            console.log(
              `[spam-score] id=${id.slice(0, 8)} score=${score.toFixed(4)} label=${computedLabel} threshold=${thresholdRef.current.toFixed(2)} hides=${hides}`
            )
          }
        }

        // Update modelFailed: true only if ALL results so far were errors (and at least one error)
        const totalResults = successCountRef.current + errorCountRef.current
        const allErrors = totalResults > 0 && successCountRef.current === 0
        setModelFailed(allErrors)

        setVersion(v => v + 1)
      } else if (data.type === "progress") {
        const progressMsg = data as WorkerProgress
        const pct = progressMsg.progress
        // 100% means download complete — clear the progress indicator
        setDownloadProgress(pct >= 100 ? null : pct)
      }
      // All other message types are silently ignored (T-05-RDR shape validation)
    }

    worker.addEventListener("message", handleMessage)

    return () => {
      // removeEventListener only — NEVER terminate (mirrors "never close the pool")
      worker.removeEventListener("message", handleMessage)
    }
  }, []) // runs once — worker singleton lives for the entire page lifetime

  // ---------------------------------------------------------------------------
  // Effect 2: Process newly-seen articles with gate ordering
  // Runs whenever the articles array changes (new articles stream in from relay).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const worker = getClassifierWorker()
    let mutated = false

    for (const article of articles) {
      // MLINF-03: cache by event id — skip if already classified
      if (resultsRef.current.has(article.id)) continue

      // Gate 1: franc language gate (sync, main thread)
      // Sample: title + beginning of content (enough for reliable detection)
      const sampleText = `${article.title ?? ""} ${article.content}`
      const lang = detectLanguage(sampleText)

      if (lang === "non-english") {
        // Confident non-English → label immediately, do NOT send to worker (LANG-01)
        resultsRef.current.set(article.id, "non-english")
        mutated = true
        continue
      }

      // Gate 2: 500-word length gate (LEN-01, D-05, SPAM-03)
      // Short texts are where domain shift is worst — always hide, no ML needed.
      if (countWords(article.content) < MIN_WORDS) {
        resultsRef.current.set(article.id, "short")
        mutated = true
        continue
      }

      // Survivor: mark pending, dispatch to ONNX worker
      // Text truncated to 512 chars (BERT max, performance, T-05-PAYLOAD)
      resultsRef.current.set(article.id, "pending")
      worker.postMessage({
        id: article.id,
        text: article.content.slice(0, MAX_PAYLOAD_CHARS),
      })
      mutated = true
    }

    if (mutated) {
      setVersion(v => v + 1)
    }
  }, [articles])

  // ---------------------------------------------------------------------------
  // Effect 3: Re-threshold when threshold changes
  // Recomputes spam/ham labels from scoresRef WITHOUT re-posting to the worker.
  // This is the D-02 instant re-eval: changing the threshold slider re-labels
  // stored scores immediately with zero new inference calls.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let mutated = false

    for (const [id, score] of scoresRef.current) {
      // Only re-compute for articles that have a real score (ham or spam result)
      const currentLabel = resultsRef.current.get(id)
      if (currentLabel !== "ham" && currentLabel !== "spam") continue

      const newLabel: ClassificationLabel = score >= threshold ? "spam" : "ham"
      if (newLabel !== currentLabel) {
        resultsRef.current.set(id, newLabel)
        mutated = true
      }
    }

    if (mutated) {
      setVersion(v => v + 1)
    }
  }, [threshold])

  return {
    map: resultsRef.current,
    version,
    scores: scoresRef.current,
    downloadProgress,
    modelFailed,
  }
}
