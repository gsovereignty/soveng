import { describe, it, expect } from "vitest"
import { articleCoordinate, parseArticle, classifyRelayClose, parseProfile, resolveArticleStatus, sortArticlesByReplies, referencedArticleCoordinates } from "@/lib/nostr"
import type { Article } from "@/types/nostr"
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

describe("resolveArticleStatus", () => {
  it("resolves to 'done' when any articles were received (CR-01: live count, not stale 0)", () => {
    // The core CR-01 scenario: a PARTIAL result (e.g. 15 articles, < 21 freeze
    // cap) must resolve to 'done', not 'empty'. With the old stale-closure bug
    // the count read as 0 and this misresolved to 'empty'/'error'.
    expect(resolveArticleStatus(15, false)).toBe("done")
    expect(resolveArticleStatus(1, false)).toBe("done")
    // done wins even if relays all errored, as long as some articles arrived
    expect(resolveArticleStatus(15, true)).toBe("done")
  })

  it("resolves to 'error' only when no articles AND all relays errored", () => {
    expect(resolveArticleStatus(0, true)).toBe("error")
  })

  it("resolves to 'empty' when no articles and relays did not all error (CR-03 backstop/timeout path)", () => {
    // The backstop timer passes allError=false; with zero articles this must
    // still produce a terminal status so the UI never stays stuck on 'streaming'.
    expect(resolveArticleStatus(0, false)).toBe("empty")
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

// Helper to build a minimal Article fixture for sort tests
function makeArticle(coordinate: string, publishedAt: number): Article {
  return {
    id: `id-${coordinate}`,
    pubkey: coordinate.split(":")[1] ?? "pubkey",
    coordinate,
    d: coordinate.split(":")[2] ?? "d",
    title: `Article ${coordinate}`,
    summary: undefined,
    image: undefined,
    publishedAt,
    createdAt: publishedAt,
    content: "",
    hashtags: [],
  }
}

describe("sortArticlesByReplies", () => {
  it("sorts articles descending by reply count", () => {
    const a1 = makeArticle("30023:pk:slug-1", 1700000000)
    const a2 = makeArticle("30023:pk:slug-2", 1700000000)
    const a3 = makeArticle("30023:pk:slug-3", 1700000000)

    const replyCounts = new Map([
      ["30023:pk:slug-1", 2],
      ["30023:pk:slug-2", 5],
      ["30023:pk:slug-3", 1],
    ])

    const sorted = sortArticlesByReplies([a1, a2, a3], replyCounts)
    expect(sorted[0].coordinate).toBe("30023:pk:slug-2") // 5 replies
    expect(sorted[1].coordinate).toBe("30023:pk:slug-1") // 2 replies
    expect(sorted[2].coordinate).toBe("30023:pk:slug-3") // 1 reply
  })

  it("tie-breaks by publishedAt descending (newer first)", () => {
    const older = makeArticle("30023:pk:slug-old", 1700000000)
    const newer = makeArticle("30023:pk:slug-new", 1700001000)

    // Both have same reply count
    const replyCounts = new Map([
      ["30023:pk:slug-old", 3],
      ["30023:pk:slug-new", 3],
    ])

    const sorted = sortArticlesByReplies([older, newer], replyCounts)
    expect(sorted[0].coordinate).toBe("30023:pk:slug-new") // newer timestamp wins tie
    expect(sorted[1].coordinate).toBe("30023:pk:slug-old")
  })

  it("treats articles absent from replyCounts as 0 replies", () => {
    const withReplies = makeArticle("30023:pk:slug-popular", 1700000000)
    const noReplies = makeArticle("30023:pk:slug-quiet", 1700000000)

    const replyCounts = new Map([["30023:pk:slug-popular", 3]])
    // slug-quiet not in map — counts as 0

    const sorted = sortArticlesByReplies([noReplies, withReplies], replyCounts)
    expect(sorted[0].coordinate).toBe("30023:pk:slug-popular")
    expect(sorted[1].coordinate).toBe("30023:pk:slug-quiet")
  })

  it("does not mutate the input array", () => {
    const a1 = makeArticle("30023:pk:slug-1", 1700000000)
    const a2 = makeArticle("30023:pk:slug-2", 1700000000)
    const input = [a1, a2]
    const original = [...input]
    const replyCounts = new Map([["30023:pk:slug-2", 1]])

    sortArticlesByReplies(input, replyCounts)

    // Input order must be unchanged
    expect(input[0].coordinate).toBe(original[0].coordinate)
    expect(input[1].coordinate).toBe(original[1].coordinate)
  })

  it("returns all articles when replyCounts is empty (all treated as 0)", () => {
    const a1 = makeArticle("30023:pk:slug-1", 1700001000)
    const a2 = makeArticle("30023:pk:slug-2", 1700000000)
    const sorted = sortArticlesByReplies([a2, a1], new Map())
    // All have 0 replies; newer publishedAt wins tie-break
    expect(sorted[0].coordinate).toBe("30023:pk:slug-1")
  })
})

describe("referencedArticleCoordinates", () => {
  it("returns 30023: a-tag values from the event", () => {
    const event = {
      id: "id",
      pubkey: "pk",
      created_at: 1700000000,
      kind: 1,
      tags: [
        ["a", "30023:author:slug"],
        ["a", "30023:author2:slug2"],
      ],
      content: "",
      sig: "sig",
    } as unknown as Event

    expect(referencedArticleCoordinates(event)).toEqual([
      "30023:author:slug",
      "30023:author2:slug2",
    ])
  })

  it("filters out a-tags that do not start with 30023:", () => {
    const event = {
      id: "id",
      pubkey: "pk",
      created_at: 1700000000,
      kind: 1,
      tags: [
        ["a", "1:author:slug"],       // kind:1 — not an article
        ["a", "30023:author:slug"],    // article — keep
        ["a", "30024:author:draft"],   // different kind — not an article
      ],
      content: "",
      sig: "sig",
    } as unknown as Event

    const result = referencedArticleCoordinates(event)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe("30023:author:slug")
  })

  it("returns empty array when no a-tags are present", () => {
    const event = {
      id: "id",
      pubkey: "pk",
      created_at: 1700000000,
      kind: 1,
      tags: [["p", "some-pubkey"], ["t", "nostr"]],
      content: "",
      sig: "sig",
    } as unknown as Event

    expect(referencedArticleCoordinates(event)).toEqual([])
  })

  it("returns empty array when event has no tags at all", () => {
    const event = {
      id: "id",
      pubkey: "pk",
      created_at: 1700000000,
      kind: 1,
      tags: [],
      content: "",
      sig: "sig",
    } as unknown as Event

    expect(referencedArticleCoordinates(event)).toEqual([])
  })
})
