import type { Event } from "nostr-tools/core"
import { articleCoordinate, parseArticle } from "@/lib/nostr"
import type { Article, NostrStatus, Profile } from "@/types/nostr"

export type NostrState = {
  articles: Article[]
  seenCoords: Set<string>
  profiles: Map<string, Profile>
  status: NostrStatus
  fetchKey: number
}

export type NostrAction =
  | { type: "ARTICLE_RECEIVED"; event: Event }
  | { type: "PROFILE_RECEIVED"; event: Event }
  | { type: "SET_STATUS"; status: NostrStatus }
  | { type: "RESET" }

export const initialState: NostrState = {
  articles: [],
  seenCoords: new Set<string>(),
  profiles: new Map<string, Profile>(),
  status: "streaming",
  fetchKey: 0,
}

export function nostrReducer(state: NostrState, action: NostrAction): NostrState {
  switch (action.type) {
    case "ARTICLE_RECEIVED": {
      // Freeze guard MUST precede dedup guard (D-02)
      if (state.articles.length >= 21) return state
      const coord = articleCoordinate(action.event)
      if (state.seenCoords.has(coord)) return state
      return {
        ...state,
        articles: [...state.articles, parseArticle(action.event)],
        seenCoords: new Set([...state.seenCoords, coord]),
      }
    }
    case "PROFILE_RECEIVED": {
      // Pass-through no-op for now — Plan 02 implements profile resolution
      return state
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
