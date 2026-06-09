import { describe, it, expect } from "vitest"
import { safeImageUrl } from "@/lib/image"

describe("safeImageUrl", () => {
  it("returns an https:// URL unchanged", () => {
    const url = "https://example.com/image.jpg"
    expect(safeImageUrl(url)).toBe(url)
  })

  it("returns undefined for an http:// URL (mixed content guard, Pitfall 7)", () => {
    expect(safeImageUrl("http://example.com/image.jpg")).toBeUndefined()
  })

  it("returns undefined for a data: URI", () => {
    expect(safeImageUrl("data:image/png;base64,abc123")).toBeUndefined()
  })

  it("returns undefined for a protocol-relative //host/x.jpg URL", () => {
    expect(safeImageUrl("//example.com/x.jpg")).toBeUndefined()
  })

  it("returns undefined for a bare relative path /x.jpg", () => {
    expect(safeImageUrl("/x.jpg")).toBeUndefined()
  })

  it("returns undefined for undefined input", () => {
    expect(safeImageUrl(undefined)).toBeUndefined()
  })

  it("returns undefined for an empty string", () => {
    expect(safeImageUrl("")).toBeUndefined()
  })

  it("does NOT return undefined for a whitespace-padded https:// URL", () => {
    const result = safeImageUrl("  https://example.com/padded.jpg  ")
    expect(result).not.toBeUndefined()
  })

  it("returns undefined for a blob: URL", () => {
    expect(safeImageUrl("blob:https://example.com/abc")).toBeUndefined()
  })
})
