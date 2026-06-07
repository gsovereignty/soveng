import { describe, it, expect } from "vitest"
import { nostrReducer, initialState } from "@/context/nostrReducer"
import type { NostrState } from "@/context/nostrReducer"
import type { Event } from "nostr-tools/core"

// Minimal hand-built Event fixture factory for articles (kind:30023)
function makeEvent(d: string, pubkey = "pubkey-aabbcc", created_at = 1700000000): Event {
  return {
    id: `id-${d}`,
    pubkey,
    created_at,
    kind: 30023,
    tags: [["d", d]],
    content: `content for ${d}`,
    sig: "dummy-sig",
  } as unknown as Event
}

// Minimal hand-built Event fixture factory for kind:0 profile events
function makeProfileEvent(pubkey: string, content: Record<string, unknown>, created_at = 1700000000): Event {
  return {
    id: `id-profile-${pubkey}`,
    pubkey,
    created_at,
    kind: 0,
    tags: [],
    content: JSON.stringify(content),
    sig: "dummy-sig",
  } as unknown as Event
}

// Minimal hand-built Event fixture factory for referencing events (kind:1 or kind:1111)
function makeReplyEvent(id: string, aTags: string[], kind = 1): Event {
  return {
    id,
    pubkey: "reply-author",
    created_at: 1700000000,
    kind,
    tags: aTags.map(coord => ["a", coord]),
    content: "reply content",
    sig: "dummy-sig",
  } as unknown as Event
}

describe("nostrReducer — ARTICLE_RECEIVED", () => {
  it("appends article and records coordinate when coordinate is new", () => {
    const event = makeEvent("slug-1")
    const next = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event })
    expect(next.articles).toHaveLength(1)
    expect(next.seenCoords.has("30023:pubkey-aabbcc:slug-1")).toBe(true)
  })

  it("is a no-op (same state reference) for duplicate coordinate", () => {
    const event = makeEvent("slug-1")
    const afterFirst = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event })
    const afterSecond = nostrReducer(afterFirst, { type: "ARTICLE_RECEIVED", event })
    // Same reference — dedup no-op
    expect(afterSecond).toBe(afterFirst)
    expect(afterSecond.articles).toHaveLength(1)
  })

  it("appends a 22nd unique article (21-cap removed)", () => {
    // Build state with 21 articles
    let state: NostrState = initialState
    for (let i = 0; i < 21; i++) {
      state = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: makeEvent(`slug-${i}`) })
    }
    expect(state.articles).toHaveLength(21)

    // 22nd event with a new coordinate IS accepted (cap removed)
    const extra = makeEvent("slug-extra")
    const afterExtra = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: extra })
    expect(afterExtra.articles).toHaveLength(22)
    expect(afterExtra.seenCoords.has("30023:pubkey-aabbcc:slug-extra")).toBe(true)
  })
})

