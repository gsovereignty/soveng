// @vitest-environment jsdom
/**
 * Tests for useClassification hook.
 *
 * Uses a mocked getClassifierWorker to avoid loading the real ONNX worker.
 * The fake worker exposes postMessage and addEventListener spies so tests can
 * simulate worker responses by invoking the registered message handler directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { Article } from "@/types/nostr"

// ---------------------------------------------------------------------------
// Mock getClassifierWorker
// ---------------------------------------------------------------------------

// We need to capture the "message" event handler that the hook registers on
// the worker so tests can fire fake messages into it.
let registeredMessageHandler: ((e: MessageEvent) => void) | null = null

const fakeWorker = {
  postMessage: vi.fn(),
  addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
    if (event === "message") {
      registeredMessageHandler = handler
    }
  }),
  removeEventListener: vi.fn(),
  terminate: vi.fn(),
}

vi.mock("@/lib/classifierWorker", () => ({
  getClassifierWorker: () => fakeWorker,
}))

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENGLISH_500_WORDS = Array(500).fill("word").join(" ")
const SHORT_ENGLISH = "This is a short article."

function makeArticle(overrides: Partial<Article> & { id: string }): Article {
  return {
    pubkey: "pubkey-" + overrides.id,
    coordinate: "30023:pubkey:" + overrides.id,
    d: overrides.id,
    title: overrides.title ?? "Test Article",
    summary: undefined,
    image: undefined,
    publishedAt: Date.now(),
    createdAt: Date.now(),
    content: overrides.content ?? ENGLISH_500_WORDS,
    hashtags: [],
    ...overrides,
  }
}

// An article with body that franc detects as confident non-English.
// Using Russian text to ensure franc flags it.
const NON_ENGLISH_CONTENT = `Это длинный текст на русском языке, который явно не является английским. ` +
  `Он содержит много слов и предложений, чтобы franc мог надёжно определить язык. ` +
  `Продолжаем добавлять текст на русском, чтобы достичь нужного количества символов для определения языка. ` +
  `Это статья о технологиях Nostr и Bitcoin, написанная по-русски для тестирования фильтра языка. `.repeat(10)

// ---------------------------------------------------------------------------
// Helper: fire a fake worker message
// ---------------------------------------------------------------------------

function fireWorkerMessage(data: Record<string, unknown>) {
  if (!registeredMessageHandler) {
    throw new Error("No message handler registered")
  }
  registeredMessageHandler({ data } as MessageEvent)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useClassification", () => {
  beforeEach(() => {
    registeredMessageHandler = null
    fakeWorker.postMessage.mockClear()
    fakeWorker.addEventListener.mockClear()
    fakeWorker.removeEventListener.mockClear()
    fakeWorker.terminate.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Import the hook under test (done inside describe to allow vi.mock to settle)
  // We use a dynamic approach: import at the start, then use in tests.

  it("returns { map, version, scores, downloadProgress, modelFailed } from the hook", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "a1" })

    const { result } = renderHook(() =>
      useClassification([article], 0.90)
    )

    expect(result.current).toHaveProperty("map")
    expect(result.current).toHaveProperty("version")
    expect(result.current).toHaveProperty("scores")
    expect(result.current).toHaveProperty("downloadProgress")
    expect(result.current).toHaveProperty("modelFailed")
  })

  it("dispatches to worker for English >=500-word articles", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "eng-long", content: ENGLISH_500_WORDS })

    renderHook(() => useClassification([article], 0.90))

    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1)
    const call = fakeWorker.postMessage.mock.calls[0][0]
    expect(call.id).toBe("eng-long")
    expect(call.text.length).toBeLessThanOrEqual(512)
  })

  it("labels non-English articles 'non-english' and does NOT postMessage them", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "ru-article", content: NON_ENGLISH_CONTENT })

    const { result } = renderHook(() => useClassification([article], 0.90))

    expect(fakeWorker.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "ru-article" })
    )
    // The article should be labeled 'non-english'
    expect(result.current.map.get("ru-article")).toBe("non-english")
  })

  it("labels articles below 500 words as 'short' and does NOT postMessage them", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "short-article", content: SHORT_ENGLISH })

    const { result } = renderHook(() => useClassification([article], 0.90))

    expect(fakeWorker.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "short-article" })
    )
    expect(result.current.map.get("short-article")).toBe("short")
  })

  it("marks English >=500-word articles as 'pending' while worker is processing", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "pending-article", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))

    expect(result.current.map.get("pending-article")).toBe("pending")
  })

  it("postMessage text payload is at most 512 chars", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const longContent = "This is very long content. ".repeat(1000) // >> 512 chars
    const article = makeArticle({ id: "long-content", content: longContent })

    renderHook(() => useClassification([article], 0.90))

    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1)
    const payload = fakeWorker.postMessage.mock.calls[0][0]
    expect(payload.text.length).toBeLessThanOrEqual(512)
  })

  it("a worker result with score >= threshold labels article 'spam'", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "spam-article", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))

    act(() => {
      fireWorkerMessage({ type: "result", id: "spam-article", label: "spam", score: 0.95 })
    })

    expect(result.current.map.get("spam-article")).toBe("spam")
    expect(result.current.scores.get("spam-article")).toBe(0.95)
  })

  it("a worker result with score < threshold labels article 'ham'", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "ham-article", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))

    act(() => {
      fireWorkerMessage({ type: "result", id: "ham-article", label: "ham", score: 0.75 })
    })

    expect(result.current.map.get("ham-article")).toBe("ham")
    expect(result.current.scores.get("ham-article")).toBe(0.75)
  })

  it("re-thresholding from 0.90 to 0.99 changes label from 'spam' to 'ham' with zero new postMessage calls", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "rethresh-article", content: ENGLISH_500_WORDS })

    // Render with threshold 0.90
    const { result, rerender } = renderHook(
      ({ threshold }: { threshold: number }) => useClassification([article], threshold),
      { initialProps: { threshold: 0.90 } }
    )

    // Fire result with score 0.95 — should be spam at 0.90
    act(() => {
      fireWorkerMessage({ type: "result", id: "rethresh-article", label: "spam", score: 0.95 })
    })

    expect(result.current.map.get("rethresh-article")).toBe("spam")
    const postMessageCallsAfterResult = fakeWorker.postMessage.mock.calls.length

    // Re-render with higher threshold — score 0.95 < 0.99, so should become 'ham'
    act(() => {
      rerender({ threshold: 0.99 })
    })

    expect(result.current.map.get("rethresh-article")).toBe("ham")
    // No new postMessage calls should have happened
    expect(fakeWorker.postMessage.mock.calls.length).toBe(postMessageCallsAfterResult)
  })

  it("worker 'error' result labels article 'error' (fail-open)", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "error-article", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))

    act(() => {
      fireWorkerMessage({ type: "result", id: "error-article", label: "error", score: 0 })
    })

    expect(result.current.map.get("error-article")).toBe("error")
  })

  it("re-calling hook with same article ids produces zero additional postMessage calls (MLINF-03 cache)", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "cached-article", content: ENGLISH_500_WORDS })

    const { rerender } = renderHook(
      ({ articles }: { articles: Article[] }) => useClassification(articles, 0.90),
      { initialProps: { articles: [article] } }
    )

    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1)

    // Re-render with the same article (same id) — should NOT trigger another postMessage
    act(() => {
      rerender({ articles: [article] })
    })

    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1)
  })

  it("progress message updates downloadProgress", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "prog-article", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))

    expect(result.current.downloadProgress).toBeNull()

    act(() => {
      fireWorkerMessage({ type: "progress", progress: 42 })
    })

    expect(result.current.downloadProgress).toBe(42)
  })

  it("progress message with progress=100 clears downloadProgress to null", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "prog-done", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))

    act(() => {
      fireWorkerMessage({ type: "progress", progress: 50 })
    })
    expect(result.current.downloadProgress).toBe(50)

    act(() => {
      fireWorkerMessage({ type: "progress", progress: 100 })
    })
    expect(result.current.downloadProgress).toBeNull()
  })

  it("modelFailed is false by default", async () => {
    const { useClassification } = await import("@/hooks/useClassification")

    const { result } = renderHook(() => useClassification([], 0.90))

    expect(result.current.modelFailed).toBe(false)
  })

  it("modelFailed becomes true when all results are errors and no successful classification", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const articles = [
      makeArticle({ id: "err-1", content: ENGLISH_500_WORDS }),
      makeArticle({ id: "err-2", content: ENGLISH_500_WORDS }),
      makeArticle({ id: "err-3", content: ENGLISH_500_WORDS }),
    ]

    const { result } = renderHook(() => useClassification(articles, 0.90))

    act(() => {
      fireWorkerMessage({ type: "result", id: "err-1", label: "error", score: 0 })
      fireWorkerMessage({ type: "result", id: "err-2", label: "error", score: 0 })
      fireWorkerMessage({ type: "result", id: "err-3", label: "error", score: 0 })
    })

    expect(result.current.modelFailed).toBe(true)
  })

  it("modelFailed stays false when at least one result is ham or spam", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const articles = [
      makeArticle({ id: "ok-1", content: ENGLISH_500_WORDS }),
      makeArticle({ id: "err-4", content: ENGLISH_500_WORDS }),
    ]

    const { result } = renderHook(() => useClassification(articles, 0.90))

    act(() => {
      fireWorkerMessage({ type: "result", id: "ok-1", label: "ham", score: 0.2 })
      fireWorkerMessage({ type: "result", id: "err-4", label: "error", score: 0 })
    })

    expect(result.current.modelFailed).toBe(false)
  })

  it("hook does NOT call terminate() on the worker", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "no-terminate", content: ENGLISH_500_WORDS })

    const { unmount } = renderHook(() => useClassification([article], 0.90))

    unmount()

    expect(fakeWorker.terminate).not.toHaveBeenCalled()
  })

  it("cleanup removes the message event listener but does not terminate", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "cleanup-article", content: ENGLISH_500_WORDS })

    const { unmount } = renderHook(() => useClassification([article], 0.90))

    unmount()

    expect(fakeWorker.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function))
    expect(fakeWorker.terminate).not.toHaveBeenCalled()
  })

  it("messages of unknown type are ignored (T-05-RDR shape validation)", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "unknown-msg", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))
    const versionBefore = result.current.version

    act(() => {
      fireWorkerMessage({ type: "unknown", id: "unknown-msg" })
    })

    // Still pending — unknown message should have no effect on the label or version
    expect(result.current.map.get("unknown-msg")).toBe("pending")
    expect(result.current.version).toBe(versionBefore)
  })

  it("version increments when a result arrives", async () => {
    const { useClassification } = await import("@/hooks/useClassification")
    const article = makeArticle({ id: "version-test", content: ENGLISH_500_WORDS })

    const { result } = renderHook(() => useClassification([article], 0.90))
    const versionBefore = result.current.version

    act(() => {
      fireWorkerMessage({ type: "result", id: "version-test", label: "ham", score: 0.1 })
    })

    expect(result.current.version).toBeGreaterThan(versionBefore)
  })
})
