import { createContext, useCallback, useContext, useMemo, useReducer } from "react"
import type { ReactNode } from "react"
import type { Article, NostrStatus, Profile } from "@/types/nostr"
import { nostrReducer, initialState } from "@/context/nostrReducer"
import type { NostrAction, NostrState } from "@/context/nostrReducer"
import { useArticleFetch } from "@/hooks/useArticleFetch"
import { useProfileFetch } from "@/hooks/useProfileFetch"
import { useReplyFetch } from "@/hooks/useReplyFetch"

export type { NostrAction }

type NostrContextValue = NostrState & { refetch: () => void }

const NostrContext = createContext<NostrContextValue | null>(null)

export function NostrProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(nostrReducer, initialState)

  const refetch = useCallback(() => dispatch({ type: "RESET" }), [])

  // Wire the streaming article fetch hook — runs for the provider lifetime, re-runs on refetch
  useArticleFetch(state.fetchKey, dispatch, state.articles.length)

  // Derive unique author pubkeys from rendered articles (stable memo keyed on articles identity)
  const pubkeys = useMemo(
    () => [...new Set(state.articles.map(a => a.pubkey))],
    [state.articles]
  )

  // Wire the batched profile fetch hook — opens one kind:0 subscription when articles exist (D-08, D-09)
  useProfileFetch(pubkeys, dispatch)

  // Derive unique article coordinates for the reply count subscription
  const coordinates = useMemo(
    () => [...new Set(state.articles.map(a => a.coordinate))],
    [state.articles]
  )

  // Wire the batched reply fetch hook — opens one #a subscription when articles exist
  useReplyFetch(coordinates, dispatch)

  const value = useMemo(
    () => ({ ...state, refetch }),
    [state, refetch]
  )

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
}

export function useNostr(): NostrState & {
  refetch: () => void
  articles: Article[]
  profiles: Map<string, Profile>
  status: NostrStatus
} {
  const ctx = useContext(NostrContext)
  if (!ctx) throw new Error("useNostr must be used inside <NostrProvider>")
  return ctx
}