describe("nostrReducer — REPLY_RECEIVED", () => {
  it("increments replyCounts for a matched article coordinate", () => {
    // Add an article first
    const articleEvent = makeEvent("slug-1")
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: articleEvent })
    expect(state.articles).toHaveLength(1)

    // Reply event referencing the article coordinate
    const coord = "30023:pubkey-aabbcc:slug-1"
    const replyEvent = makeReplyEvent("reply-id-1", [coord])
    state = nostrReducer(state, { type: "REPLY_RECEIVED", event: replyEvent })

    expect(state.replyCounts.get(coord)).toBe(1)
  })

  it("increments count for multiple articles referenced by one event", () => {
    // Add two articles
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: makeEvent("slug-a") })
    state = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: makeEvent("slug-b") })

    const coordA = "30023:pubkey-aabbcc:slug-a"
    const coordB = "30023:pubkey-aabbcc:slug-b"

    // Reply references both coordinates
    const replyEvent = makeReplyEvent("reply-multi", [coordA, coordB])
    state = nostrReducer(state, { type: "REPLY_RECEIVED", event: replyEvent })

    expect(state.replyCounts.get(coordA)).toBe(1)
    expect(state.replyCounts.get(coordB)).toBe(1)
  })

  it("ignores duplicate reply event id (seenReplyIds dedup)", () => {
    const articleEvent = makeEvent("slug-1")
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: articleEvent })

    const coord = "30023:pubkey-aabbcc:slug-1"
    const replyEvent = makeReplyEvent("reply-id-dup", [coord])

    // First dispatch
    state = nostrReducer(state, { type: "REPLY_RECEIVED", event: replyEvent })
    expect(state.replyCounts.get(coord)).toBe(1)

    // Second dispatch with same event id — must be ignored
    state = nostrReducer(state, { type: "REPLY_RECEIVED", event: replyEvent })
    expect(state.replyCounts.get(coord)).toBe(1)
  })

  it("does not change replyCounts when referencing an unknown coordinate", () => {
    // No articles in state — reply references a coordinate we did not fetch
    const replyEvent = makeReplyEvent("reply-unknown", ["30023:stranger:other-slug"])
    const state = nostrReducer(initialState, { type: "REPLY_RECEIVED", event: replyEvent })

    expect(state.replyCounts.size).toBe(0)
    // But event id IS recorded in seenReplyIds to prevent reprocessing
    expect(state.seenReplyIds.has("reply-unknown")).toBe(true)
  })

  it("does not increment for non-30023 a-tags", () => {
    const articleEvent = makeEvent("slug-1")
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: articleEvent })

    // a-tag referencing a different kind (e.g. kind:1 note — not 30023)
    const replyEvent = makeReplyEvent("reply-other-kind", ["1:pubkey-aabbcc:slug-1"])
    state = nostrReducer(state, { type: "REPLY_RECEIVED", event: replyEvent })

    expect(state.replyCounts.size).toBe(0)
  })

  it("accumulates counts across multiple distinct reply events", () => {
    const articleEvent = makeEvent("slug-popular")
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: articleEvent })

    const coord = "30023:pubkey-aabbcc:slug-popular"
    for (let i = 0; i < 5; i++) {
      state = nostrReducer(state, {
        type: "REPLY_RECEIVED",
        event: makeReplyEvent(`reply-${i}`, [coord]),
      })
    }

    expect(state.replyCounts.get(coord)).toBe(5)
  })
})

describe("nostrReducer — SET_STATUS", () => {
  it("replaces status only", () => {
    const next = nostrReducer(initialState, { type: "SET_STATUS", status: "done" })
    expect(next.status).toBe("done")
    expect(next.articles).toBe(initialState.articles)
    expect(next.fetchKey).toBe(initialState.fetchKey)
  })
})

describe("nostrReducer — PROFILE_RECEIVED", () => {
  it("inserts a profile into the profiles Map when none exists for that pubkey", () => {
    const event = makeProfileEvent("pubkey-1", { display_name: "Alice", picture: "https://x/a.png" })
    const next = nostrReducer(initialState, { type: "PROFILE_RECEIVED", event })
    expect(next.profiles.has("pubkey-1")).toBe(true)
    expect(next.profiles.get("pubkey-1")?.displayName).toBe("Alice")
    expect(next.profiles.get("pubkey-1")?.picture).toBe("https://x/a.png")
  })

  it("replaces existing profile when new event has higher created_at (newest-wins)", () => {
    const old = makeProfileEvent("pubkey-1", { display_name: "OldName" }, 1700000000)
    const newer = makeProfileEvent("pubkey-1", { display_name: "NewName" }, 1700000001)
    const afterOld = nostrReducer(initialState, { type: "PROFILE_RECEIVED", event: old })
    const afterNewer = nostrReducer(afterOld, { type: "PROFILE_RECEIVED", event: newer })
    expect(afterNewer.profiles.get("pubkey-1")?.displayName).toBe("NewName")
    expect(afterNewer.profiles.get("pubkey-1")?.createdAt).toBe(1700000001)
  })

  it("is a no-op (same state reference) when new event has lower created_at than stored", () => {
    const newer = makeProfileEvent("pubkey-1", { display_name: "NewName" }, 1700000002)
    const older = makeProfileEvent("pubkey-1", { display_name: "OldName" }, 1700000001)
    const afterNewer = nostrReducer(initialState, { type: "PROFILE_RECEIVED", event: newer })
    const afterOlder = nostrReducer(afterNewer, { type: "PROFILE_RECEIVED", event: older })
    // older event should be ignored — same state reference
    expect(afterOlder).toBe(afterNewer)
    expect(afterOlder.profiles.get("pubkey-1")?.displayName).toBe("NewName")
  })

  it("is a no-op (same state reference) when new event has equal created_at to stored (Pitfall 4)", () => {
    const first = makeProfileEvent("pubkey-1", { display_name: "First" }, 1700000000)
    const equal = makeProfileEvent("pubkey-1", { display_name: "Equal" }, 1700000000)
    const afterFirst = nostrReducer(initialState, { type: "PROFILE_RECEIVED", event: first })
    const afterEqual = nostrReducer(afterFirst, { type: "PROFILE_RECEIVED", event: equal })
    // equal timestamp — strict > means no replace; same state reference
    expect(afterEqual).toBe(afterFirst)
    expect(afterEqual.profiles.get("pubkey-1")?.displayName).toBe("First")
  })

  it("returns a NEW Map reference on insert (immutable update)", () => {
    const event = makeProfileEvent("pubkey-1", { display_name: "Alice" })
    const next = nostrReducer(initialState, { type: "PROFILE_RECEIVED", event })
    expect(next.profiles).not.toBe(initialState.profiles)
  })
})

