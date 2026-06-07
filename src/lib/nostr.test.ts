import { describe, it, expect } from "vitest"
import { articleCoordinate, parseArticle, classifyRelayClose, parseProfile } from "@/lib/nostr"
import type { Event } from "nostr-tools/core"

// Minimal hand-built Event fixture factory
function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "dummy-id-0000000000000000000000000000000000000000000000000000000000000000",
    pubkey: "dummy-pubkey-00000000000000000000000000000000000000000000000000000000",
    created_at: 1700000000,
    kind: 30023,
    tags: [],
    content: "article body",
    sig: "dummy-sig-000000000000000000000000000000000000000000000000000000000000",
    ...overrides,
  } as unknown as Event
}

describe("articleCoordinate", () => {
  it("returns kind:pubkey:d when d tag is present", () => {
    const event = makeEvent({ tags: [["d", "my-slug"]] })
    expect(articleCoordinate(event)).toBe("30023:dummy-pubkey-00000000000000000000000000000000000000000000000000000000:my-slug")
  })

  it("returns kind:pubkey: when d tag is absent", () => {
    const event = makeEvent({ tags: [] })
    expect(articleCoordinate(event)).toBe("30023:dummy-pubkey-00000000000000000000000000000000000000000000000000000000:")
  })
})

describe("parseArticle", () => {
  it("returns a valid Article with no throw when only d tag is present", () => {
    const event = makeEvent({ tags: [["d", "slug"]] })
    let article: ReturnType<typeof parseArticle> | undefined
    expect(() => {
      article = parseArticle(event)
    }).not.toThrow()
    expect(article).toBeDefined()
    expect(article!.title).toBeUndefined()
    expect(article!.summary).toBeUndefined()
    expect(article!.image).toBeUndefined()
    expect(article!.d).toBe("slug")
  })

  it("falls back publishedAt to createdAt * 1000 when published_at is absent", () => {
    const event = makeEvent({ tags: [["d", "slug"]], created_at: 1700000000 })
    const article = parseArticle(event)
    expect(article.publishedAt).toBe(1700000000 * 1000)
    expect(article.createdAt).toBe(1700000000 * 1000)
  })

  it("parses published_at as Unix seconds * 1000 when present", () => {
    const event = makeEvent({
      tags: [["d", "slug"], ["published_at", "1699999000"]],
      created_at: 1700000000,
    })
    const article = parseArticle(event)
    expect(article.publishedAt).toBe(1699999000 * 1000)
  })

  it("lowercases and trims t tag values into hashtags", () => {
    const event = makeEvent({
      tags: [["d", "slug"], ["t", "Bitcoin"], ["t", "  NOSTR  "], ["t", ""]],
    })
    const article = parseArticle(event)
    expect(article.hashtags).toContain("bitcoin")
    expect(article.hashtags).toContain("nostr")
    // Empty t value is dropped
    expect(article.hashtags).not.toContain("")
    expect(article.hashtags).toHaveLength(2)
  })
})

describe("parseProfile", () => {
  it("returns displayName and picture from valid JSON content with display_name", () => {
    const event = makeEvent({
      kind: 0,
      content: JSON.stringify({ display_name: "Alice", picture: "https://x/a.png" }),
    })
    const profile = parseProfile(event)
    expect(profile.displayName).toBe("Alice")
    expect(profile.picture).toBe("https://x/a.png")
    expect(profile.pubkey).toBe("dummy-pubkey-00000000000000000000000000000000000000000000000000000000")
    expect(profile.createdAt).toBe(1700000000)
  })

  it("does NOT throw on malformed JSON content and returns undefined fallbacks", () => {
    const event = makeEvent({ kind: 0, content: "{not json" })
    let profile: ReturnType<typeof parseProfile> | undefined
    expect(() => {
      profile = parseProfile(event)
    }).not.toThrow()
    expect(profile).toBeDefined()
    expect(profile!.displayName).toBeUndefined()
    expect(profile!.picture).toBeUndefined()
  })

  it("display_name wins over displayName wins over name (priority order)", () => {
    // display_name present — wins
    const e1 = makeEvent({ kind: 0, content: JSON.stringify({ display_name: "DisplayName", displayName: "CamelCase", name: "PlainName" }) })
    expect(parseProfile(e1).displayName).toBe("DisplayName")

    // display_name absent — displayName wins
    const e2 = makeEvent({ kind: 0, content: JSON.stringify({ displayName: "CamelCase", name: "PlainName" }) })
    expect(parseProfile(e2).displayName).toBe("CamelCase")

    // only name present
    const e3 = makeEvent({ kind: 0, content: JSON.stringify({ name: "PlainName" }) })
    expect(parseProfile(e3).displayName).toBe("PlainName")
  })

  it("whitespace-only display_name falls through to next priority", () => {
    const event = makeEvent({ kind: 0, content: JSON.stringify({ display_name: "   ", name: "Fallback" }) })
    expect(parseProfile(event).displayName).toBe("Fallback")
  })

  it("all absent display fields produce undefined displayName", () => {
    const event = makeEvent({ kind: 0, content: JSON.stringify({ about: "no name fields" }) })
    expect(parseProfile(event).displayName).toBeUndefined()
  })

  it("does NOT throw on non-string fields (number name, array picture) and returns undefined fallbacks (CR-02)", () => {
    const event = makeEvent({ kind: 0, content: JSON.stringify({ name: 123, picture: ["x"] }) })
    let profile: ReturnType<typeof parseProfile> | undefined
    expect(() => {
      profile = parseProfile(event)
    }).not.toThrow()
    expect(profile).toBeDefined()
    expect(profile!.displayName).toBeUndefined()
    expect(profile!.picture).toBeUndefined()
  })

  it("skips non-string priority fields and falls through to the first valid string (CR-02)", () => {
    // display_name is a number, displayName is an object — name (a string) wins
    const event = makeEvent({
      kind: 0,
      content: JSON.stringify({ display_name: 42, displayName: { nested: true }, name: "RealName" }),
    })
    expect(parseProfile(event).displayName).toBe("RealName")
  })

  it("does NOT throw when JSON content is a bare non-object (e.g. a number) (CR-02)", () => {
    const event = makeEvent({ kind: 0, content: "123" })
    let profile: ReturnType<typeof parseProfile> | undefined
    expect(() => {
      profile = parseProfile(event)
    }).not.toThrow()
    expect(profile!.displayName).toBeUndefined()
    expect(profile!.picture).toBeUndefined()
  })
})

describe("classifyRelayClose", () => {
  it("returns clean for reason containing 'eose'", () => {
    expect(classifyRelayClose("closed automatically on eose")).toBe("clean")
  })

  it("returns clean for reason containing 'closed by caller'", () => {
    expect(classifyRelayClose("closed by caller")).toBe("clean")
  })

  it("returns clean for reason containing 'effect cleanup'", () => {
    expect(classifyRelayClose("effect cleanup")).toBe("clean")
  })

  it("returns clean for reason containing 'backstop timer'", () => {
    expect(classifyRelayClose("backstop timer fired")).toBe("clean")
  })

  it("returns error for connection failure reasons", () => {
    expect(classifyRelayClose("connection failed")).toBe("error")
    expect(classifyRelayClose("websocket closed")).toBe("error")
    expect(classifyRelayClose("unknown")).toBe("error")
  })
})
