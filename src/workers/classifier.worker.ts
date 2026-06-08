import { pipeline, env, type TextClassificationPipeline } from "@huggingface/transformers"

// GitHub Pages cannot set COOP/COEP headers, so SharedArrayBuffer is unavailable.
// numThreads=1 disables WASM threading which requires SharedArrayBuffer.
// Must be set BEFORE any pipeline() call (Pitfall 5 — PITFALLS.md).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onnxBackend = (env.backends.onnx as any).wasm
onnxBackend.numThreads = 1

// Always fetch from HF CDN — no local model files bundled with the app.
env.allowLocalModels = false

// wasmPaths MUST be pinned to the exact onnxruntime-web version that
// @huggingface/transformers installs as a transitive dependency (Pitfall 2/3).
// Version derived at install time from:
//   node_modules/onnxruntime-web/package.json → "version"
// Run `npm run check:ort-version` to verify this pin matches the installed version.
// Mismatch between WASM binary and JS glue causes: "yn[s] is not a function"
// (see transformers.js issue #1016).
onnxBackend.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/"

// Mirrors pool.ts "Created ONCE" singleton pattern — lazy-initialized on first
// message, never re-created. Terminating the worker would force re-downloading
// the ONNX model, so the worker lives for the full page lifetime.
class SpamPipeline {
  private static instance: Promise<TextClassificationPipeline> | null = null

  static get(onProgress?: (x: unknown) => void): Promise<TextClassificationPipeline> {
    if (!SpamPipeline.instance) {
      SpamPipeline.instance = pipeline(
        "text-classification",
        "onnx-community/bert-tiny-finetuned-sms-spam-detection-ONNX",
        { dtype: "q8", progress_callback: onProgress }
      )
    }
    return SpamPipeline.instance
  }
}

type InboundMessage = { id: string; text: string }

self.addEventListener("message", async (e: MessageEvent<InboundMessage>) => {
  // Validate inbound message shape (T-05-MSG) — ignore malformed messages.
  // Must have string id and string text; otherwise silently discard.
  const msg = e.data
  if (
    typeof msg !== "object" ||
    msg === null ||
    typeof msg.id !== "string" ||
    typeof msg.text !== "string"
  ) {
    return
  }

  const { id, text } = msg

  try {
    const classifier = await SpamPipeline.get((p) => {
      self.postMessage({ type: "progress", ...(p as Record<string, unknown>) })
    })
    const result = await classifier(text)
    // Model labels: SPAM / NOT_SPAM (mrm8488/bert-tiny-finetuned-sms-spam-detection)
    // STACK.md § "ONNX Model Selection" — verified label names from base model card.
    const top = Array.isArray(result) ? result[0] : result
    const label = top.label === "SPAM" ? "spam" : "ham"
    const score = top.score ?? 0

    // Security (T-05-KEYLOG): log only id + score, NEVER article body.
    // Article bodies may contain private keys from tutorial content.
    console.debug("[classifier-worker] id:", id, "score:", score)

    self.postMessage({ type: "result", id, label, score })
  } catch {
    // Fail-open (SPAM-04): any error → article stays visible.
    // Mirrors useArticleFetch.ts resolveStatus never-panic approach.
    self.postMessage({ type: "result", id, label: "error", score: 0 })
  }
})
