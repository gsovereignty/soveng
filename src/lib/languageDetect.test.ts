import { describe, it, expect } from "vitest"
import { detectLanguage, countWords } from "@/lib/languageDetect"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 300+ chars of clean English prose — should reliably detect as english */
const ENGLISH_BODY = `
The Lightning Network is a second-layer payment protocol that operates on top of Bitcoin.
It enables fast, low-cost transactions by routing payments through a network of payment channels.
Users can send and receive satoshis instantly without waiting for blockchain confirmation.
This makes it ideal for micropayments and everyday purchases where speed matters most.
The protocol uses Hash Time Locked Contracts to ensure trustless routing across channels.
`

/** 300+ chars of Russian — should reliably detect as non-english */
const RUSSIAN_BODY = `
Биткоин — это децентрализованная цифровая валюта, которая функционирует без центрального банка.
Транзакции записываются в публичном реестре, называемом блокчейном. Майнинг обеспечивает
безопасность сети путём решения сложных математических задач. Каждые четыре года происходит
халвинг, уменьшающий вознаграждение майнеров вдвое. Сеть Bitcoin работает непрерывно с 2009 года.
Сатоши Накамото создал Bitcoin как альтернативу традиционным финансовым системам.
`

/** Code-heavy body — triple-backtick fences + hex lines; after stripping < 200 chars → undetermined */
const CODE_HEAVY_BODY = `
\`\`\`javascript
const txid = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const pubkey = "02c4d8e9f7a3b5c1d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2";
const signature = "304402203a8f9d7e6b5c4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8";
\`\`\`
a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3
`

/** Very short text (title-only or < 200 stripped chars) — should be undetermined */
const SHORT_TEXT = "Bitcoin Lightning Network"

// ─── countWords ──────────────────────────────────────────────────────────────

describe("countWords", () => {
  it("returns the number of whitespace-delimited words", () => {
    expect(countWords("one two three four")).toBe(4)
  })

  it("handles extra whitespace and trims", () => {
    expect(countWords("  hello   world  ")).toBe(2)
  })

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0)
  })

  it("returns 1 for a single word", () => {
    expect(countWords("bitcoin")).toBe(1)
  })
})

// ─── detectLanguage ──────────────────────────────────────────────────────────

describe("detectLanguage", () => {
  it("returns 'english' for a long clean English body", () => {
    expect(detectLanguage(ENGLISH_BODY)).toBe("english")
  })

  it("returns 'non-english' for confident long Russian/non-English body", () => {
    expect(detectLanguage(RUSSIAN_BODY)).toBe("non-english")
  })

  it("returns 'undetermined' for a short text under the minimum char threshold (title-only)", () => {
    expect(detectLanguage(SHORT_TEXT)).toBe("undetermined")
  })

  it("returns 'undetermined' for a code-heavy body (mostly backtick fences + hex lines)", () => {
    // After stripping triple-backtick blocks and hex-only lines the remaining text
    // is under MIN_DETECT_CHARS → fail-open → undetermined
    expect(detectLanguage(CODE_HEAVY_BODY)).toBe("undetermined")
  })

  it("returns 'undetermined' for an empty string", () => {
    expect(detectLanguage("")).toBe("undetermined")
  })

  it("does not return 'non-english' for undetermined input (fail-open)", () => {
    // Ensures 'und' from franc always maps to 'undetermined', never 'non-english'
    const result = detectLanguage("abc")
    expect(result).not.toBe("non-english")
  })
})
