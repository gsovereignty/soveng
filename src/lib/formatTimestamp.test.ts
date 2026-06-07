import { describe, it, expect } from "vitest"
import { formatTimestamp } from "@/lib/formatTimestamp"

describe("formatTimestamp", () => {
  it("returns '1970-01-01 00:00' for Unix epoch 0 (UTC boundary)", () => {
    expect(formatTimestamp(0)).toBe("1970-01-01 00:00")
  })

  it("returns '2026-06-01 14:32' for a known fixed ms value", () => {
    expect(formatTimestamp(Date.UTC(2026, 5, 1, 14, 32))).toBe("2026-06-01 14:32")
  })

  it("output always matches YYYY-MM-DD HH:MM format (16 chars, space separator, no seconds)", () => {
    const result = formatTimestamp(Date.UTC(2024, 11, 31, 23, 59))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(result).toHaveLength(16)
  })

  it("drops seconds and sub-second precision", () => {
    // Two timestamps in the same minute should format identically
    const t1 = formatTimestamp(Date.UTC(2025, 0, 15, 8, 5, 0))
    const t2 = formatTimestamp(Date.UTC(2025, 0, 15, 8, 5, 59))
    expect(t1).toBe(t2)
    expect(t1).toBe("2025-01-15 08:05")
  })
})
