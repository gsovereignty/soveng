import type { Event } from "nostr-tools/core"
import { articleCoordinate, parseArticle, parseProfile, referencedArticleCoordinates } from "@/lib/nostr"
import type { Article, NostrStatus, Profile } from "@/types/nostr"

export type NostrState = {
  articles: Article[]
  seenCoords: Set<string>
  profiles: Map<string, Profile>
  replyCounts: Map<string, number>
  seenReplyIds: Set<string>
  status: NostrStatus
  fetchKey: number
}

export type NostrAction =
  | { type: "ARTICLE_RECEIVED"; event: Event }
  | { type: "PROFILE_RECEIVED"; event: Event }
  | { type: "REPLY_RECEIVED"; event: Event }
  | { type: "SET_STATUS"; status: NostrStatus }
  | { type: "RESET" }

export const initialState: NostrState = {
  articles: [],
  seenCoords: new Set<string>(),
  profiles: new Map<string, Profile>(),
  replyCounts: new Map<string, number>(),
  seenReplyIds: new Set<string>(),
  status: "streaming",
  fetchKey: 0,
}

export function nostrReducer(state: NostrState, action: NostrAction): NostrState {
  switch (action.type) {
    case "ARTICLE_RECEIVED": {
      // Only the seenCoords dedup gate remains (21-cap removed per user request)
      const coord = articleCoordinate(action.event)
      if (state.seenCoords.has(coord)) return state
      return {
        ...state,
        articles: [...state.articles, parseArticle(action.event)],
        seenCoords: new Set([...state.seenCoords, coord]),
      }
    }
    case "PROFILE_RECEIVED": {
      const profile = parseProfile(action.event)
      const existing = state.profiles.get(action.event.pubkey)
      // Newest-wins: only accept if no existing profile OR event is strictly newer (Pitfall 4: strict >)
      if (!existing || action.event.created_at > existing.createdAt) {
        const profiles = new Map(state.profiles)
        profiles.set(action.event.pubkey, profile)
        return { ...state, profiles }
      }
      return state
    }
    case "REPLY_RECEIVED": {
      // T-vqt-01: dedup by event.id to prevent relay re-delivery from inflating counts
      if (state.seenReplyIds.has(action.event.id)) return state

      const coords = referencedArticleCoordinates(action.event)
      const newSeenReplyIds = new Set(state.seenReplyIds)
      newSeenReplyIds.add(action.event.id)

      // Build a set of known article coordinates for fast membership check
      const knownCoords = new Set(state.articles.map(a => a.coordinate))
      const matchedCoords = coords.filter(c => knownCoords.has(c))

      if (matchedCoords.length === 0) {
        // No matched coordinates — record event.id but keep replyCounts reference unchanged
        return { ...state, seenReplyIds: newSeenReplyIds }
      }

      const newReplyCounts = new Map(state.replyCounts)
      for (const coord of matchedCoords) {
        newReplyCounts.set(coord, (newReplyCounts.get(coord) ?? 0) + 1)
      }

      return { ...state, replyCounts: newReplyCounts, seenReplyIds: newSeenReplyIds }
    }
    case "SET_STATUS": {
      return { ...state, status: action.status }
    }
    case "RESET": {
      // Pitfall 3: seenCoords MUST clear; fetchKey increments from current state
      return { ...initialState, fetchKey: state.fetchKey + 1 }
    }
  }
}
