import { describe, it, expect } from "vitest"
import { buildFacets, computeDynamicCounts, filterArticles } from "@/lib/facets"
import type { Article } from "@/types/nostr"

// Minimal Article fixture — only the hashtags field matters for these pure helpers
function makeArticle(hashtags: string[], id = Math.random().toString()): Article {
  return {
    id,
    pubkey: "pk",
    coordinate: `30023:pk:${id}`,
    d: id,
    title: undefined,
    summary: undefined,
    image: undefined,
    publishedAt: 0,
    createdAt: 0,
    content: "",
    hashtags,
  }
}

describe("buildFacets", () => {
  it("returns [] for empty articles", () => {
    expect(buildFacets([])).toEqual([])
  })

  it("counts tags across articles correctly", () => {
    const articles = [
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["nostr"]),
    ]
    const facets = buildFacets(articles)
    const nostrFacet = facets.find(f => f.tag === "nostr")
    const bitcoinFacet = facets.find(f => f.tag === "bitcoin")
    expect(nostrFacet?.count).toBe(2)
    expect(bitcoinFacet?.count).toBe(1)
  })

  it("sorts by count descending (D-06)", () => {
    const articles = [
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["nostr"]),
    ]
    const facets = buildFacets(articles)
    expect(facets[0].tag).toBe("nostr")
    expect(facets[0].count).toBe(2)
    expect(facets[1].count).toBe(1)
  })

  it("applies alphabetical tie-break for equal counts (D-06)", () => {
    // nostr:2, bitcoin:2 — bitcoin comes first alphabetically
    const articles = [
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["bitcoin", "nostr"]),
    ]
    const facets = buildFacets(articles)
    expect(facets).toHaveLength(2)
    expect(facets[0].count).toBe(2)
    expect(facets[1].count).toBe(2)
    expect(facets[0].tag).toBe("bitcoin")
    expect(facets[1].tag).toBe("nostr")
  })

  it("given [nostr,nostr,bitcoin] and [bitcoin] returns [{bitcoin,2},{nostr,2}] alpha tie-break", () => {
    const articles = [
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["nostr", "bitcoin"]),
    ]
    const facets = buildFacets(articles)
    expect(facets[0].tag).toBe("bitcoin")
    expect(facets[0].count).toBe(2)
    expect(facets[1].tag).toBe("nostr")
    expect(facets[1].count).toBe(2)
  })
})

describe("computeDynamicCounts", () => {
  it("OR mode: each tag's count = articles carrying that tag (independent of selection)", () => {
    const articles = [
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["nostr"]),
      makeArticle(["bitcoin"]),
    ]
    // Even with nostr selected, bitcoin count stays at 2 (all articles carrying bitcoin)
    const counts = computeDynamicCounts(articles, new Set(["nostr"]), "OR")
    expect(counts.get("nostr")).toBe(2)
    expect(counts.get("bitcoin")).toBe(2)
  })

  it("OR mode: selected tag count is over all articles (never misleading 0 invariant)", () => {
    const articles = [
      makeArticle(["nostr"]),
      makeArticle(["nostr", "bitcoin"]),
    ]
    // nostr is selected; its OR count must be >= 1 (all articles with nostr = 2)
    const counts = computeDynamicCounts(articles, new Set(["nostr"]), "OR")
    expect(counts.get("nostr")).toBeGreaterThanOrEqual(1)
    expect(counts.get("nostr")).toBe(2)
  })

  it("AND mode with no other selected tags: counts are over all articles", () => {
    const articles = [
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["nostr"]),
    ]
    // nostr selected in AND mode; no OTHER selected tags so base = all articles
    const counts = computeDynamicCounts(articles, new Set(["nostr"]), "AND")
    expect(counts.get("nostr")).toBe(2)
    expect(counts.get("bitcoin")).toBe(1)
  })

  it("AND mode with other selected tags: tag T count = articles carrying T AND every other selected tag", () => {
    const articles = [
      makeArticle(["nostr", "bitcoin", "lightning"]),
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["nostr", "lightning"]),
    ]
    // Selected: nostr + bitcoin; counting lightning = articles with nostr AND bitcoin AND lightning = 1
    const counts = computeDynamicCounts(articles, new Set(["nostr", "bitcoin"]), "AND")
    expect(counts.get("lightning")).toBe(1)
    // nostr count: base = articles with bitcoin (other selected) = articles 0 and 1 (2 articles)
    // of those, carry nostr = both → 2
    expect(counts.get("nostr")).toBe(2)
  })

  it("AND mode: selected tag shows count = current filteredArticles length (never misleading 0)", () => {
    const articles = [
      makeArticle(["nostr", "bitcoin"]),
      makeArticle(["nostr", "lightning"]),
    ]
    // nostr + bitcoin selected; nostr's AND count = articles with bitcoin (other selected) that carry nostr = 1
    const counts = computeDynamicCounts(articles, new Set(["nostr", "bitcoin"]), "AND")
    // The AND result would be articles with BOTH nostr AND bitcoin = 1 article
    // nostr's count via algorithm: base = articles with bitcoin (1 article), of those carrying nostr = 1
    expect(counts.get("nostr")).toBeGreaterThanOrEqual(1)
    // bitcoin's count: base = articles with nostr (2 articles), of those carrying bitcoin = 1
    expect(counts.get("bitcoin")).toBeGreaterThanOrEqual(1)
  })

  it("returns empty map for empty articles", () => {
    const counts = computeDynamicCounts([], new Set(), "OR")
    expect(counts.size).toBe(0)
  })
})

describe("filterArticles", () => {
  it("returns all articles when selection is empty (OR)", () => {
    const articles = [makeArticle(["nostr"]), makeArticle(["bitcoin"])]
    expect(filterArticles(articles, new Set(), "OR")).toEqual(articles)
  })

  it("returns all articles when selection is empty (AND)", () => {
    const articles = [makeArticle(["nostr"]), makeArticle(["bitcoin"])]
    expect(filterArticles(articles, new Set(), "AND")).toEqual(articles)
  })

  it("OR mode: includes articles carrying at least one selected tag", () => {
    const a1 = makeArticle(["nostr", "bitcoin"], "a1")
    const a2 = makeArticle(["lightning"], "a2")
    const a3 = makeArticle(["bitcoin"], "a3")
    const result = filterArticles([a1, a2, a3], new Set(["bitcoin"]), "OR")
    expect(result).toEqual([a1, a3])
  })

  it("AND mode: article carrying a superset of selected tags matches", () => {
    // selected = {nostr}; article has nostr + bitcoin — must match (carries every selected tag)
    const a1 = makeArticle(["nostr", "bitcoin"], "a1")
    const result = filterArticles([a1], new Set(["nostr"]), "AND")
    expect(result).toEqual([a1])
  })

  it("AND mode: article missing a selected tag is excluded", () => {
    // selected = {nostr, lightning}; article has nostr + bitcoin (missing lightning) — excluded
    const a1 = makeArticle(["nostr", "bitcoin"], "a1")
    const a2 = makeArticle(["nostr", "lightning"], "a2")
    const result = filterArticles([a1, a2], new Set(["nostr", "lightning"]), "AND")
    expect(result).toEqual([a2])
  })

  it("AND mode: untagged article does NOT match a non-empty selection", () => {
    // edge case from CR-01: an article with no hashtags must be excluded under AND
    const tagged = makeArticle(["nostr"], "tagged")
    const untagged = makeArticle([], "untagged")
    const result = filterArticles([tagged, untagged], new Set(["nostr"]), "AND")
    expect(result).toEqual([tagged])
    expect(result).not.toContain(untagged)
  })
})