describe("nostrReducer — RESET", () => {
  it("returns fresh state with seenCoords cleared and fetchKey incremented", () => {
    // Put some articles in first
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: makeEvent("slug-1") })
    state = nostrReducer(state, { type: "SET_STATUS", status: "done" })

    const reset = nostrReducer(state, { type: "RESET" })
    expect(reset.articles).toHaveLength(0)
    expect(reset.seenCoords.size).toBe(0)
    expect(reset.status).toBe("streaming")
    expect(reset.fetchKey).toBe(state.fetchKey + 1)
  })

  it("full-reset: clears articles, seenCoords, profiles and resets status to streaming with fetchKey+1", () => {
    // Build state with several articles + a profile
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: makeEvent("slug-a", "pubkey-1") })
    state = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: makeEvent("slug-b", "pubkey-2") })
    state = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: makeEvent("slug-c", "pubkey-3") })
    state = nostrReducer(state, {
      type: "PROFILE_RECEIVED",
      event: makeProfileEvent("pubkey-1", { display_name: "Alice" }),
    })
    state = nostrReducer(state, { type: "SET_STATUS", status: "done" })

    // Pre-reset assertions
    expect(state.articles).toHaveLength(3)
    expect(state.seenCoords.size).toBe(3)
    expect(state.profiles.size).toBe(1)
    expect(state.status).toBe("done")
    const prevFetchKey = state.fetchKey

    // Dispatch RESET
    const reset = nostrReducer(state, { type: "RESET" })

    // All streaming state must be fully cleared
    expect(reset.articles).toHaveLength(0)
    expect(reset.seenCoords.size).toBe(0)
    expect(reset.profiles.size).toBe(0)
    expect(reset.status).toBe("streaming")
    expect(reset.fetchKey).toBe(prevFetchKey + 1)
  })

  it("clears replyCounts and seenReplyIds on RESET", () => {
    // Add an article and a reply count
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event: makeEvent("slug-1") })
    const coord = "30023:pubkey-aabbcc:slug-1"
    state = nostrReducer(state, {
      type: "REPLY_RECEIVED",
      event: makeReplyEvent("reply-id-reset", [coord]),
    })
    expect(state.replyCounts.get(coord)).toBe(1)
    expect(state.seenReplyIds.has("reply-id-reset")).toBe(true)

    // RESET must clear both
    const reset = nostrReducer(state, { type: "RESET" })
    expect(reset.replyCounts.size).toBe(0)
    expect(reset.seenReplyIds.size).toBe(0)
  })

  it("Pitfall 3 regression: a coordinate that was in seenCoords before RESET is accepted after RESET", () => {
    // First round: article with slug-x is received and deduped
    const event = makeEvent("slug-x", "pubkey-pitfall3")
    let state = nostrReducer(initialState, { type: "ARTICLE_RECEIVED", event })
    expect(state.articles).toHaveLength(1)
    expect(state.seenCoords.has("30023:pubkey-pitfall3:slug-x")).toBe(true)

    // Second dispatch of same event is deduped (no-op)
    const deduped = nostrReducer(state, { type: "ARTICLE_RECEIVED", event })
    expect(deduped).toBe(state) // same reference — dedup guard
    expect(deduped.articles).toHaveLength(1)

    // RESET clears seenCoords
    const reset = nostrReducer(state, { type: "RESET" })
    expect(reset.seenCoords.has("30023:pubkey-pitfall3:slug-x")).toBe(false)

    // After RESET, the previously-seen coordinate is accepted again (Pitfall 3 closed)
    const reAdded = nostrReducer(reset, { type: "ARTICLE_RECEIVED", event })
    expect(reAdded.articles).toHaveLength(1) // re-added, not deduped
    expect(reAdded.seenCoords.has("30023:pubkey-pitfall3:slug-x")).toBe(true)
  })
})
