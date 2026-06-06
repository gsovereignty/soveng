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

describe("nostrReducer — ARTICLE_RECEIVED", () => {
  it("appends article and records coordinate when coordinate is new and count < 21", () => {
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

  it("is a no-op when articles.length === 21 (freeze guard)", () => {
    // Build state with 21 articles
    let state: NostrState = initialState
    for (let i = 0; i < 21; i++) {
      state = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: makeEvent(`slug-${i}`) })
    }
    expect(state.articles).toHaveLength(21)

    // 22nd event with a new coordinate is ignored
    const extra = makeEvent("slug-extra")
    const frozen = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: extra })
    expect(frozen).toBe(state)
    expect(frozen.articles).toHaveLength(21)
    expect(frozen.seenCoords.has("30023:pubkey-aabbcc:slug-extra")).toBe(false)
  })

  it("checks freeze guard BEFORE dedup guard (freeze is the outer check)", () => {
    // Build state with 21 articles, using slug-0 as first
    let state: NostrState = initialState
    for (let i = 0; i < 21; i++) {
      state = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: makeEvent(`slug-${i}`) })
    }
    // Re-send slug-0 (already seen) when frozen — should still be same ref (frozen check wins)
    const resubmit = makeEvent("slug-0")
    const result = nostrReducer(state, { type: "ARTICLE_RECEIVED", event: resubmit })
    expect(result).toBe(state)
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
})
